-- Midias acima de 30 segundos sao exclusivas das telas da propria empresa.
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS owner_only BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.media_assets.owner_only IS
  'Midia exclusiva para playlists e campanhas internas da empresa proprietaria.';

UPDATE public.media_assets
SET owner_only = TRUE
WHERE playback_duration_seconds > 30;

ALTER TABLE public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_playback_duration_seconds_check;
ALTER TABLE public.media_assets
  ADD CONSTRAINT media_assets_playback_duration_seconds_check CHECK (
    (NOT owner_only AND playback_duration_seconds IN (5, 10, 15, 30))
    OR (owner_only AND playback_duration_seconds BETWEEN 5 AND 3600 AND playback_duration_seconds % 5 = 0)
  );

ALTER TABLE public.playlist_items
  DROP CONSTRAINT IF EXISTS playlist_items_playback_duration_seconds_check;
ALTER TABLE public.playlist_items
  ADD CONSTRAINT playlist_items_playback_duration_seconds_check
  CHECK (playback_duration_seconds BETWEEN 5 AND 3600 AND playback_duration_seconds % 5 = 0);

ALTER TABLE public.campaign_media
  DROP CONSTRAINT IF EXISTS campaign_media_playback_duration_seconds_check;
ALTER TABLE public.campaign_media
  ADD CONSTRAINT campaign_media_playback_duration_seconds_check
  CHECK (playback_duration_seconds BETWEEN 5 AND 3600 AND playback_duration_seconds % 5 = 0);

CREATE OR REPLACE FUNCTION public.enforce_internal_media_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_internal_only BOOLEAN;
  v_campaign_type TEXT;
BEGIN
  IF TG_TABLE_NAME = 'ad_offer_orders' AND NEW.requested_media_asset_id IS NOT NULL THEN
    SELECT COALESCE(trial_internal_only, FALSE) OR COALESCE(owner_only, FALSE)
      INTO v_internal_only
    FROM public.media_assets
    WHERE id = NEW.requested_media_asset_id;
    IF COALESCE(v_internal_only, FALSE) THEN
      RAISE EXCEPTION 'Midia exclusiva da empresa nao pode ser usada no marketplace.';
    END IF;
  ELSIF TG_TABLE_NAME = 'campaign_media' THEN
    SELECT COALESCE(m.trial_internal_only, FALSE) OR COALESCE(m.owner_only, FALSE), c.campaign_type
      INTO v_internal_only, v_campaign_type
    FROM public.media_assets m
    CROSS JOIN public.campaigns c
    WHERE m.id = NEW.media_asset_id AND c.id = NEW.campaign_id;
    IF COALESCE(v_internal_only, FALSE) AND COALESCE(v_campaign_type, '') <> 'internal' THEN
      RAISE EXCEPTION 'Midia exclusiva da empresa so pode ser usada em campanhas internas.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_trial_media_marketplace ON public.ad_offer_orders;
DROP TRIGGER IF EXISTS trg_block_internal_media_marketplace ON public.ad_offer_orders;
CREATE TRIGGER trg_block_internal_media_marketplace
  BEFORE INSERT OR UPDATE OF requested_media_asset_id ON public.ad_offer_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_internal_media_scope();

DROP TRIGGER IF EXISTS trg_block_trial_media_commercial_campaign ON public.campaign_media;
DROP TRIGGER IF EXISTS trg_block_internal_media_commercial_campaign ON public.campaign_media;
CREATE TRIGGER trg_block_internal_media_commercial_campaign
  BEFORE INSERT OR UPDATE OF media_asset_id, campaign_id ON public.campaign_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_internal_media_scope();

CREATE OR REPLACE FUNCTION public.enforce_organic_campaign_media_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.campaigns c
    LEFT JOIN public.campaign_media cm ON cm.campaign_id=c.id AND cm.is_active
    LEFT JOIN public.media_assets m ON m.id=cm.media_asset_id
    WHERE c.id=NEW.campaign_id
      AND (c.campaign_type='internal' OR COALESCE(m.owner_only,FALSE) OR COALESCE(m.trial_internal_only,FALSE))
  ) THEN
    RAISE EXCEPTION 'Campanha interna ou com midia exclusiva nao pode entrar na Rede Organica.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_organic_campaign_media_scope ON public.organic_campaign_rewards;
CREATE TRIGGER trg_enforce_organic_campaign_media_scope
  BEFORE INSERT OR UPDATE OF campaign_id ON public.organic_campaign_rewards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organic_campaign_media_scope();

CREATE OR REPLACE FUNCTION public.enforce_organic_campaign_media_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.campaigns c
    LEFT JOIN public.campaign_media cm ON cm.campaign_id = c.id AND cm.is_active
    LEFT JOIN public.media_assets m ON m.id = cm.media_asset_id
    WHERE c.id = NEW.campaign_id
      AND (c.campaign_type = 'internal' OR COALESCE(m.owner_only, FALSE) OR COALESCE(m.trial_internal_only, FALSE))
  ) THEN
    RAISE EXCEPTION 'Campanha interna ou com midia exclusiva nao pode entrar na Rede Organica.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_organic_campaign_media_scope ON public.organic_campaign_rewards;
CREATE TRIGGER trg_enforce_organic_campaign_media_scope
  BEFORE INSERT OR UPDATE OF campaign_id ON public.organic_campaign_rewards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organic_campaign_media_scope();

-- A RPC original tinha uma lista fixa de 5, 10, 15 e 30 segundos.
-- Esta versao mantem toda a validacao de origem e aceita slots internos longos.
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
  v_media RECORD;
  v_item RECORD;
  v_log_id UUID;
BEGIN
  IF p_planned_duration_seconds < 5 OR p_planned_duration_seconds > 3600 OR p_planned_duration_seconds % 5 <> 0 THEN
    RAISE EXCEPTION 'Duracao planejada invalida. Use multiplos de 5 segundos, entre 5 e 3600.';
  END IF;
  IF p_status NOT IN ('started', 'completed', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'Status de exibicao invalido.';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Chave de idempotencia obrigatoria.';
  END IF;

  SELECT id, company_id, status INTO v_screen
  FROM public.screens WHERE device_token_hash = p_device_token_hash;
  IF v_screen.id IS NULL OR v_screen.status = 'inactive' THEN
    RAISE EXCEPTION 'Dispositivo invalido ou inativo.';
  END IF;

  SELECT id, company_id, status, media_type INTO v_media
  FROM public.media_assets WHERE id = p_media_asset_id;
  IF v_media.id IS NULL OR v_media.status <> 'approved' OR v_media.media_type <> p_media_type THEN
    RAISE EXCEPTION 'Midia invalida, nao aprovada ou com tipo divergente.';
  END IF;
  IF v_media.company_id <> v_screen.company_id THEN
    RAISE EXCEPTION 'Midia e tela pertencem a empresas diferentes.';
  END IF;

  IF p_playlist_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.screen_playlists sp
      JOIN public.playlists p ON p.id = sp.playlist_id
      WHERE sp.screen_id = v_screen.id AND sp.playlist_id = p_playlist_id
        AND sp.is_active AND p.status = 'active' AND p.company_id = v_screen.company_id
    ) THEN RAISE EXCEPTION 'Playlist nao esta ativa para esta tela.'; END IF;

    SELECT id, playlist_id, media_asset_id, playback_duration_seconds, is_active INTO v_item
    FROM public.playlist_items
    WHERE playlist_id = p_playlist_id AND media_asset_id = p_media_asset_id
      AND (p_playlist_item_id IS NULL OR id = p_playlist_item_id)
      AND is_active
    ORDER BY sort_order LIMIT 1;
    IF v_item.id IS NULL OR v_item.playback_duration_seconds <> p_planned_duration_seconds THEN
      RAISE EXCEPTION 'Item ou duracao divergente da playlist.';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.campaign_screens cs
      JOIN public.campaigns c ON c.id = cs.campaign_id
      JOIN public.campaign_media cm ON cm.campaign_id = c.id
      WHERE cs.screen_id = v_screen.id AND cm.media_asset_id = p_media_asset_id
        AND cs.is_active AND cm.is_active AND cm.playback_duration_seconds = p_planned_duration_seconds
        AND c.status = 'active'
    ) THEN RAISE EXCEPTION 'Campanha nao esta ativa para esta tela e midia.'; END IF;
  END IF;

  INSERT INTO public.playback_logs (
    company_id, screen_id, media_asset_id, playlist_id, playlist_item_id,
    media_type, planned_duration_seconds, actual_duration_seconds, started_at,
    ended_at, played_at, status, failure_reason, idempotency_key,
    player_session_id, device_token_hash, synced_at
  ) VALUES (
    v_screen.company_id, v_screen.id, p_media_asset_id, p_playlist_id, p_playlist_item_id,
    p_media_type, p_planned_duration_seconds, p_actual_duration_seconds, p_started_at,
    p_ended_at, NOW(), p_status, p_failure_reason, p_idempotency_key,
    p_player_session_id, p_device_token_hash, NOW()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_log_id;

  UPDATE public.screens SET last_ping_at = NOW(), updated_at = NOW() WHERE id = v_screen.id;
  RETURN jsonb_build_object('success', TRUE, 'playback_log_id', v_log_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.record_playback_log(TEXT,UUID,UUID,UUID,TEXT,INTEGER,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_playback_log(TEXT,UUID,UUID,UUID,TEXT,INTEGER,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) TO service_role;
