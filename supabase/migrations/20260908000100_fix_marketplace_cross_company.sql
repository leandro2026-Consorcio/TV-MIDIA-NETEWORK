-- PACOTE 1: autorização explícita de campanhas comerciais cross-company.
-- Mantém campanhas internas estritamente no tenant e exige um pedido pago/aprovado
-- para qualquer combinação anunciante -> mídia -> tela da exibidora.

-- A integração Asaas já usa estes estados no código e nas RPCs desde a Fase 5A,
-- mas as constraints originais de Fase 3D não foram ampliadas nas migrations
-- versionadas. Sem esta correção, cobrança e webhook falham antes da conversão.
ALTER TABLE public.ad_offer_orders
  DROP CONSTRAINT IF EXISTS ad_offer_orders_status_check;
ALTER TABLE public.ad_offer_orders
  ADD CONSTRAINT ad_offer_orders_status_check CHECK (
    status IN (
      'draft', 'requested', 'approved', 'rejected', 'cancelled',
      'pending_asaas', 'paid_manual', 'paid_asaas', 'converted_to_campaign'
    )
  );

ALTER TABLE public.ad_offer_orders
  DROP CONSTRAINT IF EXISTS ad_offer_orders_payment_status_check;
ALTER TABLE public.ad_offer_orders
  ADD CONSTRAINT ad_offer_orders_payment_status_check CHECK (
    payment_status IN (
      'not_required', 'pending', 'pending_asaas', 'paid_manual', 'paid_asaas',
      'failed', 'overdue', 'refunded', 'cancelled'
    )
  );

CREATE OR REPLACE FUNCTION public.is_authorized_commercial_distribution(
  p_campaign_id UUID,
  p_screen_id UUID,
  p_media_asset_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns c
    JOIN public.ad_offer_orders o ON o.id = c.ad_offer_order_id
    JOIN public.screens s ON s.id = p_screen_id
    JOIN public.media_assets m ON m.id = p_media_asset_id
    JOIN public.campaign_screens cs
      ON cs.campaign_id = c.id AND cs.screen_id = s.id AND cs.is_active
    JOIN public.campaign_media cm
      ON cm.campaign_id = c.id AND cm.media_asset_id = m.id AND cm.is_active
    WHERE c.id = p_campaign_id
      AND c.campaign_type IN ('marketplace', 'commercial')
      AND c.status = 'active'
      AND c.company_id = o.buyer_company_id
      AND c.buyer_company_id = o.buyer_company_id
      AND c.seller_company_id = o.seller_company_id
      AND o.buyer_company_id IS NOT NULL
      AND o.approval_status = 'approved'
      AND o.payment_status IN ('paid_manual', 'paid_asaas')
      AND o.status = 'converted_to_campaign'
      AND o.campaign_id = c.id
      AND o.requested_media_asset_id = m.id
      AND m.company_id = o.buyer_company_id
      AND m.status = 'approved'
      AND NOT COALESCE(m.owner_only, FALSE)
      AND NOT COALESCE(m.trial_internal_only, FALSE)
      AND s.company_id = o.seller_company_id
      AND s.status <> 'inactive'
      AND (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
  );
$$;

REVOKE ALL ON FUNCTION public.is_authorized_commercial_distribution(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_authorized_commercial_distribution(UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.check_campaign_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.ad_offer_orders%ROWTYPE;
BEGIN
  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'A data de término não pode ser anterior à data de início.';
  END IF;

  IF NEW.campaign_type = 'internal' THEN
    IF NEW.ad_offer_order_id IS NOT NULL OR NEW.buyer_company_id IS NOT NULL OR NEW.seller_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Campanha interna não pode carregar autoridade comercial cross-company.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.campaign_type NOT IN ('marketplace', 'commercial') THEN
    RAISE EXCEPTION 'Tipo de campanha ainda não habilitado neste fluxo: %.', NEW.campaign_type;
  END IF;

  IF NEW.ad_offer_order_id IS NULL THEN
    RAISE EXCEPTION 'Campanha comercial exige pedido autorizador.';
  END IF;

  SELECT * INTO v_order
  FROM public.ad_offer_orders
  WHERE id = NEW.ad_offer_order_id
  FOR SHARE;

  IF NOT FOUND
     OR v_order.buyer_company_id IS NULL
     OR NEW.company_id <> v_order.buyer_company_id
     OR NEW.buyer_company_id <> v_order.buyer_company_id
     OR NEW.seller_company_id <> v_order.seller_company_id THEN
    RAISE EXCEPTION 'Autoridade comercial cross-company inválida ou inativa.';
  END IF;

  -- Uma campanha pode sempre ser encerrada defensivamente depois de estorno ou
  -- cancelamento do pedido. Qualquer criação ou atualização não terminal ainda
  -- exige autoridade comercial ativa.
  IF (TG_OP = 'INSERT' OR NEW.status NOT IN ('cancelled', 'archived')) AND (
       v_order.approval_status <> 'approved'
       OR v_order.payment_status NOT IN ('paid_manual', 'paid_asaas')
       OR v_order.status NOT IN ('paid_manual', 'paid_asaas', 'converted_to_campaign')
     ) THEN
    RAISE EXCEPTION 'Autoridade comercial cross-company inválida ou inativa.';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.company_id IS DISTINCT FROM OLD.company_id OR
    NEW.buyer_company_id IS DISTINCT FROM OLD.buyer_company_id OR
    NEW.seller_company_id IS DISTINCT FROM OLD.seller_company_id OR
    NEW.ad_offer_order_id IS DISTINCT FROM OLD.ad_offer_order_id OR
    NEW.campaign_type IS DISTINCT FROM OLD.campaign_type
  ) THEN
    RAISE EXCEPTION 'A autoridade comercial da campanha é imutável.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_campaign_media_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_media public.media_assets%ROWTYPE;
  v_order public.ad_offer_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT * INTO v_media FROM public.media_assets WHERE id = NEW.media_asset_id;

  IF NOT FOUND OR v_campaign.id IS NULL OR v_media.id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou mídia não encontrada.';
  END IF;
  IF v_campaign.status IN ('archived', 'completed', 'cancelled') AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Não é possível alterar mídias de campanha encerrada.';
  END IF;
  IF v_media.status <> 'approved' THEN
    RAISE EXCEPTION 'Apenas mídias aprovadas podem ser vinculadas.';
  END IF;

  IF v_campaign.campaign_type = 'internal' THEN
    IF v_media.company_id <> v_campaign.company_id THEN
      RAISE EXCEPTION 'Campanha interna só aceita mídia do próprio tenant.';
    END IF;
  ELSE
    SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = v_campaign.ad_offer_order_id;
    IF v_order.id IS NULL
       OR v_order.buyer_company_id IS NULL
       OR v_media.company_id <> v_order.buyer_company_id
       OR v_media.id <> v_order.requested_media_asset_id
       OR v_order.approval_status <> 'approved'
       OR v_order.payment_status NOT IN ('paid_manual', 'paid_asaas')
       OR v_order.status NOT IN ('paid_manual', 'paid_asaas', 'converted_to_campaign')
       OR COALESCE(v_media.owner_only, FALSE)
       OR COALESCE(v_media.trial_internal_only, FALSE) THEN
      RAISE EXCEPTION 'Mídia não autorizada pelo pedido comercial.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_campaign_screen_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_screen public.screens%ROWTYPE;
  v_order public.ad_offer_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT * INTO v_screen FROM public.screens WHERE id = NEW.screen_id;
  IF v_campaign.id IS NULL OR v_screen.id IS NULL THEN
    RAISE EXCEPTION 'Campanha ou tela não encontrada.';
  END IF;
  IF v_campaign.status IN ('archived', 'completed', 'cancelled') AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Não é possível alterar telas de campanha encerrada.';
  END IF;

  IF v_campaign.campaign_type = 'internal' THEN
    IF v_screen.company_id <> v_campaign.company_id THEN
      RAISE EXCEPTION 'Campanha interna só pode usar tela do próprio tenant.';
    END IF;
  ELSE
    SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = v_campaign.ad_offer_order_id;
    IF v_order.id IS NULL
       OR v_screen.company_id <> v_order.seller_company_id
       OR v_order.approval_status <> 'approved'
       OR v_order.payment_status NOT IN ('paid_manual', 'paid_asaas')
       OR v_order.status NOT IN ('paid_manual', 'paid_asaas', 'converted_to_campaign') THEN
      RAISE EXCEPTION 'Tela não autorizada pela empresa exibidora do pedido.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_playback_distribution_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_screen_company UUID;
  v_media_company UUID;
BEGIN
  SELECT company_id INTO v_screen_company FROM public.screens WHERE id = NEW.screen_id;
  SELECT company_id INTO v_media_company FROM public.media_assets WHERE id = NEW.media_asset_id;

  IF v_screen_company IS NULL OR v_media_company IS NULL OR NEW.company_id <> v_screen_company THEN
    RAISE EXCEPTION 'Origem do Proof of Play inválida.';
  END IF;
  IF v_screen_company = v_media_company THEN
    RETURN NEW;
  END IF;
  IF NEW.playlist_id IS NOT NULL OR NEW.playlist_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Playlist não pode veicular mídia de outro tenant.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.campaign_screens cs
    JOIN public.campaign_media cm ON cm.campaign_id = cs.campaign_id
    WHERE cs.screen_id = NEW.screen_id
      AND cm.media_asset_id = NEW.media_asset_id
      AND cs.is_active AND cm.is_active
      AND public.is_authorized_commercial_distribution(cs.campaign_id, NEW.screen_id, NEW.media_asset_id)
  ) THEN
    RAISE EXCEPTION 'Proof of Play cross-company sem distribuição comercial autorizada.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_playback_distribution_authority ON public.playback_logs;
CREATE TRIGGER trg_validate_playback_distribution_authority
  BEFORE INSERT OR UPDATE OF company_id, screen_id, media_asset_id, playlist_id, playlist_item_id
  ON public.playback_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_playback_distribution_authority();

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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_screen public.screens%ROWTYPE;
  v_media public.media_assets%ROWTYPE;
  v_campaign_id UUID;
  v_log_id UUID;
BEGIN
  IF p_planned_duration_seconds < 5 OR p_planned_duration_seconds > 3600 OR p_planned_duration_seconds % 5 <> 0 THEN
    RAISE EXCEPTION 'Duração planejada inválida.';
  END IF;
  IF p_status NOT IN ('started', 'completed', 'skipped', 'failed') THEN RAISE EXCEPTION 'Status de exibição inválido.'; END IF;
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'Chave de idempotência obrigatória.'; END IF;
  SELECT id INTO v_log_id FROM public.playback_logs WHERE idempotency_key = p_idempotency_key;
  IF v_log_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'playback_log_id', v_log_id, 'deduplicated', TRUE);
  END IF;

  SELECT * INTO v_screen FROM public.screens WHERE device_token_hash = p_device_token_hash;
  SELECT * INTO v_media FROM public.media_assets WHERE id = p_media_asset_id;
  IF v_screen.id IS NULL OR v_screen.status = 'inactive' THEN RAISE EXCEPTION 'Dispositivo inválido ou inativo.'; END IF;
  IF v_media.id IS NULL OR v_media.status <> 'approved' OR v_media.media_type <> p_media_type THEN
    RAISE EXCEPTION 'Mídia inválida, não aprovada ou com tipo divergente.';
  END IF;

  IF p_playlist_id IS NOT NULL THEN
    IF v_media.company_id <> v_screen.company_id OR NOT EXISTS (
      SELECT 1 FROM public.screen_playlists sp
      JOIN public.playlists p ON p.id = sp.playlist_id
      JOIN public.playlist_items pi ON pi.playlist_id = p.id
      WHERE sp.screen_id = v_screen.id AND sp.playlist_id = p_playlist_id
        AND sp.is_active AND p.status = 'active' AND p.company_id = v_screen.company_id
        AND pi.media_asset_id = v_media.id AND pi.is_active
        AND pi.playback_duration_seconds = p_planned_duration_seconds
        AND (p_playlist_item_id IS NULL OR pi.id = p_playlist_item_id)
    ) THEN RAISE EXCEPTION 'Playlist, item ou mídia sem autorização para a tela.'; END IF;
  ELSE
    SELECT c.id INTO v_campaign_id
    FROM public.campaigns c
    JOIN public.campaign_screens cs ON cs.campaign_id = c.id AND cs.screen_id = v_screen.id AND cs.is_active
    JOIN public.campaign_media cm ON cm.campaign_id = c.id AND cm.media_asset_id = v_media.id AND cm.is_active
    WHERE c.status = 'active'
      AND cm.playback_duration_seconds = p_planned_duration_seconds
      AND (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      AND (
        (c.campaign_type = 'internal' AND c.company_id = v_screen.company_id AND v_media.company_id = v_screen.company_id)
        OR public.is_authorized_commercial_distribution(c.id, v_screen.id, v_media.id)
      )
    ORDER BY c.created_at
    LIMIT 1;
    IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'Campanha sem autoridade válida para esta mídia e tela.'; END IF;
  END IF;

  INSERT INTO public.playback_logs(
    company_id, screen_id, media_asset_id, playlist_id, playlist_item_id, media_type,
    planned_duration_seconds, actual_duration_seconds, started_at, ended_at, played_at,
    status, failure_reason, idempotency_key, player_session_id, device_token_hash, synced_at
  ) VALUES (
    v_screen.company_id, v_screen.id, v_media.id, p_playlist_id, p_playlist_item_id, p_media_type,
    p_planned_duration_seconds, p_actual_duration_seconds, p_started_at, p_ended_at, NOW(),
    p_status, p_failure_reason, p_idempotency_key, p_player_session_id, p_device_token_hash, NOW()
  ) ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_log_id;

  UPDATE public.screens SET last_ping_at = NOW(), updated_at = NOW() WHERE id = v_screen.id;
  RETURN jsonb_build_object('success', TRUE, 'playback_log_id', v_log_id, 'deduplicated', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.record_playback_log(TEXT,UUID,UUID,UUID,TEXT,INTEGER,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_playback_log(TEXT,UUID,UUID,UUID,TEXT,INTEGER,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.ad_offer_orders%ROWTYPE;
  v_media public.media_assets%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_campaign_id UUID;
  v_screen_count INTEGER;
  v_seller_compliance JSONB;
  v_buyer_compliance JSONB;
BEGIN
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Pedido não encontrado.'); END IF;
  IF NOT (public.is_master_admin() OR v_order.seller_company_id IN (SELECT public.get_user_admin_company_ids())) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Apenas a exibidora ou o Master pode converter o pedido.');
  END IF;
  IF v_order.buyer_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Campanha cross-company exige empresa anunciante identificada.');
  END IF;
  IF v_order.approval_status <> 'approved'
     OR v_order.payment_status NOT IN ('paid_manual', 'paid_asaas')
     OR v_order.status NOT IN ('paid_manual', 'paid_asaas') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Pedido precisa estar aprovado e pago.');
  END IF;
  IF v_order.campaign_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Pedido já convertido.', 'campaign_id', v_order.campaign_id);
  END IF;

  v_seller_compliance := public.check_company_required_terms(v_order.seller_company_id);
  v_buyer_compliance := public.check_company_required_terms(v_order.buyer_company_id);
  IF NOT COALESCE((v_seller_compliance->>'compliant')::BOOLEAN, FALSE)
     OR NOT COALESCE((v_buyer_compliance->>'compliant')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Existem termos comerciais pendentes.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;
  IF v_media.id IS NULL OR v_media.company_id <> v_order.buyer_company_id OR v_media.status <> 'approved'
     OR COALESCE(v_media.owner_only, FALSE) OR COALESCE(v_media.trial_internal_only, FALSE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Mídia do anunciante inválida ou restrita.');
  END IF;

  SELECT COUNT(*) INTO v_screen_count
  FROM public.screens
  WHERE company_id = v_order.seller_company_id AND status IN ('online', 'pending_pairing');
  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Exibidora sem telas elegíveis.');
  END IF;

  INSERT INTO public.campaigns (
    company_id, name, description, campaign_type, status, start_date, end_date,
    target_insertions, delivered_insertions, buyer_company_id, seller_company_id,
    ad_offer_order_id, credits_contracted, credits_delivered, created_by
  ) VALUES (
    v_order.buyer_company_id,
    'Campanha Marketplace: ' || COALESCE(v_order.buyer_name, 'Anunciante'),
    'Campanha autorizada pelo pedido ' || v_order.id,
    'commercial', 'active', COALESCE(v_order.requested_start_date, CURRENT_DATE),
    COALESCE(v_order.requested_end_date, CURRENT_DATE + 30), v_order.credits_amount,
    0, v_order.buyer_company_id, v_order.seller_company_id, v_order.id,
    v_order.credits_amount, 0, v_user_id
  ) RETURNING id INTO v_campaign_id;

  INSERT INTO public.campaign_media(campaign_id, media_asset_id, playback_duration_seconds, is_active)
  VALUES(v_campaign_id, v_media.id, v_media.playback_duration_seconds, TRUE);
  INSERT INTO public.campaign_screens(campaign_id, screen_id, is_active)
  SELECT v_campaign_id, id, TRUE FROM public.screens
  WHERE company_id = v_order.seller_company_id AND status IN ('online', 'pending_pairing');

  INSERT INTO public.ad_order_delivery_ledger(
    order_id, campaign_id, seller_company_id, buyer_company_id,
    credits_contracted, credits_delivered, credits_remaining, status
  ) VALUES (
    v_order.id, v_campaign_id, v_order.seller_company_id, v_order.buyer_company_id,
    v_order.credits_amount, 0, v_order.credits_amount, 'active'
  );

  INSERT INTO public.seller_financial_ledger(
    seller_company_id, buyer_company_id, ad_offer_order_id, campaign_id,
    gross_amount_cents, platform_fee_cents, seller_net_cents,
    amount_available_cents, amount_used_for_discount_cents, amount_pending_cents,
    financial_status, delivery_status
  ) VALUES (
    v_order.seller_company_id, v_order.buyer_company_id, v_order.id, v_campaign_id,
    v_order.gross_amount_cents, v_order.platform_fee_cents, v_order.seller_net_cents,
    0, 0, v_order.seller_net_cents, 'pending_delivery', 'in_progress'
  ) ON CONFLICT (ad_offer_order_id) DO NOTHING;

  UPDATE public.ad_offer_orders
  SET status = 'converted_to_campaign', campaign_id = v_campaign_id, updated_at = NOW()
  WHERE id = v_order.id;

  INSERT INTO public.audit_logs(user_id, company_id, action, details)
  VALUES(v_user_id, v_order.seller_company_id, 'AUTHORIZED_CROSS_COMPANY_CAMPAIGN_CREATED',
    jsonb_build_object('order_id', v_order.id, 'campaign_id', v_campaign_id,
      'buyer_company_id', v_order.buyer_company_id, 'seller_company_id', v_order.seller_company_id,
      'assigned_screens_count', v_screen_count));

  RETURN jsonb_build_object('success', TRUE, 'campaign_id', v_campaign_id,
    'assigned_screens_count', v_screen_count, 'status', 'converted_to_campaign');
END;
$$;

REVOKE ALL ON FUNCTION public.convert_ad_offer_order_to_campaign(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_ad_offer_order_to_campaign(UUID) TO authenticated, service_role;

-- Seller pode acompanhar a campanha autorizada, sem ganhar leitura das tabelas
-- internas da compradora nem das telas de outros sellers.
DROP POLICY IF EXISTS "Campaigns - Seller read authorized commercial" ON public.campaigns;
CREATE POLICY "Campaigns - Seller read authorized commercial"
  ON public.campaigns FOR SELECT TO authenticated
  USING (
    campaign_type IN ('marketplace', 'commercial')
    AND seller_company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "CampaignMedia - Seller read authorized commercial" ON public.campaign_media;
CREATE POLICY "CampaignMedia - Seller read authorized commercial"
  ON public.campaign_media FOR SELECT TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE campaign_type IN ('marketplace', 'commercial')
        AND seller_company_id IN (SELECT public.get_user_company_ids())
    )
  );

DROP POLICY IF EXISTS "CampaignScreens - Seller read authorized commercial" ON public.campaign_screens;
CREATE POLICY "CampaignScreens - Seller read authorized commercial"
  ON public.campaign_screens FOR SELECT TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE campaign_type IN ('marketplace', 'commercial')
        AND seller_company_id IN (SELECT public.get_user_company_ids())
    )
  );

COMMENT ON FUNCTION public.is_authorized_commercial_distribution(UUID, UUID, UUID) IS
  'Autoridade única para PoP cross-company: pedido pago/aprovado, anunciante, mídia e tela da exibidora devem coincidir.';
COMMENT ON FUNCTION public.validate_playback_distribution_authority() IS
  'Impede que service_role ou inserts diretos criem Proof of Play cross-company sem pedido comercial válido.';
