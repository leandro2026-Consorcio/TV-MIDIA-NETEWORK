-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4B: CONVERSÃO DE PEDIDO EM CAMPANHA E ENTREGA
-- Data: 2026-07-31
-- ============================================================================

-- 1. AMPLIAR CHECK DE CAMPAIGN_TYPE E ADICIONAR CAMPOS COMERCIAIS EM CAMPAIGNS
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_campaign_type_check 
  CHECK (campaign_type IN ('internal', 'paid', 'exchange', 'external', 'marketplace', 'commercial'));

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ad_offer_order_id UUID REFERENCES public.ad_offer_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credits_contracted NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS credits_delivered NUMERIC(12,2) DEFAULT 0;

-- 2. TABELA LIVRO DE ENTREGA DO PEDIDO PAGO (AD_ORDER_DELIVERY_LEDGER)
CREATE TABLE IF NOT EXISTS public.ad_order_delivery_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  credits_contracted NUMERIC(12,2) NOT NULL CHECK (credits_contracted > 0),
  credits_delivered NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credits_delivered >= 0),
  credits_remaining NUMERIC(12,2) NOT NULL CHECK (credits_remaining >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_ledger_order ON public.ad_order_delivery_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ledger_campaign ON public.ad_order_delivery_ledger(campaign_id);

-- 3. TABELA USO DE ENTREGA POR PROOF OF PLAY (AD_ORDER_DELIVERY_USAGE)
CREATE TABLE IF NOT EXISTS public.ad_order_delivery_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_ledger_id UUID NOT NULL REFERENCES public.ad_order_delivery_ledger(id) ON DELETE CASCADE,
  playback_log_id UUID NOT NULL UNIQUE REFERENCES public.playback_logs(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  credits_used NUMERIC(12,2) NOT NULL CHECK (credits_used > 0),
  status TEXT NOT NULL DEFAULT 'used' CHECK (status IN ('used', 'reversed', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_usage_ledger ON public.ad_order_delivery_usage(delivery_ledger_id);
CREATE INDEX IF NOT EXISTS idx_delivery_usage_campaign ON public.ad_order_delivery_usage(campaign_id);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.ad_order_delivery_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_order_delivery_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DeliveryLedger - Leitura por comprador, vendedor ou Master" ON public.ad_order_delivery_ledger;
CREATE POLICY "DeliveryLedger - Leitura por comprador, vendedor ou Master"
  ON public.ad_order_delivery_ledger FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    seller_company_id IN (SELECT public.get_user_company_ids()) OR
    buyer_company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "DeliveryUsage - Leitura por comprador, vendedor ou Master" ON public.ad_order_delivery_usage;
CREATE POLICY "DeliveryUsage - Leitura por comprador, vendedor ou Master"
  ON public.ad_order_delivery_usage FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    campaign_id IN (
      SELECT id FROM public.campaigns 
      WHERE buyer_company_id IN (SELECT public.get_user_company_ids()) OR seller_company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- 5. RPC TRANSACIONAL DE CONVERSÃO DE PEDIDO EM CAMPANHA (CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN)
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_offer RECORD;
  v_media RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_campaign_id UUID;
  v_ledger_id UUID;
  v_screen RECORD;
  v_screen_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();

  -- 1. Buscar pedido
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido de mídia não encontrado.');
  END IF;

  -- 2. Validar que ainda NÃO foi convertido
  IF v_order.campaign_id IS NOT NULL OR v_order.status = 'converted_to_campaign' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em campanha comercial anteriormente.');
  END IF;

  -- 3. Validar aprovação e pagamento manual
  IF v_order.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status APROVADO podem ser convertidas.');
  END IF;

  IF v_order.payment_status != 'paid_manual' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com pagamento manual confirmado (paid_manual) podem ser convertidas.');
  END IF;

  -- 4. Validar permissão (Apenas Admin da exibidora ou Master Admin)
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;

  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Admins da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- 5. Validar mídia solicitada
  IF v_order.requested_media_asset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pedido precisa ter uma mídia selecionada para conversão.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;

  IF v_media.id IS NULL OR v_media.company_id != v_order.buyer_company_id OR v_media.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia do pedido deve pertencer à empresa compradora e estar APROVADA.');
  END IF;

  -- 6. Validar oferta original
  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = v_order.offer_id;

  IF v_offer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oferta de mídia original não encontrada.');
  END IF;

  -- 7. Validar existência de telas ativas da exibidora
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive';

  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas no momento.');
  END IF;

  -- 8. CRIAR CAMPANHA COMERCIAL EM CAMPAIGNS
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

  -- 9. VINCULAR MÍDIA EM CAMPAIGN_MEDIA
  INSERT INTO public.campaign_media (
    campaign_id,
    media_asset_id,
    playback_duration_seconds,
    is_active
  ) VALUES (
    v_campaign_id,
    v_order.requested_media_asset_id,
    COALESCE(v_media.playback_duration_seconds, 10),
    TRUE
  );

  -- 10. VINCULAR TELAS DA EXIBIDORA EM CAMPAIGN_SCREENS
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

  -- 11. CRIAR LIVRO DE ENTREGA EM AD_ORDER_DELIVERY_LEDGER
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

  -- 12. ATUALIZAR STATUS DO PEDIDO
  UPDATE public.ad_offer_orders
  SET 
    campaign_id = v_campaign_id,
    status = 'converted_to_campaign',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 13. AUDIT LOG
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

-- 6. RPC DE PROCESSAMENTO DE ENTREGA POR PROOF OF PLAY (PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY)
CREATE OR REPLACE FUNCTION public.process_commercial_campaign_delivery(
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_ledger RECORD;
  v_log RECORD;
  v_log_credits NUMERIC(12,2);
  v_processed_count INTEGER := 0;
  v_total_credits_delivered NUMERIC(12,2) := 0;
  v_credit_deducted NUMERIC(12,2);
BEGIN
  -- 1. Trava pessimista no livro de entrega da campanha
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

  -- 2. Loop sobre os playback_logs concluídos da campanha que ainda não foram abatidos
  FOR v_log IN 
    SELECT pl.* 
    FROM public.playback_logs pl
    JOIN public.campaign_media cm ON cm.media_asset_id = pl.media_asset_id AND cm.campaign_id = p_campaign_id
    WHERE pl.status = 'completed'
      AND pl.screen_id IN (SELECT screen_id FROM public.campaign_screens WHERE campaign_id = p_campaign_id)
      AND pl.id NOT IN (SELECT playback_log_id FROM public.ad_order_delivery_usage WHERE campaign_id = p_campaign_id)
    ORDER BY pl.played_at ASC
  LOOP
    -- Se os créditos restantes zeraram, encerra o loop
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

    -- Regra de ajuste se o saldo restante for menor que o valor do log (não deixa saldo negativo)
    IF v_log_credits > v_ledger.credits_remaining THEN
      v_credit_deducted := v_ledger.credits_remaining;
    ELSE
      v_credit_deducted := v_log_credits;
    END IF;

    -- Insere o registro de entrega (UNIQUE playback_log_id)
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

    -- Atualiza variáveis em memória
    v_ledger.credits_delivered := v_ledger.credits_delivered + v_credit_deducted;
    v_ledger.credits_remaining := v_ledger.credits_remaining - v_credit_deducted;
    v_total_credits_delivered := v_total_credits_delivered + v_credit_deducted;
    v_processed_count := v_processed_count + 1;
  END LOOP;

  -- 3. Atualizar o livro de entregas no banco
  UPDATE public.ad_order_delivery_ledger
  SET 
    credits_delivered = v_ledger.credits_delivered,
    credits_remaining = v_ledger.credits_remaining,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- 4. Atualizar entrega na campanha
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
