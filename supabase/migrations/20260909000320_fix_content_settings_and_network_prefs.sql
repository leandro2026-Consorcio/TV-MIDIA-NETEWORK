-- ============================================================================
-- MIGRACAO INCREMENTAL: CORRECAO DE CONSTRAINTS, FONTES DE CONTEUDO E CONVITES VIP
-- Data: 2026-09-09
-- ============================================================================

-- 1. CORRECAO DA CONSTRAINT EM screen_content_settings
-- Permite que mix_interval e ads_between_content aceitem opcoes de 1 a 5
ALTER TABLE public.screen_content_settings 
  DROP CONSTRAINT IF EXISTS screen_content_settings_ads_between_content_check;

ALTER TABLE public.screen_content_settings 
  ADD CONSTRAINT screen_content_settings_ads_between_content_check 
  CHECK (ads_between_content BETWEEN 1 AND 5);

ALTER TABLE public.screen_content_settings
  ADD COLUMN IF NOT EXISTS allowed_source_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- 2. SUPORTE A FONTES PRIVADAS POR EMPRESA EM content_sources
ALTER TABLE public.content_sources
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suggested_for_catalog BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_content_sources_company_id ON public.content_sources(company_id);
CREATE INDEX IF NOT EXISTS idx_content_sources_private ON public.content_sources(is_private, is_active);

-- Atualizacao das politicas RLS para content_sources
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ContentSources - Leitura publica de ativas" ON public.content_sources;
DROP POLICY IF EXISTS "ContentSources - Leitura autenticada" ON public.content_sources;
CREATE POLICY "ContentSources - Leitura autenticada"
  ON public.content_sources FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR (is_private = FALSE AND is_active = TRUE)
    OR (is_private = TRUE AND company_id IN (SELECT public.get_user_company_ids()))
  );

DROP POLICY IF EXISTS "ContentSources - Insercao por empresa ou Master" ON public.content_sources;
CREATE POLICY "ContentSources - Insercao por empresa ou Master"
  ON public.content_sources FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master_admin()
    OR (is_private = TRUE AND company_id IN (SELECT public.get_user_company_ids()))
  );

DROP POLICY IF EXISTS "ContentSources - Atualizacao por empresa ou Master" ON public.content_sources;
CREATE POLICY "ContentSources - Atualizacao por empresa ou Master"
  ON public.content_sources FOR UPDATE TO authenticated
  USING (
    public.is_master_admin()
    OR (is_private = TRUE AND company_id IN (SELECT public.get_user_company_ids()))
  )
  WITH CHECK (
    public.is_master_admin()
    OR (is_private = TRUE AND company_id IN (SELECT public.get_user_company_ids()))
  );

DROP POLICY IF EXISTS "ContentSources - Delecao por empresa ou Master" ON public.content_sources;
CREATE POLICY "ContentSources - Delecao por empresa ou Master"
  ON public.content_sources FOR DELETE TO authenticated
  USING (
    public.is_master_admin()
    OR (is_private = TRUE AND company_id IN (SELECT public.get_user_company_ids()))
  );

-- 3. CONFIGURACOES DA PLATAFORMA PARA CONVITES VIP E BENEFICIOS
INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('minimum_vip_invites', '3'::jsonb, 'Quantidade minima de convites VIP mantidos disponiveis para empresas elegiveis.'),
  ('vip_invite_referred_benefit', '{"type": "none", "value": 0}'::jsonb, 'Beneficio promocional concedido a empresa indicada.'),
  ('vip_invite_referrer_reward', '{"type": "monthly_fee", "quantity": 1}'::jsonb, 'Recompensa da empresa que indica apos confirmacao de elegibilidade.'),
  ('vip_invite_message_template', '"Ola! Quero te convidar para conhecer o Midia por Midia, uma rede que transforma TVs comerciais em midia compartilhada e ajuda empresas a divulgar seus negocios em varios pontos da cidade.\n\nUse meu convite para conhecer a plataforma:\n{{link}}"'::jsonb, 'Modelo de mensagem padrao para compartilhamento de convite VIP.')
ON CONFLICT (key) DO NOTHING;
