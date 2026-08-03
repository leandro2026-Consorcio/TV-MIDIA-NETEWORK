-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4D: TERMOS COMERCIAIS E ACEITE
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE TERMOS E CONDIÇÕES DA PLATAFORMA (PLATFORM_TERMS)
CREATE TABLE IF NOT EXISTS public.platform_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_type TEXT NOT NULL CHECK (term_type IN ('general_terms', 'network_participation', 'media_policy', 'advertiser_terms', 'display_partner_terms', 'financial_discount_policy', 'marketplace_terms')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT platform_terms_type_version_unique UNIQUE (term_type, version)
);

CREATE INDEX IF NOT EXISTS idx_platform_terms_type ON public.platform_terms(term_type);

-- 2. TABELA DE REGISTRO HISTÓRICO IMUTÁVEL DE ACEITES POR EMPRESA (COMPANY_TERM_ACCEPTANCES)
CREATE TABLE IF NOT EXISTS public.company_term_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.platform_terms(id) ON DELETE CASCADE,
  accepted_by UUID NOT NULL REFERENCES public.profiles(id),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  acceptance_context TEXT DEFAULT 'onboarding' CHECK (acceptance_context IN ('onboarding', 'network_settings', 'create_ad_offer', 'marketplace_request', 'approve_media_request', 'convert_to_campaign', 'financial_discount')),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT company_term_unique UNIQUE (company_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_acceptances_company ON public.company_term_acceptances(company_id);
CREATE INDEX IF NOT EXISTS idx_acceptances_term ON public.company_term_acceptances(term_id);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS) MULTIEMPRESA
ALTER TABLE public.platform_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_term_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PlatformTerms - Leitura por usuários autenticados" ON public.platform_terms;
CREATE POLICY "PlatformTerms - Leitura por usuários autenticados"
  ON public.platform_terms FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "PlatformTerms - Gestão por Master Admin" ON public.platform_terms;
CREATE POLICY "PlatformTerms - Gestão por Master Admin"
  ON public.platform_terms FOR ALL TO authenticated USING (is_master_admin());

DROP POLICY IF EXISTS "CompanyTermAcceptances - Leitura por empresa ou Master Admin" ON public.company_term_acceptances;
CREATE POLICY "CompanyTermAcceptances - Leitura por empresa ou Master Admin"
  ON public.company_term_acceptances FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 4. RPC TRANSACIONAL PARA REGISTRAR ACEITE DE TERMO (ACCEPT_PLATFORM_TERM)
CREATE OR REPLACE FUNCTION public.accept_platform_term(
  p_company_id UUID,
  p_term_id UUID,
  p_acceptance_context TEXT DEFAULT 'onboarding',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_term RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_company_admin BOOLEAN;
  v_acceptance_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- A. Validar se o usuário é Admin da empresa ou Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = p_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_company_admin;

    IF NOT v_is_company_admin THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_company_id, 'TERM_ACCEPTANCE_UNAUTHORIZED_ATTEMPT', jsonb_build_object('term_id', p_term_id));

      RETURN jsonb_build_object('success', false, 'error', 'Apenas Administradores da empresa ou Master Admin podem formalizar o aceite de termos.');
    END IF;
  END IF;

  -- B. Validar se o termo existe e está ativo
  SELECT * INTO v_term FROM public.platform_terms WHERE id = p_term_id;
  IF v_term.id IS NULL OR v_term.is_active = FALSE THEN
    RETURN jsonb_build_object('success', false, 'error', 'O termo de uso solicitado não existe ou foi desativado.');
  END IF;

  -- C. Impedir duplicidade de aceite para a mesma versão do termo
  IF EXISTS (SELECT 1 FROM public.company_term_acceptances WHERE company_id = p_company_id AND term_id = p_term_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Esta versão do termo já foi aceita anteriormente pela empresa.', 'already_accepted', true);
  END IF;

  -- D. Inserir aceite histórico
  INSERT INTO public.company_term_acceptances (
    company_id,
    term_id,
    accepted_by,
    acceptance_context,
    ip_address,
    user_agent
  ) VALUES (
    p_company_id,
    p_term_id,
    v_user_id,
    COALESCE(p_acceptance_context, 'onboarding'),
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_acceptance_id;

  -- E. Registrar em Audit Logs
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    p_company_id, 
    'COMPANY_TERM_ACCEPTED', 
    jsonb_build_object(
      'acceptance_id', v_acceptance_id,
      'term_id', p_term_id,
      'term_type', v_term.term_type,
      'version', v_term.version,
      'context', p_acceptance_context
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'acceptance_id', v_acceptance_id, 
    'term_type', v_term.term_type,
    'version', v_term.version
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. RPC PARA VERIFICAR TERMOS PENDENTES DE UMA EMPRESA (CHECK_COMPANY_REQUIRED_TERMS)
CREATE OR REPLACE FUNCTION public.check_company_required_terms(
  p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_pending JSONB;
  v_compliant BOOLEAN;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'term_id', pt.id,
        'term_type', pt.term_type,
        'version', pt.version,
        'title', pt.title,
        'content', pt.content
      )
    ),
    '[]'::jsonb
  ) INTO v_pending
  FROM public.platform_terms pt
  WHERE pt.is_active = TRUE
    AND pt.id NOT IN (
      SELECT term_id FROM public.company_term_acceptances WHERE company_id = p_company_id
    );

  v_compliant := (jsonb_array_length(v_pending) = 0);

  RETURN jsonb_build_object(
    'compliant', v_compliant,
    'pending_terms_count', jsonb_array_length(v_pending),
    'pending_terms', v_pending
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. POPULAR TERMOS ATIVOS INICIAIS PADRÃO (VERSÃO 1)
INSERT INTO public.platform_terms (term_type, version, title, content, is_active)
VALUES
  (
    'general_terms', 1, 
    'Termos Gerais de Uso da Rede Indoor Local', 
    'Esta plataforma destina-se ao gerenciamento de redes de sinalização digital e marketplace interno de mídias entre empresas parceiras. As empresas concordam em agir de boa-fé e respeitar as diretrizes da rede.', 
    TRUE
  ),
  (
    'network_participation', 1, 
    'Regras de Participação na Rede Colaborativa', 
    'As empresas que cedem capacidade de suas TVs para a rede concordam que suas telas veicularão conteúdos de empresas parceiras mediante créditos ou inventários de permuta acordados.', 
    TRUE
  ),
  (
    'media_policy', 1, 
    'Política de Conteúdo e Responsabilidade de Mídia', 
    'A empresa anunciante é 100% responsável pelo conteúdo e pelos direitos autorais das imagens e vídeos enviados. É estritamente proibido conteúdo impróprio, difamatório ou ilegal.', 
    TRUE
  ),
  (
    'marketplace_terms', 1, 
    'Termos Comerciais do Marketplace Interno', 
    'A veiculação de ofertas comerciais e pacotes de mídia entre empresas do marketplace é mensurada via Proof of Play. O saldo gerado pelas entregas concluídas pode ser utilizado para abatimento na mensalidade da plataforma.', 
    TRUE
  )
ON CONFLICT (term_type, version) DO NOTHING;
