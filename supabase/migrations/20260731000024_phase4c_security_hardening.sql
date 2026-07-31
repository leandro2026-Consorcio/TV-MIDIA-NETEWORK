-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 4C: HARDENING FINANCEIRO E ABATIMENTOS
-- Data: 2026-07-31
-- ============================================================================

-- 1. REESCREVER RPC APPLY_SELLER_MONTHLY_DISCOUNT COM TODAS AS TRAVAS DE SEGURANÇA
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

  -- A. Validar permissão de Master Admin
  SELECT is_master_admin INTO v_is_master FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_is_master, FALSE) THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_UNAUTHORIZED_ATTEMPT', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'Apenas o Master Admin pode aplicar abatimentos manuais de mensalidade.');
  END IF;

  -- B. Validar motivo obrigatório (não nulo e não vazio)
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_EMPTY_REASON_BLOCKED', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'O motivo do abatimento é obrigatório e deve ter uma justificativa válida.');
  END IF;

  -- C. Validar valor positivo
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do abatimento deve ser um número positivo de centavos maior que zero.');
  END IF;

  -- D. Trava pessimista no registro financeiro (FOR UPDATE)
  SELECT * INTO v_ledger 
  FROM public.seller_financial_ledger 
  WHERE id = p_ledger_id 
  FOR UPDATE;

  -- E. Validar existência do ledger
  IF v_ledger.id IS NULL THEN
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (v_user_id, 'MONTHLY_DISCOUNT_LEDGER_NOT_FOUND', jsonb_build_object('ledger_id', p_ledger_id));

    RETURN jsonb_build_object('success', false, 'error', 'Registro financeiro do exibidor não encontrado.');
  END IF;

  -- F. Validar status financeiro (Apenas 'available' ou 'partially_used')
  IF v_ledger.financial_status NOT IN ('available', 'partially_used') THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_ledger.seller_company_id, 'MONTHLY_DISCOUNT_INVALID_STATUS_BLOCKED', jsonb_build_object('ledger_id', p_ledger_id, 'current_status', v_ledger.financial_status));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Abatimentos na mensalidade só podem ser aplicados em registros com saldo liberado e disponível (status available ou partially_used). Status atual: ' || v_ledger.financial_status
    );
  END IF;

  -- G. Validar limite de saldo disponível
  IF p_amount_cents > v_ledger.amount_available_cents THEN
    INSERT INTO public.audit_logs (user_id, company_id, action, details)
    VALUES (v_user_id, v_ledger.seller_company_id, 'MONTHLY_DISCOUNT_EXCEEDS_BALANCE_BLOCKED', jsonb_build_object('requested_cents', p_amount_cents, 'available_cents', v_ledger.amount_available_cents));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'O valor do abatimento (R$ ' || (p_amount_cents::numeric / 100)::text || ') excede o saldo disponível do exibidor (R$ ' || (v_ledger.amount_available_cents::numeric / 100)::text || ').'
    );
  END IF;

  -- H. Calcular novos saldos
  v_new_available := v_ledger.amount_available_cents - p_amount_cents;
  v_new_used := v_ledger.amount_used_for_discount_cents + p_amount_cents;

  IF v_new_available = 0 THEN
    v_new_status := 'used_for_discount';
  ELSE
    v_new_status := 'partially_used';
  END IF;

  -- I. Inserir registro de abatimento
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
    trim(p_reason),
    v_user_id,
    'applied'
  ) RETURNING id INTO v_discount_id;

  -- J. Atualizar o livro financeiro
  UPDATE public.seller_financial_ledger
  SET 
    amount_available_cents = v_new_available,
    amount_used_for_discount_cents = v_new_used,
    financial_status = v_new_status,
    updated_at = NOW()
  WHERE id = v_ledger.id;

  -- K. Audit Log de Sucesso
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

-- 2. REESCREVER PROCESS_COMMERCIAL_CAMPAIGN_DELIVERY GARANTINDO IDEMPOTÊNCIA NA PROMOÇÃO PARA AVAILABLE
CREATE OR REPLACE FUNCTION public.process_commercial_campaign_delivery(
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_campaign RECORD;
  v_ledger RECORD;
  v_log RECORD;
  v_fin_ledger RECORD;
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

  -- PROMOÇÃO IDEMPOTENTE DO REGISTRO FINANCEIRO PARA AVAILABLE
  -- Ocorre APENAS se a entrega zerou E se o registro ainda estiver como 'pending_delivery'
  IF v_ledger.credits_remaining <= 0 THEN
    SELECT * INTO v_fin_ledger 
    FROM public.seller_financial_ledger 
    WHERE campaign_id = p_campaign_id
    FOR UPDATE;

    IF v_fin_ledger.id IS NOT NULL AND v_fin_ledger.financial_status = 'pending_delivery' THEN
      UPDATE public.seller_financial_ledger
      SET 
        financial_status = 'available',
        delivery_status = 'completed',
        amount_available_cents = seller_net_cents - amount_used_for_discount_cents,
        amount_pending_cents = 0,
        updated_at = NOW()
      WHERE id = v_fin_ledger.id;

      INSERT INTO public.audit_logs (user_id, company_id, action, details)
      VALUES (
        auth.uid(), 
        v_ledger.seller_company_id, 
        'SELLER_FINANCIAL_STATUS_PROMOTED_AVAILABLE', 
        jsonb_build_object('campaign_id', p_campaign_id, 'order_id', v_ledger.order_id)
      );
    END IF;
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
