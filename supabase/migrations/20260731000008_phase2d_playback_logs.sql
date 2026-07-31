-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2D: PLAYBACK LOGS & PROOF OF PLAY
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE LOGS DE EXIBIÇÃO (PLAYBACK_LOGS)
CREATE TABLE IF NOT EXISTS public.playback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
  playlist_item_id UUID REFERENCES public.playlist_items(id) ON DELETE SET NULL,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  planned_duration_seconds INTEGER NOT NULL,
  actual_duration_seconds NUMERIC(6,2),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'skipped', 'failed')),
  failure_reason TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  player_session_id TEXT,
  device_token_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Alta Performance para Consultas e Desduplicação Rápida
CREATE INDEX IF NOT EXISTS idx_playback_logs_company_id ON public.playback_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_screen_id ON public.playback_logs(screen_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_media_asset_id ON public.playback_logs(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_played_at ON public.playback_logs(played_at);
CREATE INDEX IF NOT EXISTS idx_playback_logs_status ON public.playback_logs(status);
CREATE INDEX IF NOT EXISTS idx_playback_logs_idempotency_key ON public.playback_logs(idempotency_key);

-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.playback_logs ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS - PLAYBACK_LOGS
-- 3.1 LEITURA: Master Admin ou membros ativos (Admin e Operador) da mesma empresa
CREATE POLICY "PlaybackLogs - Leitura por membros da empresa ou Master Admin"
  ON public.playback_logs FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

-- 3.2 INSERÇÃO: Permitida para membros da empresa ou via Server Actions (Security Definer)
CREATE POLICY "PlaybackLogs - Inserção autenticada por empresa ou Master Admin"
  ON public.playback_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );
