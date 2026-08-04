-- ============================================================================
-- REDE INDOOR LOCAL - FASE 6B: CONTEÚDO INFORMATIVO MANUAL + RSS
-- Conteúdo operacional, sem qualquer vínculo financeiro/comercial.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source_name TEXT NOT NULL CHECK (char_length(trim(source_name)) BETWEEN 2 AND 120),
  source_url TEXT NOT NULL UNIQUE CHECK (source_url ~* '^https?://'),
  source_type TEXT NOT NULL DEFAULT 'rss' CHECK (source_type = 'rss'),
  category TEXT,
  region TEXT,
  city TEXT,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (refresh_interval_minutes BETWEEN 15 AND 1440),
  expiry_hours INTEGER NOT NULL DEFAULT 48 CHECK (expiry_hours BETWEEN 12 AND 168),
  requires_manual_approval BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.informative_content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  content_source_id UUID REFERENCES public.content_sources(id) ON DELETE SET NULL,
  content_origin TEXT NOT NULL CHECK (content_origin IN ('manual', 'rss')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 180),
  summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 500),
  body TEXT CHECK (body IS NULL OR char_length(body) <= 2000),
  category TEXT,
  image_url TEXT CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  source_name TEXT,
  original_url TEXT CHECK (original_url IS NULL OR original_url ~* '^https?://'),
  rss_dedupe_key TEXT,
  published_at TIMESTAMPTZ,
  region TEXT,
  city TEXT,
  segment TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 10 CHECK (duration_seconds BETWEEN 8 AND 15),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'active', 'paused', 'expired', 'archived')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CHECK (content_origin = 'rss' OR content_source_id IS NULL)
);

CREATE TABLE IF NOT EXISTS public.screen_content_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  enable_breathing_content BOOLEAN NOT NULL DEFAULT FALSE,
  enable_manual_content BOOLEAN NOT NULL DEFAULT TRUE,
  enable_rss_content BOOLEAN NOT NULL DEFAULT TRUE,
  ads_between_content INTEGER NOT NULL DEFAULT 4 CHECK (ads_between_content IN (3, 4, 5)),
  content_duration_seconds INTEGER NOT NULL DEFAULT 10 CHECK (content_duration_seconds BETWEEN 8 AND 15),
  allowed_categories TEXT[],
  fallback_to_ads BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_screen_content_settings_screen UNIQUE (screen_id)
);

CREATE TABLE IF NOT EXISTS public.screen_content_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('manual', 'rss')),
  content_id UUID NOT NULL REFERENCES public.informative_content_items(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'skipped', 'failed')),
  error_message TEXT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  player_session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_content_sources_active_refresh ON public.content_sources(is_active, last_fetched_at);
CREATE INDEX IF NOT EXISTS idx_informative_content_eligibility ON public.informative_content_items(is_active, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_informative_content_company ON public.informative_content_items(company_id);
CREATE INDEX IF NOT EXISTS idx_informative_content_category ON public.informative_content_items(category);
CREATE UNIQUE INDEX IF NOT EXISTS uq_informative_rss_dedupe
  ON public.informative_content_items(content_source_id, rss_dedupe_key)
  WHERE content_source_id IS NOT NULL AND rss_dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_screen_content_logs_company_created ON public.screen_content_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screen_content_logs_screen_created ON public.screen_content_logs(screen_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_phase6b_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_phase6b_tenant_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_screen_company UUID;
  v_content_company UUID;
BEGIN
  SELECT company_id INTO v_screen_company FROM public.screens WHERE id = NEW.screen_id;
  IF v_screen_company IS NULL OR v_screen_company <> NEW.company_id THEN
    RAISE EXCEPTION 'A tela não pertence à empresa informada.';
  END IF;

  IF TG_TABLE_NAME = 'screen_content_logs' THEN
    SELECT company_id INTO v_content_company FROM public.informative_content_items WHERE id = NEW.content_id;
    IF NOT FOUND OR (v_content_company IS NOT NULL AND v_content_company <> NEW.company_id) THEN
      RAISE EXCEPTION 'O conteúdo informativo não está disponível para a empresa da tela.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_content_sources_updated_at ON public.content_sources;
CREATE TRIGGER trg_content_sources_updated_at
  BEFORE UPDATE ON public.content_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_phase6b_updated_at();

DROP TRIGGER IF EXISTS trg_informative_content_updated_at ON public.informative_content_items;
CREATE TRIGGER trg_informative_content_updated_at
  BEFORE UPDATE ON public.informative_content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_phase6b_updated_at();

DROP TRIGGER IF EXISTS trg_screen_content_settings_updated_at ON public.screen_content_settings;
CREATE TRIGGER trg_screen_content_settings_updated_at
  BEFORE UPDATE ON public.screen_content_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_phase6b_updated_at();

DROP TRIGGER IF EXISTS trg_screen_content_settings_tenant ON public.screen_content_settings;
CREATE TRIGGER trg_screen_content_settings_tenant
  BEFORE INSERT OR UPDATE ON public.screen_content_settings
  FOR EACH ROW EXECUTE FUNCTION public.check_phase6b_tenant_integrity();

DROP TRIGGER IF EXISTS trg_screen_content_logs_tenant ON public.screen_content_logs;
CREATE TRIGGER trg_screen_content_logs_tenant
  BEFORE INSERT OR UPDATE ON public.screen_content_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_phase6b_tenant_integrity();

ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informative_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_content_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_content_logs ENABLE ROW LEVEL SECURITY;

-- Fontes RSS são globais e exclusivas do Master Admin.
CREATE POLICY "ContentSources - Master Admin Full Access"
  ON public.content_sources FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

-- Master acessa tudo; membros veem conteúdo próprio ou global já publicável.
CREATE POLICY "InformativeContent - Master Admin Full Access"
  ON public.informative_content_items FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

CREATE POLICY "InformativeContent - Company and Global Read"
  ON public.informative_content_items FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT public.get_user_company_ids())
    OR (
      company_id IS NULL
      AND is_active = TRUE
      AND status IN ('approved', 'active')
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY "InformativeContent - Company Admin Insert Manual"
  ON public.informative_content_items FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.get_user_admin_company_ids())
    AND content_origin = 'manual'
    AND content_source_id IS NULL
    AND created_by = auth.uid()
    AND status IN ('draft', 'pending_review', 'active', 'paused')
  );

CREATE POLICY "InformativeContent - Company Admin Update Manual"
  ON public.informative_content_items FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.get_user_admin_company_ids())
    AND content_origin = 'manual'
  )
  WITH CHECK (
    company_id IN (SELECT public.get_user_admin_company_ids())
    AND content_origin = 'manual'
    AND content_source_id IS NULL
    AND status IN ('draft', 'pending_review', 'active', 'paused', 'archived')
  );

-- Configuração isolada pela empresa/tela.
CREATE POLICY "ScreenContentSettings - Company Read"
  ON public.screen_content_settings FOR SELECT TO authenticated
  USING (public.is_master_admin() OR company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "ScreenContentSettings - Company Admin Manage"
  ON public.screen_content_settings FOR ALL TO authenticated
  USING (public.is_master_admin() OR company_id IN (SELECT public.get_user_admin_company_ids()))
  WITH CHECK (
    (public.is_master_admin() OR company_id IN (SELECT public.get_user_admin_company_ids()))
    AND EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = screen_id AND s.company_id = screen_content_settings.company_id
    )
  );

-- Logs são somente leitura para a empresa. Inserções do player passam por action
-- server-side com service_role após validação do token da tela.
CREATE POLICY "ScreenContentLogs - Master Admin Full Access"
  ON public.screen_content_logs FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

CREATE POLICY "ScreenContentLogs - Company Read"
  ON public.screen_content_logs FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

COMMENT ON TABLE public.screen_content_logs IS
  'Logs operacionais de conteúdo informativo. Não geram crédito, cobrança, payout ou entrega comercial.';
