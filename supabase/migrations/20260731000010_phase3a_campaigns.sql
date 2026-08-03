-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3A: CAMPANHAS INTERNAS E PACOTES DE INSERÇÃO
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE CAMPANHAS (CAMPAIGNS)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'internal' CHECK (campaign_type IN ('internal', 'paid', 'exchange', 'external')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled', 'archived')),
  start_date DATE,
  end_date DATE,
  target_insertions INTEGER CHECK (target_insertions IS NULL OR target_insertions > 0),
  delivered_insertions INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON public.campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.campaigns(campaign_type);

-- 2. TABELA ASSOCIATIVA MÍDIAS DA CAMPANHA (CAMPAIGN_MEDIA)
CREATE TABLE IF NOT EXISTS public.campaign_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  playback_duration_seconds INTEGER NOT NULL CHECK (playback_duration_seconds IN (5, 10, 15, 30)),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_campaign_media UNIQUE (campaign_id, media_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_media_campaign_id ON public.campaign_media(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_media_media_asset_id ON public.campaign_media(media_asset_id);

-- 3. TABELA ASSOCIATIVA TELAS DA CAMPANHA (CAMPAIGN_SCREENS)
CREATE TABLE IF NOT EXISTS public.campaign_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_campaign_screens UNIQUE (campaign_id, screen_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_screens_campaign_id ON public.campaign_screens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_screens_screen_id ON public.campaign_screens(screen_id);

-- 4. TRIGGERS DE INTEGRIDADE DE BANCO

-- 4.1 Trigger para Validação da Campanha (Datas e Tipo Interno)
CREATE OR REPLACE FUNCTION public.check_campaign_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar Datas
  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    IF NEW.end_date < NEW.start_date THEN
      RAISE EXCEPTION 'A data de término não pode ser anterior à data de início.';
    END IF;
  END IF;

  -- No MVP 3A, apenas campanhas do tipo 'internal' são permitidas
  IF NEW.campaign_type != 'internal' THEN
    RAISE EXCEPTION 'Apenas campanhas do tipo internas (internal) são permitidas no MVP 3A.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_integrity ON public.campaigns;
CREATE TRIGGER trg_check_campaign_integrity
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_integrity();

-- 4.2 Trigger para Mídias da Campanha (Empresa Igual e Status Approved)
CREATE OR REPLACE FUNCTION public.check_campaign_media_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_company_id UUID;
  v_media RECORD;
BEGIN
  SELECT company_id INTO v_campaign_company_id FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT company_id, status INTO v_media FROM public.media_assets WHERE id = NEW.media_asset_id;

  IF v_campaign_company_id IS NULL OR v_media.company_id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou Mídia não encontrada.';
  END IF;

  IF v_media.company_id != v_campaign_company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A mídia deve pertencer à mesma empresa da campanha.';
  END IF;

  IF v_media.status != 'approved' THEN
    RAISE EXCEPTION 'Integridade rejeitada: Apenas mídias com status Aprovada podem ser vinculadas à campanha.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_media_integrity ON public.campaign_media;
CREATE TRIGGER trg_check_campaign_media_integrity
  BEFORE INSERT OR UPDATE ON public.campaign_media
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_media_integrity();

-- 4.3 Trigger para Telas da Campanha (Empresa Igual)
CREATE OR REPLACE FUNCTION public.check_campaign_screen_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_company_id UUID;
  v_screen_company_id UUID;
BEGIN
  SELECT company_id INTO v_campaign_company_id FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT company_id INTO v_screen_company_id FROM public.screens WHERE id = NEW.screen_id;

  IF v_campaign_company_id IS NULL OR v_screen_company_id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou Tela não encontrada.';
  END IF;

  IF v_screen_company_id != v_campaign_company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A tela deve pertencer à mesma empresa da campanha.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_campaign_screen_integrity ON public.campaign_screens;
CREATE TRIGGER trg_check_campaign_screen_integrity
  BEFORE INSERT OR UPDATE ON public.campaign_screens
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_screen_integrity();

-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_screens ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS - CAMPAIGNS
DROP POLICY IF EXISTS "Campaigns - Leitura por membros da empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Leitura por membros da empresa ou Master Admin"
  ON public.campaigns FOR SELECT TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Campaigns - Inserção por membros da empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Inserção por membros da empresa ou Master Admin"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Campaigns - Edição por membros da empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Edição por membros da empresa ou Master Admin"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Campaigns - Exclusão por Admins da Empresa ou Master Admin" ON public.campaigns;
CREATE POLICY "Campaigns - Exclusão por Admins da Empresa ou Master Admin"
  ON public.campaigns FOR DELETE TO authenticated
  USING (is_master_admin() OR company_id IN (SELECT public.get_user_admin_company_ids()));

-- POLÍTICAS RLS - CAMPAIGN_MEDIA & CAMPAIGN_SCREENS
DROP POLICY IF EXISTS "CampaignMedia - Leitura por membros da empresa ou Master Admin" ON public.campaign_media;
CREATE POLICY "CampaignMedia - Leitura por membros da empresa ou Master Admin"
  ON public.campaign_media FOR SELECT TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));

DROP POLICY IF EXISTS "CampaignMedia - Gerenciamento por membros da empresa ou Master Admin" ON public.campaign_media;
CREATE POLICY "CampaignMedia - Gerenciamento por membros da empresa ou Master Admin"
  ON public.campaign_media FOR ALL TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));

DROP POLICY IF EXISTS "CampaignScreens - Leitura por membros da empresa ou Master Admin" ON public.campaign_screens;
CREATE POLICY "CampaignScreens - Leitura por membros da empresa ou Master Admin"
  ON public.campaign_screens FOR SELECT TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));

DROP POLICY IF EXISTS "CampaignScreens - Gerenciamento por membros da empresa ou Master Admin" ON public.campaign_screens;
CREATE POLICY "CampaignScreens - Gerenciamento por membros da empresa ou Master Admin"
  ON public.campaign_screens FOR ALL TO authenticated
  USING (is_master_admin() OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())));
