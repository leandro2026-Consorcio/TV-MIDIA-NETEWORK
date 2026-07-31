-- ============================================================================
-- REDE INDOOR LOCAL - MIGRAÇÃO MVP 3B: AUDITORIA E HARDENING DE CRÉDITOS
-- Data: 2026-07-31
-- ============================================================================

-- 1. ATUALIZAR CHECK CONSTRAINT DE CREDIT_TYPE EM WALLET_TRANSACTIONS
DO $$ 
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_credit_type_check;
  
  -- Adicionar 'usage_debit' aos tipos de crédito aceitos
  ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_credit_type_check
    CHECK (credit_type IN (
      'paid_credit', 
      'trial_credit', 
      'exchange_credit', 
      'bonus_credit', 
      'referral_credit', 
      'network_inventory_credit', 
      'monthly_network_quota',
      'usage_debit'
    ));
END $$;

-- 2. REESCREVER RPC CHARGE_PLAYBACK_CREDIT COM CAMPAIGN_ID CORRETO, RETRY E USAGE_DEBIT
CREATE OR REPLACE FUNCTION public.charge_playback_credit(
  p_playback_log_id UUID,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_log RECORD;
  v_campaign RECORD;
  v_wallet RECORD;
  v_existing_charge RECORD;
  v_credits_to_charge NUMERIC(12,2) := 1.0;
  v_previous_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_media_count INTEGER := 0;
  v_screen_count INTEGER := 0;
BEGIN
  -- 1. Buscar o log de exibição
  SELECT * INTO v_log FROM public.playback_logs WHERE id = p_playback_log_id;
  
  IF v_log.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log de exibição não encontrado.');
  END IF;

  -- 2. Validar se o status é 'completed'
  IF v_log.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas exibições concluídas (status = completed) geram débito de créditos.');
  END IF;

  -- 3. Se p_campaign_id for informado, validar integridade da campanha
  IF p_campaign_id IS NOT NULL THEN
    SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;

    IF v_campaign.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Campanha informada não foi encontrada.');
    END IF;

    IF v_campaign.company_id != v_log.company_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Violação de segurança: A campanha pertence a outra empresa.');
    END IF;

    IF v_campaign.status IN ('archived', 'cancelled', 'completed') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Campanha finalizada ou arquivada não pode processar novos débitos.');
    END IF;

    -- Validar se a mídia pertence à campanha
    SELECT COUNT(*) INTO v_media_count FROM public.campaign_media 
    WHERE campaign_id = p_campaign_id AND media_asset_id = v_log.media_asset_id;

    IF v_media_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A mídia do log não pertence à campanha informada.');
    END IF;

    -- Validar se a tela pertence à campanha
    SELECT COUNT(*) INTO v_screen_count FROM public.campaign_screens 
    WHERE campaign_id = p_campaign_id AND screen_id = v_log.screen_id;

    IF v_screen_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A tela do log não pertence à campanha informada.');
    END IF;

    -- Validar período da campanha, quando houver
    IF v_campaign.start_date IS NOT NULL AND v_log.played_at < (v_campaign.start_date::text || ' 00:00:00')::timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error', 'Exibição ocorreu antes do início da campanha.');
    END IF;

    IF v_campaign.end_date IS NOT NULL AND v_log.played_at > (v_campaign.end_date::text || ' 23:59:59.999')::timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error', 'Exibição ocorreu após o término da campanha.');
    END IF;
  END IF;

  -- 4. Verificar se o log já foi cobrado (Idempotência com Retry)
  SELECT * INTO v_existing_charge FROM public.playback_credit_charges WHERE playback_log_id = p_playback_log_id;
  
  IF v_existing_charge.id IS NOT NULL THEN
    -- Se já foi cobrado com SUCESSO, retorna deduplicated = true (não repete o débito)
    IF v_existing_charge.charge_status = 'charged' THEN
      RETURN jsonb_build_object(
        'success', true, 
        'deduplicated', true, 
        'charged', false, 
        'credits_charged', 0, 
        'message', 'Log já debitado com sucesso anteriormente.'
      );
    END IF;
    -- Se falhou anteriormente por saldo insuficiente, o fluxo continua permitindo RETRY!
  END IF;

  -- 5. Calcular valor do débito conforme a duração planejada
  -- 5s = 0,5 CR | 10s = 1,0 CR | 15s = 1,5 CR | 30s = 3,0 CR
  IF v_log.planned_duration_seconds <= 5 THEN
    v_credits_to_charge := 0.5;
  ELSIF v_log.planned_duration_seconds <= 10 THEN
    v_credits_to_charge := 1.0;
  ELSIF v_log.planned_duration_seconds <= 15 THEN
    v_credits_to_charge := 1.5;
  ELSE
    v_credits_to_charge := 3.0;
  END IF;

  -- 6. Localizar carteira da empresa proprietária com trava pessimista FOR UPDATE
  SELECT * INTO v_wallet FROM public.wallets WHERE company_id = v_log.company_id FOR UPDATE;
  
  IF v_wallet.id IS NULL THEN
    INSERT INTO public.wallets (company_id, balance) VALUES (v_log.company_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_previous_balance := v_wallet.balance;

  -- 7. Validar saldo suficiente
  IF v_previous_balance < v_credits_to_charge THEN
    -- Gravar ou atualizar registro com status 'failed'
    INSERT INTO public.playback_credit_charges (
      company_id, wallet_id, playback_log_id, campaign_id, media_asset_id, screen_id, credits_charged, charge_status, failure_reason
    ) VALUES (
      v_log.company_id, v_wallet.id, p_playback_log_id, p_campaign_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'failed', 'Saldo insuficiente na carteira'
    ) ON CONFLICT (playback_log_id) DO UPDATE SET 
      campaign_id = EXCLUDED.campaign_id,
      charge_status = 'failed', 
      failure_reason = 'Saldo insuficiente na carteira';

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo insuficiente na carteira da empresa.', 
      'credits_required', v_credits_to_charge, 
      'balance', v_previous_balance
    );
  END IF;

  -- 8. Debitar da carteira (Saldo nunca fica negativo devido ao check anterior)
  v_new_balance := v_previous_balance - v_credits_to_charge;
  
  UPDATE public.wallets 
  SET balance = v_new_balance, updated_at = NOW() 
  WHERE id = v_wallet.id;

  -- 9. Criar registro em wallet_transactions com credit_type = 'usage_debit' e metadata
  INSERT INTO public.wallet_transactions (
    wallet_id, 
    company_id, 
    previous_balance, 
    amount, 
    new_balance, 
    type, 
    source, 
    source_type, 
    credit_type, 
    source_id,
    metadata,
    description
  ) VALUES (
    v_wallet.id, 
    v_log.company_id, 
    v_previous_balance, 
    v_credits_to_charge, 
    v_new_balance, 
    'debit', 
    'campaign_spend', 
    'playback_charge', 
    'usage_debit', 
    p_playback_log_id::text,
    jsonb_build_object(
      'playback_log_id', p_playback_log_id,
      'campaign_id', p_campaign_id,
      'media_asset_id', v_log.media_asset_id,
      'screen_id', v_log.screen_id,
      'duration_seconds', v_log.planned_duration_seconds
    ),
    'Débito por exibição confirmada (Proof of Play)'
  ) RETURNING id INTO v_transaction_id;

  -- 10. Registrar/Atualizar em playback_credit_charges com status 'charged'
  INSERT INTO public.playback_credit_charges (
    company_id, wallet_id, playback_log_id, campaign_id, media_asset_id, screen_id, credits_charged, charge_status, wallet_transaction_id
  ) VALUES (
    v_log.company_id, v_wallet.id, p_playback_log_id, p_campaign_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'charged', v_transaction_id
  ) ON CONFLICT (playback_log_id) DO UPDATE SET
    campaign_id = EXCLUDED.campaign_id,
    charge_status = 'charged', 
    failure_reason = NULL, 
    wallet_transaction_id = v_transaction_id;

  RETURN jsonb_build_object(
    'success', true, 
    'charged', true, 
    'credits_charged', v_credits_to_charge, 
    'previous_balance', v_previous_balance, 
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
