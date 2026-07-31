-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2C: HARDENING DE BANCO, TRIGGERS E INTEGRIDADE
-- Data: 2026-07-31
-- ============================================================================

-- 1. TRIGGER DE INTEGRIDADE PARA PLAYLIST_ITEMS
-- Impede inclusão de mídias de outras empresas ou com status diferente de 'approved'
CREATE OR REPLACE FUNCTION public.check_playlist_item_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_playlist_company_id UUID;
  v_media RECORD;
BEGIN
  -- Buscar a empresa da playlist
  SELECT company_id INTO v_playlist_company_id FROM public.playlists WHERE id = NEW.playlist_id;
  IF v_playlist_company_id IS NULL THEN
    RAISE EXCEPTION 'Playlist não encontrada.';
  END IF;

  -- Buscar a mídia
  SELECT company_id, status INTO v_media FROM public.media_assets WHERE id = NEW.media_asset_id;
  IF v_media.company_id IS NULL THEN
    RAISE EXCEPTION 'Mídia não encontrada.';
  END IF;

  -- 1. Validar empresa igual
  IF v_media.company_id != v_playlist_company_id THEN
    RAISE EXCEPTION 'Violação de segurança no banco: A mídia deve pertencer à mesma empresa da playlist.';
  END IF;

  -- 2. Validar status obrigatoriamente 'approved'
  IF v_media.status != 'approved' THEN
    RAISE EXCEPTION 'Violação de integridade no banco: Apenas mídias com status Aprovada podem ser inseridas na playlist.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_playlist_item_integrity ON public.playlist_items;
CREATE TRIGGER trg_check_playlist_item_integrity
  BEFORE INSERT OR UPDATE ON public.playlist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_playlist_item_integrity();

-- 2. TRIGGER DE INTEGRIDADE PARA SCREEN_PLAYLISTS
-- Impede atribuição de playlist de outra empresa a uma TV
CREATE OR REPLACE FUNCTION public.check_screen_playlist_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_screen_company_id UUID;
  v_playlist_company_id UUID;
BEGIN
  SELECT company_id INTO v_screen_company_id FROM public.screens WHERE id = NEW.screen_id;
  SELECT company_id INTO v_playlist_company_id FROM public.playlists WHERE id = NEW.playlist_id;

  IF v_screen_company_id IS NULL OR v_playlist_company_id IS NULL THEN
    RAISE EXCEPTION 'Tela ou Playlist não encontrada.';
  END IF;

  IF v_screen_company_id != v_playlist_company_id THEN
    RAISE EXCEPTION 'Violação de segurança no banco: Tela e Playlist devem pertencer à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_screen_playlist_integrity ON public.screen_playlists;
CREATE TRIGGER trg_check_screen_playlist_integrity
  BEFORE INSERT OR UPDATE ON public.screen_playlists
  FOR EACH ROW
  EXECUTE FUNCTION public.check_screen_playlist_integrity();

-- 3. RPC ATÔMICA: ATRIBUIR PLAYLIST À TELA (DESATIVA ANTERIORES E ATIVA NOVA)
CREATE OR REPLACE FUNCTION public.assign_playlist_to_screen(
  p_screen_id UUID,
  p_playlist_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_screen RECORD;
  v_playlist RECORD;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- 1. Autenticação do usuário
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 2. Buscar Tela e Playlist
  SELECT * INTO v_screen FROM public.screens WHERE id = p_screen_id;
  SELECT * INTO v_playlist FROM public.playlists WHERE id = p_playlist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tela ou Playlist não encontrada.';
  END IF;

  -- 3. Validar mesma empresa no banco
  IF v_screen.company_id != v_playlist.company_id THEN
    RAISE EXCEPTION 'A tela e a playlist devem pertencer à mesma empresa.';
  END IF;

  -- 4. Validar permissão (Admin da Empresa ou Master Admin)
  IF is_master_admin() THEN
    v_is_admin := TRUE;
  ELSE
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.company_users
    WHERE company_id = v_screen.company_id AND user_id = auth.uid() AND is_active = TRUE;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores da empresa ou Master Admin podem atribuir playlists a telas.';
  END IF;

  -- 5. Troca Atômica: Desativar vínculos anteriores da tela
  UPDATE public.screen_playlists
  SET is_active = FALSE
  WHERE screen_id = p_screen_id;

  -- 6. Inserir novo vínculo ativo
  INSERT INTO public.screen_playlists (screen_id, playlist_id, is_active, assigned_by)
  VALUES (p_screen_id, p_playlist_id, TRUE, auth.uid());

  -- 7. Registrar Auditoria
  PERFORM public.log_audit_event(
    auth.uid(),
    v_screen.company_id,
    'SCREEN_PLAYLIST_ASSIGNED',
    jsonb_build_object('screen_id', p_screen_id, 'playlist_id', p_playlist_id, 'playlist_name', v_playlist.name)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
