-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2C: PLAYLISTS, ITENS E ATRIBUIÇÃO A TELAS
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE PLAYLISTS
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK (orientation IN ('horizontal', 'vertical', 'mixed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_company_id ON public.playlists(company_id);
CREATE INDEX IF NOT EXISTS idx_playlists_status ON public.playlists(status);

-- 2. TABELA DE ITENS DA PLAYLIST (PLAYLIST_ITEMS)
CREATE TABLE IF NOT EXISTS public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  playback_duration_seconds INTEGER NOT NULL CHECK (playback_duration_seconds IN (5, 10, 15, 30)),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON public.playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_sort_order ON public.playlist_items(playlist_id, sort_order);

-- 3. TABELA DE VÍNCULO DE PLAYLIST E TELA (SCREEN_PLAYLISTS)
CREATE TABLE IF NOT EXISTS public.screen_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Garantir que cada tela possui no máximo UMA playlist ativa por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_screen_playlists_active_screen 
  ON public.screen_playlists(screen_id) 
  WHERE (is_active = TRUE);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_playlists ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS RLS - PLAYLISTS
CREATE POLICY "Playlists - Leitura por membros da empresa ou Master Admin"
  ON public.playlists FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

CREATE POLICY "Playlists - Inserção por membros da empresa ou Master Admin"
  ON public.playlists FOR INSERT TO authenticated
  WITH CHECK (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

CREATE POLICY "Playlists - Edição por membros da empresa ou Master Admin"
  ON public.playlists FOR UPDATE TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT public.get_user_company_ids())
  );

CREATE POLICY "Playlists - Exclusão por Admins da Empresa ou Master Admin"
  ON public.playlists FOR DELETE TO authenticated
  USING (
    is_master_admin() OR 
    company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE)
  );

-- 6. POLÍTICAS RLS - PLAYLIST_ITEMS
CREATE POLICY "PlaylistItems - Leitura por membros da empresa ou Master Admin"
  ON public.playlist_items FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    playlist_id IN (SELECT id FROM public.playlists WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

CREATE POLICY "PlaylistItems - Gerenciamento por membros da empresa ou Master Admin"
  ON public.playlist_items FOR ALL TO authenticated
  USING (
    is_master_admin() OR 
    playlist_id IN (SELECT id FROM public.playlists WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

-- 7. POLÍTICAS RLS - SCREEN_PLAYLISTS
CREATE POLICY "ScreenPlaylists - Leitura por membros da empresa ou Master Admin"
  ON public.screen_playlists FOR SELECT TO authenticated
  USING (
    is_master_admin() OR 
    screen_id IN (SELECT id FROM public.screens WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

CREATE POLICY "ScreenPlaylists - Atribuição por Admins da Empresa ou Master Admin"
  ON public.screen_playlists FOR ALL TO authenticated
  USING (
    is_master_admin() OR 
    screen_id IN (SELECT id FROM public.screens WHERE company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE))
  );
