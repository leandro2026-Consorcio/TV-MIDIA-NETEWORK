-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4D: HARDENING DE TERMOS E CONFORMIDADE
-- Data: 2026-07-31
-- ============================================================================

-- 1. PROTEÇÃO DE PERMISSÃO NA RPC CHECK_COMPANY_REQUIRED_TERMS
CREATE OR REPLACE FUNCTION public.check_company_required_terms(
  p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_has_access BOOLEAN;
  v_pending JSONB;
  v_compliant BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- Validar se o usuário é Master Admin ou pertence à empresa
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = p_company_id AND user_id = v_user_id AND is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, p_company_id, 'CHECK_REQUIRED_TERMS_UNAUTHORIZED_ATTEMPT', jsonb_build_object('company_id', p_company_id));

      RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado para consultar termos desta empresa.');
    END IF;
  END IF;

  -- Buscar apenas termos ativos vigentes ainda não aceitos pela empresa
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
    'success', true,
    'compliant', v_compliant,
    'pending_terms_count', jsonb_array_length(v_pending),
    'pending_terms', v_pending
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. TRIGGER PARA DESATIVAR VERSÕES ANTERIORES DO MESMO TERM_TYPE AO ATIVAR UM TERMO
CREATE OR REPLACE FUNCTION public.trg_enforce_single_active_term_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE public.platform_terms
    SET is_active = FALSE, updated_at = NOW()
    WHERE term_type = NEW.term_type AND id <> NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_single_active_term_version ON public.platform_terms;
CREATE TRIGGER trg_single_active_term_version
  BEFORE INSERT OR UPDATE OF is_active ON public.platform_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_single_active_term_version();

-- 3. TRIGGER DE IMUTABILIDADE REAL EM COMPANY_TERM_ACCEPTANCES (BLOQUEIA UPDATE E DELETE)
CREATE OR REPLACE FUNCTION public.trg_prevent_company_term_acceptances_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registros de aceite de termos de uso são históricos e imutáveis. Alterações ou exclusões são estritamente proibidas.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_company_term_acceptances_immutable ON public.company_term_acceptances;
CREATE TRIGGER trg_company_term_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.company_term_acceptances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_company_term_acceptances_mutation();
