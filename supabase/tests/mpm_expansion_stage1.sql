BEGIN;
SET LOCAL request.jwt.claim.role='service_role';

DO $test$
DECLARE company UUID; creator_company UUID; leader_company UUID; creator UUID; leader UUID; sub UUID; payment UUID;
 slot RECORD; screen_id UUID; creator_total BIGINT; leader_total BIGINT; available_creator BIGINT; reversal_count INTEGER;
BEGIN
 INSERT INTO public.companies(trade_name,city,state) VALUES('Expansion Company','Sinop','MT') RETURNING id INTO company;
 INSERT INTO public.companies(trade_name,city,state) VALUES('Expansion Creator','Sinop','MT') RETURNING id INTO creator_company;
 INSERT INTO public.companies(trade_name,city,state) VALUES('Expansion Leader','Sinop','MT') RETURNING id INTO leader_company;
 INSERT INTO public.affiliate_profiles(company_id,display_name,affiliate_type,status,attribution_code)
 VALUES(creator_company,'Creator Stage 1','general','active','CREATOR-STAGE1') RETURNING id INTO creator;
 INSERT INTO public.affiliate_profiles(company_id,display_name,affiliate_type,status,attribution_code)
 VALUES(leader_company,'Leader Stage 1','general','active','LEADER-STAGE1') RETURNING id INTO leader;
 PERFORM public.set_expansion_affiliate_relationship(leader,creator,'stage1:relationship');
 UPDATE public.expansion_plan_versions SET company_included_insertions=2000,creator_insertions_per_screen=500
 WHERE plan_id=(SELECT id FROM public.expansion_plans WHERE code='mpm-3-tvs') AND effective_to IS NULL;
 sub:=public.create_expansion_subscription(company,'mpm-3-tvs',3,'CREATOR-STAGE1','stage1:subscription');
 IF (SELECT contracted_amount_cents FROM public.company_plan_subscriptions WHERE id=sub)<>29900 THEN RAISE EXCEPTION 'FAIL preço real Plano 3'; END IF;
 IF (SELECT count(*) FROM public.subscription_screen_slots WHERE subscription_id=sub)<>3 THEN RAISE EXCEPTION 'FAIL slots'; END IF;
 payment:=public.record_expansion_payment(sub,'first','2099-01',29900,'stage1-provider','stage1:payment');
 IF public.record_expansion_payment(sub,'first','2099-01',29900,'stage1-provider','stage1:payment')<>payment THEN RAISE EXCEPTION 'FAIL idempotência pagamento'; END IF;
 SELECT sum(amount_cents) FILTER(WHERE beneficiary_role='creator'),sum(amount_cents) FILTER(WHERE beneficiary_role='leader') INTO creator_total,leader_total
 FROM public.expansion_commission_entries WHERE payment_id=payment;
 IF creator_total<>20067 OR leader_total<>6843 THEN RAISE EXCEPTION 'FAIL comissão: creator %, leader %',creator_total,leader_total; END IF;
 IF (SELECT count(*) FROM public.expansion_commission_entries WHERE payment_id=payment AND status='pending_activation')<>6 THEN RAISE EXCEPTION 'FAIL comissão deveria aguardar ativação'; END IF;
 FOR slot IN SELECT * FROM public.subscription_screen_slots WHERE subscription_id=sub ORDER BY slot_index LOOP
  INSERT INTO public.screens(company_id,name,orientation,status) VALUES(company,'Expansion TV '||slot.slot_index,'horizontal','online') RETURNING id INTO screen_id;
  IF slot.slot_index<=2 THEN PERFORM public.activate_expansion_screen_slot(slot.id,screen_id,creator,'stage1:activate:'||slot.id); END IF;
 END LOOP;
 SELECT sum(amount_cents) INTO available_creator FROM public.expansion_commission_entries WHERE payment_id=payment AND beneficiary_role='creator' AND status='available_pending_transfer';
 -- Cada slot recebe a proporção de seu peso econômico real; o último absorve
 -- os resíduos de centavos tanto do plano quanto da comissão.
 IF available_creator<>13376 THEN RAISE EXCEPTION 'FAIL ativação parcial: %',available_creator; END IF;
 SELECT id INTO slot FROM public.subscription_screen_slots WHERE subscription_id=sub AND status='pending' ORDER BY slot_index LIMIT 1;
 INSERT INTO public.screens(company_id,name,orientation,status) VALUES(company,'Expansion TV 3 final','horizontal','online') RETURNING id INTO screen_id;
 PERFORM public.activate_expansion_screen_slot(slot.id,screen_id,creator,'stage1:activate:last');
 IF (SELECT sum(amount_cents) FROM public.expansion_commission_entries WHERE payment_id=payment AND beneficiary_role='creator' AND status='available_pending_transfer')<>20067 THEN RAISE EXCEPTION 'FAIL liberação final'; END IF;
 IF (SELECT count(*) FROM public.inventory_entitlements WHERE beneficiary_type='company' AND beneficiary_id=company)<>1 THEN RAISE EXCEPTION 'FAIL entitlement empresa'; END IF;
 IF (SELECT count(*) FROM public.inventory_entitlements WHERE beneficiary_type='affiliate' AND beneficiary_id=creator)<>3 THEN RAISE EXCEPTION 'FAIL entitlement Creator'; END IF;
 reversal_count:=public.reverse_expansion_payment(payment,'teste','stage1:reversal');
 IF reversal_count<>7 OR public.reverse_expansion_payment(payment,'teste','stage1:reversal')<>0 THEN RAISE EXCEPTION 'FAIL reversal idempotente'; END IF;
 IF EXISTS(SELECT 1 FROM public.wallet_ledger WHERE source_id=payment) THEN RAISE EXCEPTION 'FAIL comissão criou Crédito MPM'; END IF;
END
$test$;
ROLLBACK;
