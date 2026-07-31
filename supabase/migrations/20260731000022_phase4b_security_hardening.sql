-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4B: HARDENING DE CONVERSÃO E ENTREGA DE CAMPANHA
-- Data: 2026-07-31
-- ============================================================================

-- 1. REESCREVER RPC CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN COM REVALIDAÇÃO COMPLETA
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_offer RECORD;
  v_media RECORD;
  v_prefs RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_has_blocked_segment BOOLEAN;
  v_campaign_id UUID;
  v_ledger_id UUID;
  v_screen RECORD;
  v_screen_count INTEGER := 0;
  v_duration INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- 1. Trava pessimista no pedido (FOR UPDATE)
  SELECT * INTO v_order 
  FROM public.ad_offer_orders 
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido de mídia não encontrado.');
  END IF;

  -- 2. Validar que ainda NÃO foi convertido (Garantia de conversão única)
  IF v_order.campaign_id IS NOT NULL OR v_order.status = 'converted_to_campaign' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_DUPLICATE_BLOCKED', jsonb_build_object('order_id', p_order_id, 'campaign_id', v_order.campaign_id));

    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em campanha comercial anteriormente.');
  END IF;

  -- 3. Validar aprovação e pagamento manual
  IF v_order.approval_status != 'approved' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_NOT_APPROVED_BLOCKED', jsonb_build_object('order_id', p_order_id, 'approval_status', v_order.approval_status));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status APROVADO podem ser convertidas.');
  END IF;

  IF v_order.payment_status != 'paid_manual' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_PAYMENT_PENDING_BLOCKED', jsonb_build_object('order_id', p_order_id, 'payment_status', v_order.payment_status));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com pagamento manual confirmado (paid_manual) podem ser convertidas.');
  END IF;

  -- 4. Validar permissão (Apenas Admin ativo da exibidora ou Master Admin. Comprador NÃO converte sozinho)
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_PERMISSION_DENIED', jsonb_build_object('order_id', p_order_id));

      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- 5. Validar mídia solicitada (Deve existir, pertencer à compradora e estar APROVADA)
  IF v_order.requested_media_asset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pedido precisa ter uma mídia selecionada para conversão.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;

  IF v_media.id IS NULL OR v_media.company_id != v_order.buyer_company_id OR v_media.status != 'approved' THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.buyer_company_id, 'COMMERCIAL_CONVERSION_INVALID_MEDIA_BLOCKED', jsonb_build_object('order_id', p_order_id, 'media_id', v_order.requested_media_asset_id));

    RETURN jsonb_build_object('success', false, 'error', 'A mídia do pedido deve pertencer à empresa compradora e estar obrigatoriamente APROVADA.');
  END IF;

  -- 6. Validar oferta original
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = v_order.offer_id;

  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia original não encontrada.');
  END IF;

  -- 7. REVALIDAR PREFERÊNCIAS E BLOQUEIOS DA EXIBIDORA NA CONVERSÃO
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_order.seller_company_id;

  IF v_prefs.company_id IS NOT NULL THEN
    IF v_prefs.accepts_network_ads = FALSE THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora desativou anúncios de rede.');
    END IF;

    IF v_prefs.blocked_companies IS NOT NULL AND v_order.buyer_company_id = ANY(v_prefs.blocked_companies) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A conversão foi bloqueada pois a empresa compradora foi incluída na lista de concorrentes da exibidora.');
    END IF;

    IF v_prefs.blocked_segments IS NOT NULL AND array_length(v_prefs.blocked_segments, 1) > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.company_segments 
        WHERE company_id = v_order.buyer_company_id 
          AND segment_id = ANY(v_prefs.blocked_segments)
      ) INTO v_has_blocked_segment;

      IF v_has_blocked_segment THEN
        RETURN jsonb_build_object('success', false, 'error', 'A conversão foi bloqueada pois o segmento da compradora cruza com restrições de concorrência da exibidora.');
      END IF;
    END IF;
  END IF;

  -- 8. VALIDAR TELAS ATIVAS DA EXIBIDORA (ABORTAR SE 0 TELAS)
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive';

  IF v_screen_count = 0 THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'COMMERCIAL_CONVERSION_NO_SCREENS_BLOCKED', jsonb_build_object('order_id', p_order_id));

    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas para veicular a campanha.');
  END IF;

  -- Duração da mídia obtida dinamicamente da própria mídia ou da oferta
  v_duration := COALESCE(v_media.playback_duration_seconds, v_offer.duration_seconds, 10);

  -- 9. CRIAR CAMPANHA COMERCIAL EM CAMPAIGNS (TIPO MARKETPLACE)
  INSERT INTO public.campaigns (
    company_id,
    name,
    description,
    campaign_type,
    status,
    start_date,
    end_date,
    target_insertions,
    buyer_company_id,
    seller_company_id,
    ad_offer_order_id,
    credits_contracted,
    credits_delivered,
    created_by
  ) VALUES (
    v_order.buyer_company_id,
    'Campanha Comercial - ' || v_offer.title,
    'Campanha do Marketplace vinculada ao pedido ' || v_order.id,
    'marketplace',
    'active',
    COALESCE(v_order.requested_start_date, CURRENT_DATE)::text,
    COALESCE(v_order.requested_end_date, CURRENT_DATE + INTERVAL '30 days')::text,
    v_order.credits_amount::integer,
    v_order.buyer_company_id,
    v_order.seller_company_id,
    v_order.id,
    v_order.credits_amount,
    0,
    v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- 10. VINCULAR MÍDIA EM CAMPAIGN_MEDIA COM DURAÇÃO DINÂMICA
  INSERT INTO public.campaign_media (
    campaign_id,
    media_asset_id,
    playback_duration_seconds,
    is_active
  ) VALUES (
    v_campaign_id,
    v_order.requested_media_asset_id,
    v_duration,
    TRUE
  );

  -- 11. VINCULAR TELAS ATIVAS DA EXIBIDORA EM CAMPAIGN_SCREENS
  FOR v_screen IN SELECT id FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive' LOOP
    INSERT INTO public.campaign_screens (
      campaign_id,
      screen_id,
      is_active
    ) VALUES (
      v_campaign_id,
      v_screen.id,
      TRUE
    );
  END LOOP;

  -- 12. CRIAR LIVRO DE ENTREGA EM AD_ORDER_DELIVERY_LEDGER
  INSERT INTO public.ad_order_delivery_ledger (
    order_id,
    campaign_id,
    seller_company_id,
    buyer_company_id,
    credits_contracted,
    credits_delivered,
    credits_remaining,
    status
  ) VALUES (
    v_order.id,
    v_campaign_id,
    v_order.seller_company_id,
    v_order.buyer_company_id,
    v_order.credits_amount,
    0,
    v_order.credits_amount,
    'active'
  ) RETURNING id INTO v_ledger_id;

  -- 13. ATUALIZAR STATUS DO PEDIDO DE FORMA DEFINITIVA
  UPDATE public.ad_offer_orders
  SET 
    campaign_id = v_campaign_id,
    status = 'converted_to_campaign',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 14. AUDIT LOG DE CONVERSÃO COM SUCESSO
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_order.seller_company_id, 
    'MARKETPLACE_ORDER_CONVERTED_TO_CAMPAIGN', 
    jsonb_build_object('order_id', p_order_id, 'campaign_id', v_campaign_id, 'ledger_id', v_ledger_id, 'credits_contracted', v_order.credits_amount)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'campaign_id', v_campaign_id, 
    'ledger_id', v_ledger_id,
    'credits_contracted', v_order.credits_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. REESCREVER RPC PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY COM RASTREABILIDADE DE DATAS E MÍDIAS
CREATE OR REPLACE FUNCTION public.process_commercial_campaign_delivery(
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_campaign RECORD;
  v_ledger RECORD;
  v_log RECORD;
  v_log_credits NUMERIC(12,2);
  v_processed_count INTEGER := 0;
  v_total_credits_delivered NUMERIC(12,2) := 0;
  v_credit_deducted NUMERIC(12,2);
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
BEGIN
  -- Buscar dados da campanha
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campanha comercial não encontrada.');
  END IF;

  v_start_ts := COALESCE(v_campaign.start_date::timestamptz, '1970-01-01'::timestamptz);
  v_end_ts := COALESCE((v_campaign.end_date::date + 1)::timestamptz, '2099-12-31'::timestamptz);

  -- Trava pessimista no livro de entrega da campanha
  SELECT * INTO v_ledger 
  FROM public.ad_order_delivery_ledger 
  WHERE campaign_id = p_campaign_id AND status = 'active'
  FOR UPDATE;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livro de entregas ativo não encontrado para esta campanha.');
  END IF;

  IF v_ledger.credits_remaining <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Os créditos contratados para esta campanha já foram totalmente entregues.', 'credits_remaining', 0);
  END IF;

  -- Loop sobre os playback_logs concluídos estritamente vinculados à mídia e telas da exibidora dentro do período
  FOR v_log IN 
    SELECT pl.* 
    FROM public.playback_logs pl
    JOIN public.campaign_media cm ON cm.media_asset_id = pl.media_asset_id AND cm.campaign_id = p_campaign_id
    WHERE pl.status = 'completed'
      AND pl.screen_id IN (SELECT screen_id FROM public.campaign_screens WHERE campaign_id = p_campaign_id)
      AND pl.played_at >= v_start_ts AND pl.played_at <= v_end_ts
      AND pl.id NOT IN (SELECT playback_log_id FROM public.ad_order_delivery_usage WHERE campaign_id = p_campaign_id)
    ORDER BY pl.played_at ASC
  LOOP
    IF v_ledger.credits_remaining <= 0 THEN
      EXIT;
    END IF;

    -- Calcular valor dos créditos pela duração (5s=0.5, 10s=1.0, 15s=1.5, 30s=3.0)
    CASE COALESCE(v_log.actual_duration_seconds, v_log.planned_duration_seconds, 10)
      WHEN 5 THEN v_log_credits := 0.5;
      WHEN 15 THEN v_log_credits := 1.5;
      WHEN 30 THEN v_log_credits := 3.0;
      ELSE v_log_credits := 1.0;
    END CASE;

    -- Se saldo restante for menor que o valor da próxima exibição, deduz apenas o saldo restante (não deixa negativo)
    IF v_log_credits > v_ledger.credits_remaining THEN
      v_credit_deducted := v_ledger.credits_remaining;
    ELSE
      v_credit_deducted := v_log_credits;
    END IF;

    -- Registrar uso de entrega com trava UNIQUE (playback_log_id)
    INSERT INTO public.ad_order_delivery_usage (
      delivery_ledger_id,
      playback_log_id,
      order_id,
      campaign_id,
      media_asset_id,
      screen_id,
      credits_used,
      status
    ) VALUES (
      v_ledger.id,
      v_log.id,
      v_ledger.order_id,
      p_campaign_id,
      v_log.media_asset_id,
      v_log.screen_id,
      v_credit_deducted,
      'used'
    );

    v_ledger.credits_delivered := v_ledger.credits_delivered + v_credit_deducted;
    v_ledger.credits_remaining := v_ledger.credits_remaining - v_credit_deducted;
    v_total_credits_delivered := v_total_credits_delivered + v_credit_deducted;
    v_processed_count := v_processed_count + 1;
  END LOOP;

  -- Atualizar livro de entregas no banco
  UPDATE public.ad_order_delivery_ledger
  SET 
    credits_delivered = v_ledger.credits_delivered,
    credits_remaining = v_ledger.credits_remaining,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- Atualizar entrega na campanha
  UPDATE public.campaigns
  SET 
    credits_delivered = v_ledger.credits_delivered,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE status END,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  IF v_ledger.credits_remaining <= 0 THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (
      auth.uid(), 
      v_ledger.seller_company_id, 
      'COMMERCIAL_CAMPAIGN_DELIVERY_COMPLETED', 
      jsonb_build_object('campaign_id', p_campaign_id, 'total_delivered', v_ledger.credits_delivered)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed_logs_count', v_processed_count,
    'total_credits_delivered', v_ledger.credits_delivered,
    'credits_remaining', v_ledger.credits_remaining,
    'delivery_status', CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
