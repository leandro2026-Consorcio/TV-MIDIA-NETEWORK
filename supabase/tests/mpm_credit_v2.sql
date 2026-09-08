BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

DO $test$
DECLARE
  v_company UUID; v_res UUID; v_same UUID; v_payment UUID; v_entry UUID; v_failed BOOLEAN;
  v_summary JSONB;
BEGIN
  INSERT INTO public.companies(trade_name,city,state) VALUES('MPM Wallet Test','Cuiabá','MT') RETURNING id INTO v_company;
  PERFORM public.mpm_grant_credits(v_company,'purchased',500,'test',NULL,'mpm-test:purchased','{}');
  PERFORM public.mpm_grant_credits(v_company,'earned',100,'test',NULL,'mpm-test:earned','{}');
  v_res:=public.mpm_reserve_credits(v_company,450,'media_purchase','test',NULL,'mpm-test:reserve',NULL,'{}');
  v_same:=public.mpm_reserve_credits(v_company,450,'media_purchase','test',NULL,'mpm-test:reserve',NULL,'{}');
  IF v_res<>v_same THEN RAISE EXCEPTION 'FAIL: reserva idempotente divergiu.'; END IF;
  PERFORM public.mpm_consume_reservation(v_res,'mpm-test:capture');
  IF (SELECT available_balance FROM public.wallet_accounts WHERE company_id=v_company AND credit_class='earned')<>0
     OR (SELECT available_balance FROM public.wallet_accounts WHERE company_id=v_company AND credit_class='purchased')<>150 THEN
    RAISE EXCEPTION 'FAIL: prioridade earned/purchased ou consumo incorreto.';
  END IF;
  v_failed:=false;
  BEGIN PERFORM public.mpm_reserve_credits(v_company,151,'media_purchase','test',NULL,'mpm-test:overdraft',NULL,'{}');
  EXCEPTION WHEN OTHERS THEN v_failed:=position('insuficiente' in lower(SQLERRM))>0; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: saldo negativo/double-spend não bloqueado.'; END IF;
  PERFORM public.mpm_grant_credits(v_company,'earned',50,'test',NULL,'mpm-test:earned-2','{}');
  v_payment:=public.mpm_pay_subscription(v_company,30,'monthly','2099-01','mpm-test:subscription');
  IF v_payment IS NULL OR (SELECT available_balance FROM public.wallet_accounts WHERE company_id=v_company AND credit_class='earned')<>20 THEN
    RAISE EXCEPTION 'FAIL: mensalidade não priorizou earned.';
  END IF;
  SELECT id INTO v_entry FROM public.wallet_ledger WHERE idempotency_key='mpm-test:subscription:payment:consume:earned';
  v_failed:=false; BEGIN UPDATE public.wallet_ledger SET amount=999 WHERE id=v_entry;
  EXCEPTION WHEN OTHERS THEN v_failed:=position('imutável' in SQLERRM)>0; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: ledger permitiu mutação.'; END IF;
  PERFORM public.mpm_reverse_ledger_entry(v_entry,'Correção de teste','mpm-test:reversal');
  IF (SELECT available_balance FROM public.wallet_accounts WHERE company_id=v_company AND credit_class='earned')<>50 THEN
    RAISE EXCEPTION 'FAIL: reversal não restaurou saldo.';
  END IF;
  v_summary:=public.mpm_wallet_summary(v_company);
  IF (v_summary->>'available')::numeric<>200 THEN RAISE EXCEPTION 'FAIL: resumo da carteira divergente: %',v_summary; END IF;
END
$test$;

DO $test$
DECLARE
  v_buyer UUID; v_seller UUID; v_screen UUID; v_inventory UUID; v_period UUID; v_bucket UUID;
  v_media UUID; v_offer UUID; v_order UUID; v_campaign UUID; v_log UUID; v_result JSONB;
BEGIN
  INSERT INTO public.companies(trade_name,city,state) VALUES('MPM Buyer','Cuiabá','MT') RETURNING id INTO v_buyer;
  INSERT INTO public.companies(trade_name,city,state) VALUES('MPM Seller','Cuiabá','MT') RETURNING id INTO v_seller;
  INSERT INTO public.screens(company_id,name,orientation,status,device_token_hash)
    VALUES(v_seller,'MPM Screen','horizontal','online','mpm-device-test') RETURNING id INTO v_screen;
  SELECT id INTO v_inventory FROM public.media_inventory WHERE source_type='company_screen' AND source_id=v_screen;
  UPDATE public.media_inventory SET commercial_enabled=true WHERE id=v_inventory;
  INSERT INTO public.inventory_capacity_periods(media_inventory_id,period_start,period_end,calculation_source,theoretical_capacity,available_capacity)
    VALUES(v_inventory,current_date,current_date+30,'manual',2500,2500) RETURNING id INTO v_period;
  INSERT INTO public.inventory_bucket_policies(capacity_period_id,bucket_type,capacity_quantity,reason)
    VALUES(v_period,'automatic_pool',2500,'MPM integration test') RETURNING id INTO v_bucket;
  INSERT INTO public.media_assets(company_id,title,file_path,mime_type,media_type,orientation,playback_duration_seconds,status)
    VALUES(v_buyer,'MPM Ad','mpm/test.png','image/png','image','horizontal',10,'approved') RETURNING id INTO v_media;
  INSERT INTO public.company_ad_offers(company_id,title,credits_amount,duration_seconds,price_cents,platform_fee_percentage,status,is_public)
    VALUES(v_seller,'2000 inserções',2000,10,50000,15,'active',true) RETURNING id INTO v_offer;
  INSERT INTO public.ad_offer_orders(offer_id,seller_company_id,buyer_company_id,buyer_name,gross_amount_cents,
    platform_fee_percentage,platform_fee_cents,seller_net_cents,credits_amount,status,payment_status,approval_status,
    requested_start_date,requested_end_date,requested_media_asset_id)
  VALUES(v_offer,v_seller,v_buyer,'Buyer',50000,15,7500,42500,2000,'approved','pending','approved',current_date,current_date+30,v_media)
  RETURNING id INTO v_order;
  PERFORM public.mpm_grant_credits(v_buyer,'purchased',500,'test',v_order,'mpm-sale:fund','{}');
  v_result:=public.mpm_purchase_media_with_credits(v_order,v_inventory,v_period,v_bucket,'mpm-sale');
  v_campaign:=(v_result->>'campaign_id')::uuid;
  IF v_campaign IS NULL OR (v_result->>'fee_percentage')::numeric<>10 THEN RAISE EXCEPTION 'FAIL: compra/campanha/taxa MPM.'; END IF;
  IF (SELECT available_balance FROM public.wallet_accounts WHERE company_id=v_buyer AND credit_class='purchased')<>0 THEN RAISE EXCEPTION 'FAIL: compra não consumiu créditos.'; END IF;
  INSERT INTO public.playback_logs(company_id,screen_id,media_asset_id,media_type,planned_duration_seconds,actual_duration_seconds,
    started_at,ended_at,played_at,status,idempotency_key,device_token_hash,synced_at)
  VALUES(v_seller,v_screen,v_media,'image',10,10,now(),now(),now(),'completed','mpm-pop-test','mpm-device-test',now()) RETURNING id INTO v_log;
  v_result:=public.process_commercial_campaign_delivery(v_campaign);
  IF NOT EXISTS(SELECT 1 FROM public.settlement_entries WHERE campaign_id=v_campaign AND playback_log_id=v_log AND status='earned'
      AND gross_credits=.25 AND platform_fee_credits=.025 AND supplier_net_credits=.225) THEN
    RAISE EXCEPTION 'FAIL: PoD não gerou settlement gross/fee/net esperado.';
  END IF;
  IF (SELECT available_balance FROM public.wallet_accounts WHERE company_id=v_seller AND credit_class='earned')<>.225 THEN
    RAISE EXCEPTION 'FAIL: earned do fornecedor divergente.';
  END IF;
  IF (SELECT consumed_quantity FROM public.inventory_allocations WHERE campaign_id=v_campaign)<>1 THEN RAISE EXCEPTION 'FAIL: allocation não contabilizou entrega.'; END IF;
  v_result:=public.mpm_cancel_media_purchase(v_order,'Cancelamento de teste','mpm-sale:cancel');
  IF (v_result->>'refunded_credits')::numeric<>499.75 THEN RAISE EXCEPTION 'FAIL: estorno não preservou somente a entrega válida: %',v_result; END IF;
  IF (SELECT available_balance FROM public.wallet_accounts WHERE company_id=v_buyer AND credit_class='purchased')<>499.75 THEN RAISE EXCEPTION 'FAIL: saldo do estorno de mídia divergente.'; END IF;
  IF (SELECT status FROM public.campaigns WHERE id=v_campaign)<>'cancelled' THEN RAISE EXCEPTION 'FAIL: campanha não foi cancelada no reversal.'; END IF;
END
$test$;

ROLLBACK;
