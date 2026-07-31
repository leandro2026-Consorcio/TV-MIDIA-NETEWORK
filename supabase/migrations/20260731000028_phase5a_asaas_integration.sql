-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO FASE 5A: INTEGRAÇÃO ASAAS PARA COBRANÇA E BAIXA
-- Data: 2026-07-31
-- ============================================================================

-- 1. ADICIONAR CAMPOS DE PAGAMENTO E RASTREIO ASAAS EM AD_OFFER_ORDERS
ALTER TABLE public.ad_offer_orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS asaas_pix_copy_paste TEXT,
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_webhook_last_event TEXT,
  ADD COLUMN IF NOT EXISTS payment_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_asaas_payment_id ON public.ad_offer_orders(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_asaas_customer_id ON public.ad_offer_orders(asaas_customer_id);

-- 2. TABELA DE REGISTRO E IDEMPOTÊNCIA DE EVENTOS WEBHOOK ASAAS (ASAAS_PAYMENT_EVENTS)
CREATE TABLE IF NOT EXISTS public.asaas_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_idempotency_key TEXT NOT NULL UNIQUE,
  asaas_event_id TEXT,
  asaas_payment_id TEXT NOT NULL,
  ad_offer_order_id UUID REFERENCES public.ad_offer_orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'processed' CHECK (processing_status IN ('processed', 'duplicate_ignored', 'failed', 'ignored')),
  error_message TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asaas_events_payment_id ON public.asaas_payment_events(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_asaas_events_order_id ON public.asaas_payment_events(ad_offer_order_id);

-- Habilitar RLS em asaas_payment_events
ALTER TABLE public.asaas_payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AsaasPaymentEvents - Leitura por Master Admin"
  ON public.asaas_payment_events FOR SELECT TO authenticated
  USING (is_master_admin());

-- 3. ATUALIZAR CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN ACEITANDO PAID_ASAAS
CREATE OR REPLACE FUNCTION public.convert_ad_offer_order_to_campaign(
  p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_is_seller_admin BOOLEAN;
  v_campaign_id UUID;
  v_start_date DATE;
  v_end_date DATE;
  v_media RECORD;
  v_prefs RECORD;
  v_screen_count INTEGER := 0;
  v_seller_compliance JSONB;
  v_buyer_compliance JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Validação 1: Trava pessimista no pedido
  SELECT * INTO v_order FROM public.ad_offer_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido de oferta não encontrado.');
  END IF;

  -- Validação 2: Usuário deve ser Admin da exibidora ou Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_users 
      WHERE company_id = v_order.seller_company_id AND user_id = v_user_id AND role = 'admin' AND is_active = TRUE
    ) INTO v_is_seller_admin;

    IF NOT v_is_seller_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Administradores da empresa exibidora ou Master Admin podem converter o pedido em campanha.');
    END IF;
  END IF;

  -- Validação 3: Pedido deve estar pago (paid_manual ou paid_asaas)
  IF v_order.payment_status NOT IN ('paid_manual', 'paid_asaas') AND v_order.status NOT IN ('paid_manual', 'paid_asaas') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas pedidos com pagamento confirmado (paid_manual ou paid_asaas) podem ser convertidos em campanha comercial.');
  END IF;

  IF v_order.status = 'converted_to_campaign' OR v_order.campaign_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em uma campanha comercial anteriormente.', 'campaign_id', v_order.campaign_id);
  END IF;

  -- Validação 4: Conformidade de termos da empresa exibidora (Seller)
  v_seller_compliance := public.check_company_required_terms(v_order.seller_company_id);
  IF (v_seller_compliance->>'compliant')::boolean = FALSE THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_order.seller_company_id, 'CAMPAIGN_CONVERSION_BLOCKED_SELLER_PENDING_TERMS', jsonb_build_object('order_id', p_order_id));

    RETURN jsonb_build_object('success', false, 'error', 'Existem termos comerciais pendentes de aceite antes de continuar.');
  END IF;

  -- Validação 5: Conformidade de termos da empresa anunciante (Buyer)
  IF v_order.buyer_company_id IS NOT NULL THEN
    v_buyer_compliance := public.check_company_required_terms(v_order.buyer_company_id);
    IF (v_buyer_compliance->>'compliant')::boolean = FALSE THEN
      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (v_user_id, v_order.buyer_company_id, 'CAMPAIGN_CONVERSION_BLOCKED_BUYER_PENDING_TERMS', jsonb_build_object('order_id', p_order_id));

      RETURN jsonb_build_object('success', false, 'error', 'Existem termos comerciais pendentes de aceite antes de continuar.');
    END IF;
  END IF;

  -- Validação 6: Mídia solicitada existe, pertence à compradora e está aprovada
  IF v_order.requested_media_asset_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pedido não possui uma mídia solicitada vinculada.');
  END IF;

  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;
  IF v_media.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia solicitada no pedido não existe.');
  END IF;

  IF v_order.buyer_company_id IS NOT NULL AND v_media.company_id <> v_order.buyer_company_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia vinculada não pertence à empresa compradora contratante.');
  END IF;

  IF v_media.status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas mídias com status aprovado podem virar campanha comercial. Status atual: ' || v_media.status);
  END IF;

  -- Validação 7: Preferências e bloqueios da exibidora
  SELECT * INTO v_prefs FROM public.company_network_preferences WHERE company_id = v_order.seller_company_id;
  IF v_prefs.company_id IS NOT NULL THEN
    IF v_prefs.accepts_network_ads = FALSE THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora desativou o recebimento de anúncios externos da rede.');
    END IF;

    IF v_order.buyer_company_id IS NOT NULL AND v_prefs.blocked_companies IS NOT NULL AND v_order.buyer_company_id = ANY(v_prefs.blocked_companies) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A empresa compradora está bloqueada na lista de preferências da exibidora.');
    END IF;
  END IF;

  -- Validação 8: Exibidora possui telas ativas
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status IN ('online', 'pending_pairing');
  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas para veicular a campanha.');
  END IF;

  v_start_date := COALESCE(v_order.requested_start_date::date, CURRENT_DATE);
  v_end_date := COALESCE(v_order.requested_end_date::date, CURRENT_DATE + INTERVAL '30 days');

  -- Execução A: Criar a Campanha Comercial
  INSERT INTO public.campaigns (
    company_id,
    name,
    description,
    campaign_type,
    status,
    start_date,
    end_date,
    target_insertions,
    delivered_insertions,
    buyer_company_id,
    seller_company_id,
    ad_offer_order_id,
    credits_contracted,
    credits_delivered,
    created_by
  ) VALUES (
    v_order.seller_company_id,
    'Campanha Marketplace: ' || COALESCE(v_order.buyer_name, 'Anunciante'),
    'Campanha gerada a partir do pedido de oferta ' || v_order.id,
    'commercial',
    'active',
    v_start_date::text,
    v_end_date::text,
    v_order.credits_amount,
    0,
    v_order.buyer_company_id,
    v_order.seller_company_id,
    v_order.id,
    v_order.credits_amount,
    0,
    v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- Execução B: Vincular a Mídia Aprovada
  INSERT INTO public.campaign_media (campaign_id, media_asset_id, playback_duration_seconds, is_active)
  VALUES (v_campaign_id, v_media.id, COALESCE(v_media.playback_duration_seconds, 10), TRUE);

  -- Execução C: Vincular as Telas Ativas da Exibidora
  INSERT INTO public.campaign_screens (campaign_id, screen_id, is_active)
  SELECT v_campaign_id, s.id, TRUE
  FROM public.screens s
  WHERE s.company_id = v_order.seller_company_id AND s.status IN ('online', 'pending_pairing');

  -- Execução D: Criar Livro de Entrega de Inserções (ad_order_delivery_ledger)
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
    COALESCE(v_order.buyer_company_id, v_order.seller_company_id),
    v_order.credits_amount,
    0,
    v_order.credits_amount,
    'active'
  );

  -- Execução E: Criar Livro Financeiro do Exibidor (seller_financial_ledger) com status pending_delivery
  INSERT INTO public.seller_financial_ledger (
    seller_company_id,
    buyer_company_id,
    ad_offer_order_id,
    campaign_id,
    gross_amount_cents,
    platform_fee_cents,
    seller_net_cents,
    amount_available_cents,
    amount_used_for_discount_cents,
    amount_pending_cents,
    financial_status,
    delivery_status
  ) VALUES (
    v_order.seller_company_id,
    v_order.buyer_company_id,
    v_order.id,
    v_campaign_id,
    v_order.gross_amount_cents,
    v_order.platform_fee_cents,
    v_order.seller_net_cents,
    0,
    0,
    v_order.seller_net_cents,
    'pending_delivery',
    'in_progress'
  )
  ON CONFLICT (ad_offer_order_id) DO NOTHING;

  -- Execução F: Atualizar pedido para status convertido
  UPDATE public.ad_offer_orders
  SET 
    status = 'converted_to_campaign',
    campaign_id = v_campaign_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Audit Log de Sucesso
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id,
    v_order.seller_company_id,
    'AD_OFFER_ORDER_CONVERTED_TO_CAMPAIGN',
    jsonb_build_object(
      'order_id', p_order_id,
      'campaign_id', v_campaign_id,
      'buyer_company_id', v_order.buyer_company_id,
      'credits_contracted', v_order.credits_amount,
      'assigned_screens_count', v_screen_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', v_campaign_id,
    'assigned_screens_count', v_screen_count,
    'status', 'converted_to_campaign'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
