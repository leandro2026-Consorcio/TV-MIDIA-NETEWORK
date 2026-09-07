-- Monitores Windows têm menor alcance estimado: 10 visualizações equivalem
-- ao valor de 1 visualização de TV, mantendo a cobrança proporcional à duração.
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
  v_screen_device_type TEXT := 'tv';
  v_device_multiplier NUMERIC(12,4) := 1.0;
  v_credits_to_charge NUMERIC(12,4) := 1.0;
  v_previous_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_media_count INTEGER := 0;
  v_screen_count INTEGER := 0;
BEGIN
  SELECT * INTO v_log FROM public.playback_logs WHERE id = p_playback_log_id;
  IF v_log.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log de exibição não encontrado.');
  END IF;
  IF v_log.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas exibições concluídas (status = completed) geram débito de créditos.');
  END IF;

  SELECT COALESCE(device_type, 'tv') INTO v_screen_device_type
  FROM public.screens WHERE id = v_log.screen_id;
  IF v_screen_device_type = 'windows_monitor' THEN
    v_device_multiplier := 0.1;
  END IF;

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
    SELECT COUNT(*) INTO v_media_count FROM public.campaign_media WHERE campaign_id = p_campaign_id AND media_asset_id = v_log.media_asset_id;
    IF v_media_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A mídia do log não pertence à campanha informada.');
    END IF;
    SELECT COUNT(*) INTO v_screen_count FROM public.campaign_screens WHERE campaign_id = p_campaign_id AND screen_id = v_log.screen_id;
    IF v_screen_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A tela não pertence à campanha informada.');
    END IF;
    IF v_campaign.start_date IS NOT NULL AND v_log.played_at < (v_campaign.start_date::text || ' 00:00:00')::timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error', 'Exibição ocorreu antes do início da campanha.');
    END IF;
    IF v_campaign.end_date IS NOT NULL AND v_log.played_at > (v_campaign.end_date::text || ' 23:59:59.999')::timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error', 'Exibição ocorreu após o término da campanha.');
    END IF;
  END IF;

  SELECT * INTO v_existing_charge FROM public.playback_credit_charges WHERE playback_log_id = p_playback_log_id;
  IF v_existing_charge.id IS NOT NULL AND v_existing_charge.charge_status = 'charged' THEN
    RETURN jsonb_build_object('success', true, 'deduplicated', true, 'charged', false, 'credits_charged', 0, 'message', 'Log já debitado com sucesso anteriormente.');
  END IF;

  IF v_log.planned_duration_seconds <= 5 THEN
    v_credits_to_charge := 0.5;
  ELSIF v_log.planned_duration_seconds <= 10 THEN
    v_credits_to_charge := 1.0;
  ELSIF v_log.planned_duration_seconds <= 15 THEN
    v_credits_to_charge := 1.5;
  ELSE
    v_credits_to_charge := 3.0;
  END IF;
  v_credits_to_charge := ROUND(v_credits_to_charge * v_device_multiplier, 4);

  SELECT * INTO v_wallet FROM public.wallets WHERE company_id = v_log.company_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    INSERT INTO public.wallets (company_id, balance) VALUES (v_log.company_id, 0) RETURNING * INTO v_wallet;
  END IF;
  v_previous_balance := v_wallet.balance;
  IF v_previous_balance < v_credits_to_charge THEN
    INSERT INTO public.playback_credit_charges (company_id, wallet_id, playback_log_id, campaign_id, media_asset_id, screen_id, credits_charged, charge_status, failure_reason)
    VALUES (v_log.company_id, v_wallet.id, p_playback_log_id, p_campaign_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'failed', 'Saldo insuficiente na carteira')
    ON CONFLICT (playback_log_id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, credits_charged = EXCLUDED.credits_charged, charge_status = 'failed', failure_reason = 'Saldo insuficiente na carteira';
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente na carteira da empresa.', 'credits_required', v_credits_to_charge, 'balance', v_previous_balance);
  END IF;

  v_new_balance := v_previous_balance - v_credits_to_charge;
  UPDATE public.wallets SET balance = v_new_balance, updated_at = NOW() WHERE id = v_wallet.id;
  INSERT INTO public.wallet_transactions (wallet_id, company_id, previous_balance, amount, new_balance, type, source, source_type, credit_type, source_id, metadata, description)
  VALUES (v_wallet.id, v_log.company_id, v_previous_balance, v_credits_to_charge, v_new_balance, 'debit', 'campaign_spend', 'playback_charge', 'usage_debit', p_playback_log_id::text,
    jsonb_build_object('playback_log_id', p_playback_log_id, 'campaign_id', p_campaign_id, 'media_asset_id', v_log.media_asset_id, 'screen_id', v_log.screen_id, 'duration_seconds', v_log.planned_duration_seconds, 'device_type', v_screen_device_type, 'device_multiplier', v_device_multiplier),
    'Débito por exibição confirmada (Proof of Play)') RETURNING id INTO v_transaction_id;
  INSERT INTO public.playback_credit_charges (company_id, wallet_id, playback_log_id, campaign_id, media_asset_id, screen_id, credits_charged, charge_status, wallet_transaction_id)
  VALUES (v_log.company_id, v_wallet.id, p_playback_log_id, p_campaign_id, v_log.media_asset_id, v_log.screen_id, v_credits_to_charge, 'charged', v_transaction_id)
  ON CONFLICT (playback_log_id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, credits_charged = EXCLUDED.credits_charged, charge_status = 'charged', failure_reason = NULL, wallet_transaction_id = EXCLUDED.wallet_transaction_id;
  RETURN jsonb_build_object('success', true, 'charged', true, 'credits_charged', v_credits_to_charge, 'previous_balance', v_previous_balance, 'new_balance', v_new_balance, 'device_type', v_screen_device_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
