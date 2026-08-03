-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4C: RELATÓRIOS FINANCEIROS E EXTRATO DO EXIBIDOR
-- Data: 2026-07-31
-- ============================================================================

-- 1. TABELA DE LIVRO FINANCEIRO DO EXIBIDOR (SELLER_FINANCIAL_LEDGER)
CREATE TABLE IF NOT EXISTS public.seller_financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ad_offer_order_id UUID NOT NULL UNIQUE REFERENCES public.ad_offer_orders(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  gross_amount_cents INTEGER NOT NULL CHECK (gross_amount_cents >= 0),
  platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
  seller_net_cents INTEGER NOT NULL CHECK (seller_net_cents >= 0),
  amount_available_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_available_cents >= 0),
  amount_used_for_discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_used_for_discount_cents >= 0),
  amount_pending_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_pending_cents >= 0),
  financial_status TEXT NOT NULL DEFAULT 'pending_delivery' CHECK (financial_status IN ('pending_delivery', 'available', 'partially_used', 'used_for_discount', 'cancelled')),
  delivery_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (delivery_status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_seller_fin_seller ON public.seller_financial_ledger(seller_company_id);
CREATE INDEX IF NOT EXISTS idx_seller_fin_order ON public.seller_financial_ledger(ad_offer_order_id);

-- 2. TABELA DE ABATIMENTOS MANUAIS DE MENSALIDADE (MONTHLY_FEE_DISCOUNTS)
CREATE TABLE IF NOT EXISTS public.monthly_fee_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_ledger_id UUID REFERENCES public.seller_financial_ledger(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT NOT NULL,
  applied_by UUID NOT NULL REFERENCES public.profiles(id),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'cancelled', 'reversed')),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_discounts_seller ON public.monthly_fee_discounts(seller_company_id);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS) MULTIEMPRESA
ALTER TABLE public.seller_financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_fee_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SellerFinancialLedger - Leitura por exibidora ou Master Admin" ON public.seller_financial_ledger;
CREATE POLICY "SellerFinancialLedger - Leitura por exibidora ou Master Admin"
  ON public.seller_financial_ledger FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    seller_company_id IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "MonthlyFeeDiscounts - Leitura por exibidora ou Master Admin" ON public.monthly_fee_discounts;
CREATE POLICY "MonthlyFeeDiscounts - Leitura por exibidora ou Master Admin"
  ON public.monthly_fee_discounts FOR SELECT TO authenticated
  USING (
    is_master_admin() OR
    seller_company_id IN (SELECT public.get_user_company_ids())
  );

-- 4. RPC TRANSACIONAL PARA APLICAR ABATIMENTO MANUAL DE MENSALIDADE (MASTER ADMIN)
CREATE OR REPLACE FUNCTION public.apply_seller_monthly_discount(
  p_ledger_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ledger RECORD;
  v_user_id UUID;
  v_is_master BOOLEAN;
  v_discount_id UUID;
  v_new_available INTEGER;
  v_new_used INTEGER;
  v_new_status TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Validar se o usuário é Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_UNAUTHORIZED_ATTEMPT', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas o Master Admin pode aplicar abatimentos manuais de mensalidade.');
  END IF;

  -- Validar parâmetros
  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do abatimento deve ser maior que zero.');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O motivo do abatimento é obrigatório.');
  END IF;

  -- Trava pessimista no registro financeiro
  SELECT * INTO v_ledger 
  FROM public.seller_financial_ledger 
  WHERE id = p_ledger_id 
  FOR UPDATE;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro financeiro do exibidor não encontrado.');
  END IF;

  -- Validar que o valor não excede o saldo disponível
  IF p_amount_cents > v_ledger.amount_available_cents THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_ledger.seller_company_id, 'MONTHLY_DISCOUNT_EXCEEDS_BALANCE_BLOCKED', jsonb_build_object('requested_cents', p_amount_cents, 'available_cents', v_ledger.amount_available_cents));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'O valor do abatimento (R$ ' || (p_amount_cents::numeric / 100)::text || ') excede o saldo disponível do exibidor (R$ ' || (v_ledger.amount_available_cents::numeric / 100)::text || ').'
    );
  END IF;

  v_new_available := v_ledger.amount_available_cents - p_amount_cents;
  v_new_used := v_ledger.amount_used_for_discount_cents + p_amount_cents;

  IF v_new_available = 0 THEN
    v_new_status := 'used_for_discount';
  ELSE
    v_new_status := 'partially_used';
  END IF;

  -- 1. Inserir registro de abatimento
  INSERT INTO public.monthly_fee_discounts (
    seller_company_id,
    financial_ledger_id,
    amount_cents,
    reason,
    applied_by,
    status
  ) VALUES (
    v_ledger.seller_company_id,
    v_ledger.id,
    p_amount_cents,
    p_reason,
    v_user_id,
    'applied'
  ) RETURNING id INTO v_discount_id;

  -- 2. Atualizar o livro financeiro
  UPDATE public.seller_financial_ledger
  SET 
    amount_available_cents = v_new_available,
    amount_used_for_discount_cents = v_new_used,
    financial_status = v_new_status,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- 3. Audit Log
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_ledger.seller_company_id, 
    'SELLER_MONTHLY_DISCOUNT_APPLIED', 
    jsonb_build_object(
      'discount_id', v_discount_id,
      'ledger_id', p_ledger_id,
      'amount_cents', p_amount_cents,
      'remaining_available_cents', v_new_available,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'discount_id', v_discount_id,
    'amount_cents', p_amount_cents,
    'remaining_available_cents', v_new_available,
    'financial_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. ATUALIZAR RPC CONVERT_AD_OFFER_ORDER_TO_CAMPAIGN PARA INCLUIR REGISTRO FINANCEIRO PENDENTE
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
  v_fin_ledger_id UUID;
  v_screen RECORD;
  v_screen_count INTEGER := 0;
  v_duration INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- Trava pessimista no pedido
  SELECT * INTO v_order 
  FROM public.ad_offer_orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  IF v_order.id IS NULL OR v_order.campaign_id IS NOT NULL OR v_order.status = 'converted_to_campaign' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pedido já foi convertido em campanha comercial anteriormente.');
  END IF;

  IF v_order.approval_status != 'approved' OR v_order.payment_status != 'paid_manual' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações com status APROVADO e pagamento manual confirmado podem ser convertidas.');
  END IF;

  -- Permissão do banco (Master ou Admin da Exibidora)
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

  -- Validar mídia da compradora
  SELECT * INTO v_media FROM public.media_assets WHERE id = v_order.requested_media_asset_id;
  IF v_media.id IS NULL OR v_media.company_id != v_order.buyer_company_id OR v_media.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A mídia do pedido deve pertencer à empresa compradora e estar obrigatoriamente APROVADA.');
  END IF;

  -- Validar telas ativas
  SELECT COUNT(*) INTO v_screen_count FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive';
  IF v_screen_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A empresa exibidora não possui telas ativas cadastradas para veicular a campanha.');
  END IF;

  SELECT * INTO v_offer FROM public.company_ad_offers WHERE id = v_order.offer_id;
  v_duration := COALESCE(v_media.playback_duration_seconds, v_offer.duration_seconds, 10);

  -- 1. Criar Campanha Comercial
  INSERT INTO public.campaigns (
    company_id, name, description, campaign_type, status, start_date, end_date,
    target_insertions, buyer_company_id, seller_company_id, ad_offer_order_id,
    credits_contracted, credits_delivered, created_by
  ) VALUES (
    v_order.buyer_company_id, 'Campanha Comercial - ' || v_offer.title,
    'Campanha do Marketplace vinculada ao pedido ' || v_order.id, 'marketplace',
    'active', COALESCE(v_order.requested_start_date, CURRENT_DATE)::text,
    COALESCE(v_order.requested_end_date, CURRENT_DATE + INTERVAL '30 days')::text,
    v_order.credits_amount::integer, v_order.buyer_company_id, v_order.seller_company_id,
    v_order.id, v_order.credits_amount, 0, v_user_id
  ) RETURNING id INTO v_campaign_id;

  -- 2. Vincular mídia e telas
  INSERT INTO public.campaign_media (campaign_id, media_asset_id, playback_duration_seconds, is_active)
  VALUES (v_campaign_id, v_order.requested_media_asset_id, v_duration, TRUE);

  FOR v_screen IN SELECT id FROM public.screens WHERE company_id = v_order.seller_company_id AND status != 'inactive' LOOP
    INSERT INTO public.campaign_screens (campaign_id, screen_id, is_active)
    VALUES (v_campaign_id, v_screen.id, TRUE);
  END LOOP;

  -- 3. Criar Livro de Entrega de Inserções (ad_order_delivery_ledger)
  INSERT INTO public.ad_order_delivery_ledger (
    order_id, campaign_id, seller_company_id, buyer_company_id, credits_contracted,
    credits_delivered, credits_remaining, status
  ) VALUES (
    v_order.id, v_campaign_id, v_order.seller_company_id, v_order.buyer_company_id,
    v_order.credits_amount, 0, v_order.credits_amount, 'active'
  ) RETURNING id INTO v_ledger_id;

  -- 4. CRIAR REGISTRO FINANCEIRO DO EXIBIDOR COM STATUS PENDING_DELIVERY (SELLER_FINANCIAL_LEDGER)
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
    0, -- Disponível só nasce após entrega concluída
    0,
    v_order.seller_net_cents, -- Todo o líquido nasce pendente de entrega
    'pending_delivery',
    'in_progress'
  ) RETURNING id INTO v_fin_ledger_id;

  -- 5. Atualizar pedido de forma definitiva
  UPDATE public.ad_offer_orders
  SET 
    campaign_id = v_campaign_id,
    status = 'converted_to_campaign',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 6. Audit Logs
  INSERT INTO public.audit_logs (user_id, company_id, action, details)
  VALUES (
    v_user_id, 
    v_order.seller_company_id, 
    'MARKETPLACE_ORDER_CONVERTED_TO_CAMPAIGN', 
    jsonb_build_object('order_id', p_order_id, 'campaign_id', v_campaign_id, 'delivery_ledger_id', v_ledger_id, 'financial_ledger_id', v_fin_ledger_id)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'campaign_id', v_campaign_id, 
    'delivery_ledger_id', v_ledger_id,
    'financial_ledger_id', v_fin_ledger_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. ATUALIZAR PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY PARA PROMOVER SALDO PARA AVAILABLE NA CONCLUSÃO
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
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campanha comercial não encontrada.');
  END IF;

  v_start_ts := COALESCE(v_campaign.start_date::timestamptz, '1970-01-01'::timestamptz);
  v_end_ts := COALESCE((v_campaign.end_date::date + 1)::timestamptz, '2099-12-31'::timestamptz);

  -- Trava pessimista no livro de entrega de inserções
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

  -- Processar logs completed da mídia e telas no período
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

    CASE COALESCE(v_log.actual_duration_seconds, v_log.planned_duration_seconds, 10)
      WHEN 5 THEN v_log_credits := 0.5;
      WHEN 15 THEN v_log_credits := 1.5;
      WHEN 30 THEN v_log_credits := 3.0;
      ELSE v_log_credits := 1.0;
    END CASE;

    IF v_log_credits > v_ledger.credits_remaining THEN
      v_credit_deducted := v_ledger.credits_remaining;
    ELSE
      v_credit_deducted := v_log_credits;
    END IF;

    INSERT INTO public.ad_order_delivery_usage (
      delivery_ledger_id, playback_log_id, order_id, campaign_id,
      media_asset_id, screen_id, credits_used, status
    ) VALUES (
      v_ledger.id, v_log.id, v_ledger.order_id, p_campaign_id,
      v_log.media_asset_id, v_log.screen_id, v_credit_deducted, 'used'
    );

    v_ledger.credits_delivered := v_ledger.credits_delivered + v_credit_deducted;
    v_ledger.credits_remaining := v_ledger.credits_remaining - v_credit_deducted;
    v_total_credits_delivered := v_total_credits_delivered + v_credit_deducted;
    v_processed_count := v_processed_count + 1;
  END LOOP;

  -- Atualizar livro de entrega
  UPDATE public.ad_order_delivery_ledger
  SET 
    credits_delivered = v_ledger.credits_delivered,
    credits_remaining = v_ledger.credits_remaining,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- Atualizar campanha
  UPDATE public.campaigns
  SET 
    credits_delivered = v_ledger.credits_delivered,
    status = CASE WHEN v_ledger.credits_remaining <= 0 THEN 'completed' ELSE status END,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  -- SE A ENTREGA ATINGIU 100% (STATUS COMPLETED), PROMOVER REGISTRO FINANCEIRO PARA 'AVAILABLE'
  IF v_ledger.credits_remaining <= 0 THEN
    UPDATE public.seller_financial_ledger
    SET 
      financial_status = 'available',
      delivery_status = 'completed',
      amount_available_cents = seller_net_cents - amount_used_for_discount_cents,
      amount_pending_cents = 0,
      updated_at = NOW()
    WHERE campaign_id = p_campaign_id;

    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (
      auth.uid(), 
      v_ledger.seller_company_id, 
      'SELLER_FINANCIAL_STATUS_PROMOTED_AVAILABLE', 
      jsonb_build_object('campaign_id', p_campaign_id, 'order_id', v_ledger.order_id)
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
