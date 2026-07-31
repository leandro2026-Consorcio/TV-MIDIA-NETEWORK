-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 2D: RPC DE INGEST SEGURO (SECURITY DEFINER)
-- Data: 2026-07-31
-- ============================================================================

-- RPC SEGURA DE REGISTRO DE PLAYBACK LOG (PLAYERS ANÔNIMOS)
-- Executa com permissões elevadas de banco (SECURITY DEFINER SET search_path = public)
-- Valida obrigatoriamente Hash do Token, Empresa, Mídia Aprovada, Playlist Ativa e Item
CREATE OR REPLACE FUNCTION public.record_playback_log(
  p_device_token_hash TEXT,
  p_media_asset_id UUID,
  p_playlist_id UUID DEFAULT NULL,
  p_playlist_item_id UUID DEFAULT NULL,
  p_media_type TEXT DEFAULT 'image',
  p_planned_duration_seconds INTEGER DEFAULT 10,
  p_actual_duration_seconds NUMERIC DEFAULT NULL,
  p_started_at TIMESTAMPTZ DEFAULT NOW(),
  p_ended_at TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT 'completed',
  p_failure_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_player_session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_screen RECORD;
  v_active_playlist_id UUID;
  v_media RECORD;
  v_item RECORD;
  v_inserted_id UUID;
  v_failure_msg TEXT := p_failure_reason;
BEGIN
  -- 1. Validar chave de idempotência obrigatória
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Chave de idempotência (idempotency_key) não fornecida.';
  END IF;

  -- 2. Validar limites de duração e status
  IF p_planned_duration_seconds NOT IN (5, 10, 15, 30) THEN
    RAISE EXCEPTION 'Duração planejada inválida. Deve ser 5, 10, 15 ou 30 segundos.';
  END IF;

  IF p_actual_duration_seconds IS NOT NULL AND p_actual_duration_seconds < 0 THEN
    RAISE EXCEPTION 'Duração real não pode ser negativa.';
  END IF;

  IF p_status NOT IN ('started', 'completed', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'Status de exibição inválido.';
  END IF;

  IF p_status = 'failed' AND (v_failure_msg IS NULL OR length(trim(v_failure_msg)) = 0) THEN
    v_failure_msg := 'Erro indeterminado de reprodução ou mídia corrompida';
  END IF;

  -- 3. Buscar Tela pelo Hash SHA-256 no Banco
  SELECT id, company_id, status INTO v_screen
  FROM public.screens
  WHERE device_token_hash = p_device_token_hash;

  IF v_screen.id IS NULL THEN
    RAISE EXCEPTION 'Dispositivo não encontrado ou pareamento revogado.';
  END IF;

  IF v_screen.status = 'inactive' THEN
    RAISE EXCEPTION 'Dispositivo desativado pelo administrador.';
  END IF;

  -- 4. Buscar Playlist Ativa da Tela
  SELECT playlist_id INTO v_active_playlist_id
  FROM public.screen_playlists
  WHERE screen_id = v_screen.id AND is_active = TRUE
  LIMIT 1;

  IF v_active_playlist_id IS NULL THEN
    RAISE EXCEPTION 'A tela não possui nenhuma playlist ativa vinculada.';
  END IF;

  -- Se p_playlist_id for fornecido pelo client, deve bater com a playlist ativa da TV
  IF p_playlist_id IS NOT NULL AND p_playlist_id != v_active_playlist_id THEN
    RAISE EXCEPTION 'Violação de segurança: A playlist informada não é a playlist ativa desta tela.';
  END IF;

  -- 5. Validar Mídia (Mesma empresa, status = 'approved', media_type correto)
  SELECT id, company_id, status, media_type INTO v_media
  FROM public.media_assets
  WHERE id = p_media_asset_id;

  IF v_media.id IS NULL THEN
    RAISE EXCEPTION 'Mídia não encontrada.';
  END IF;

  IF v_media.company_id != v_screen.company_id THEN
    RAISE EXCEPTION 'Violação de segurança: A mídia informada não pertence à empresa do dispositivo.';
  END IF;

  IF v_media.status != 'approved' THEN
    RAISE EXCEPTION 'Integridade rejeitada: Não é possível registrar exibição de mídia não aprovada.';
  END IF;

  IF v_media.media_type != p_media_type THEN
    RAISE EXCEPTION 'Tipo de mídia divergente entre o payload e o banco de dados.';
  END IF;

  -- 6. Validar Item de Playlist (Se fornecido, deve pertencer à playlist ativa da TV e à mesma mídia)
  IF p_playlist_item_id IS NOT NULL THEN
    SELECT id, playlist_id, media_asset_id, playback_duration_seconds, is_active INTO v_item
    FROM public.playlist_items
    WHERE id = p_playlist_item_id;

    IF v_item.id IS NULL THEN
      RAISE EXCEPTION 'Item de playlist não encontrado.';
    END IF;

    IF v_item.playlist_id != v_active_playlist_id THEN
      RAISE EXCEPTION 'Violação de integridade: O item não pertence à playlist ativa desta tela.';
    END IF;

    IF v_item.media_asset_id != p_media_asset_id THEN
      RAISE EXCEPTION 'Violação de integridade: O item de playlist não corresponde à mídia informada.';
    END IF;

    IF NOT v_item.is_active THEN
      RAISE EXCEPTION 'Integridade rejeitada: O item de playlist informado está inativo.';
    END IF;

    IF v_item.playback_duration_seconds != p_planned_duration_seconds THEN
      RAISE EXCEPTION 'Duração planejada divergente do item de playlist.';
    END IF;
  ELSE
    -- Se playlist_item_id não foi enviado, confirmar ao menos que a mídia está na playlist ativa
    PERFORM 1 FROM public.playlist_items
    WHERE playlist_id = v_active_playlist_id AND media_asset_id = p_media_asset_id AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Integridade rejeitada: A mídia exibida não pertence à playlist ativa desta tela.';
    END IF;
  END IF;

  -- 7. Inserir com Desduplicação Automática (ON CONFLICT DO NOTHING)
  INSERT INTO public.playback_logs (
    company_id,
    screen_id,
    playlist_id,
    playlist_item_id,
    media_asset_id,
    media_type,
    planned_duration_seconds,
    actual_duration_seconds,
    started_at,
    ended_at,
    played_at,
    status,
    failure_reason,
    idempotency_key,
    player_session_id,
    device_token_hash,
    synced_at
  ) VALUES (
    v_screen.company_id,
    v_screen.id,
    v_active_playlist_id,
    p_playlist_item_id,
    p_media_asset_id,
    p_media_type,
    p_planned_duration_seconds,
    p_actual_duration_seconds,
    p_started_at,
    p_ended_at,
    NOW(),
    p_status,
    v_failure_msg,
    p_idempotency_key,
    p_player_session_id,
    p_device_token_hash,
    NOW()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  -- Retornar resultado seguro
  IF v_inserted_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', false,
      'log_id', v_inserted_id
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', true,
      'message', 'Log de exibição já registrado anteriormente (desduplicado).'
    );
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', true,
      'message', 'Log de exibição já registrado anteriormente (desduplicado).'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
