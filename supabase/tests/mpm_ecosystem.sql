BEGIN;
SET LOCAL request.jwt.claim.role='service_role';

DO $test$
DECLARE
 buyer UUID; seller UUID; screen_id UUID; inventory_id UUID; period_id UUID; bucket_id UUID; campaign_id UUID; media_id UUID; offer_id UUID; order_id UUID;
 quote JSONB; matched JSONB; program_id UUID; commission_program_id UUID; attribution_id UUID; commission_id UUID; enrollment_id UUID; entitlement_id UUID; ep_id UUID; q1 UUID; q2 UUID;
 ledger_before BIGINT; ledger_after BIGINT; profile_id UUID; creator_id UUID; v_snapshot_id UUID; score JSONB;
 connection_id UUID; channel_id UUID; social_inventory UUID; social_quote JSONB; contract_id UUID; publication_id UUID; proof_result JSONB; event_id UUID; event_result JSONB;
 wallet_id UUID; payout_id UUID; cashout JSONB; maintenance1 JSONB; maintenance2 JSONB; ecosystem_job1 JSONB; ecosystem_job2 JSONB; failed BOOLEAN; released_count INTEGER; settlement_status TEXT;
BEGIN
 INSERT INTO public.companies(trade_name,city,state) VALUES('Ecosystem Buyer','Cuiabá','MT') RETURNING id INTO buyer;
 INSERT INTO public.companies(trade_name,city,state) VALUES('Ecosystem Seller','Cuiabá','MT') RETURNING id INTO seller;
 INSERT INTO public.screens(company_id,name,orientation,status,device_token_hash)
 VALUES(seller,'Ecosystem Screen','horizontal','online','ecosystem-device') RETURNING id INTO screen_id;
 SELECT id INTO inventory_id FROM public.media_inventory WHERE source_type='company_screen' AND source_id=screen_id;
 UPDATE public.media_inventory SET commercial_enabled=true WHERE id=inventory_id;
 INSERT INTO public.inventory_capacity_periods(media_inventory_id,period_start,period_end,calculation_source,theoretical_capacity,network_capacity,available_capacity)
 VALUES(inventory_id,current_date,current_date+30,'manual',3000,3000,3000) RETURNING id INTO period_id;
 INSERT INTO public.inventory_bucket_policies(capacity_period_id,bucket_type,capacity_quantity,reason)
 VALUES(period_id,'automatic_pool',3000,'Ecosystem test') RETURNING id INTO bucket_id;

 quote:=public.quote_media_inventory(inventory_id,buyer,2000,current_date::timestamptz,(current_date+31)::timestamptz-interval '1 millisecond',10,'image','commercial',NULL,'eco:quote');
 IF (quote->>'gross_credits')::numeric<>500 OR (quote->>'unit_price_credits')::numeric<>.25 THEN RAISE EXCEPTION 'FAIL quote: %',quote; END IF;
 IF public.quote_media_inventory(inventory_id,buyer,2000,current_date::timestamptz,(current_date+31)::timestamptz-interval '1 millisecond',10,'image','commercial',NULL,'eco:quote')->>'deduplicated'<>'true' THEN RAISE EXCEPTION 'FAIL quote idempotency'; END IF;

 INSERT INTO public.media_assets(company_id,title,file_path,mime_type,media_type,orientation,playback_duration_seconds,status)
 VALUES(buyer,'Ecosystem Ad','ecosystem/ad.png','image/png','image','horizontal',10,'approved') RETURNING id INTO media_id;
 INSERT INTO public.company_ad_offers(company_id,title,credits_amount,duration_seconds,price_cents,platform_fee_percentage,status,is_public)
 VALUES(seller,'Ecosystem Offer',1000,10,25000,10,'active',true) RETURNING id INTO offer_id;
 INSERT INTO public.ad_offer_orders(offer_id,seller_company_id,buyer_company_id,buyer_name,gross_amount_cents,platform_fee_percentage,
   platform_fee_cents,seller_net_cents,credits_amount,status,payment_status,approval_status,requested_start_date,requested_end_date,requested_media_asset_id)
 VALUES(offer_id,seller,buyer,'Buyer',25000,10,2500,22500,1000,'paid_manual','paid_manual','approved',current_date,current_date+30,media_id) RETURNING id INTO order_id;
 INSERT INTO public.campaigns(company_id,buyer_company_id,seller_company_id,ad_offer_order_id,name,campaign_type,status,start_date,end_date,target_insertions)
 VALUES(buyer,buyer,seller,order_id,'Ecosystem Matching','commercial','active',current_date,current_date+30,1000) RETURNING id INTO campaign_id;
 INSERT INTO public.campaign_media(campaign_id,media_asset_id,playback_duration_seconds,is_active) VALUES(campaign_id,media_id,10,true);
 matched:=public.run_campaign_matching(campaign_id,1000,'eco:matching');
 IF (matched->>'allocated_insertions')::bigint<>1000 OR matched->>'status'<>'completed' THEN RAISE EXCEPTION 'FAIL matching: %',matched; END IF;
 IF (SELECT count(*) FROM public.matching_decisions WHERE run_id=(matched->>'run_id')::uuid)<>1 THEN RAISE EXCEPTION 'FAIL matching decision audit'; END IF;
 IF public.run_campaign_matching(campaign_id,1000,'eco:matching')->>'deduplicated'<>'true' THEN RAISE EXCEPTION 'FAIL matching idempotency'; END IF;
 INSERT INTO public.campaign_matching_requirements(campaign_id,target_cities,max_budget_credits) VALUES(campaign_id,ARRAY['Cidade sem inventário'],1000);
 matched:=public.run_campaign_matching(campaign_id,100,'eco:matching-filtered');
 IF matched->>'status'<>'failed' OR NOT EXISTS(SELECT 1 FROM public.matching_candidates WHERE run_id=(matched->>'run_id')::uuid AND 'city_mismatch'=ANY(exclusion_reasons)) THEN RAISE EXCEPTION 'FAIL matching city filter: %',matched; END IF;
 UPDATE public.inventory_bucket_policies SET capacity_quantity=1500 WHERE id=bucket_id;
 failed:=false; BEGIN INSERT INTO public.inventory_bucket_policies(capacity_period_id,bucket_type,capacity_quantity,reason) VALUES(period_id,'mpm_growth',1001,'growth test'); EXCEPTION WHEN OTHERS THEN failed:=position('limite' in lower(SQLERRM))>0; END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL Growth configurable cap'; END IF;

 PERFORM public.mpm_grant_credits(buyer,'purchased',10,'test',NULL,'eco:purchased-policy','{}');
 UPDATE public.mpm_spend_policies SET credit_class_order=ARRAY['earned'] WHERE purpose='monthly_subscription';
 failed:=false; BEGIN PERFORM public.mpm_pay_subscription(buyer,1,'monthly','eco-policy','eco:subscription-policy'); EXCEPTION WHEN OTHERS THEN failed:=position('insuficiente' in lower(SQLERRM))>0; END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL configurable spend policy'; END IF;
 UPDATE public.mpm_spend_policies SET credit_class_order=ARRAY['earned','purchased'] WHERE purpose='monthly_subscription';

 INSERT INTO public.partner_programs(code,name,program_type,reward_type,reward_value)
 VALUES('ECO-RACON','Racon Test','partner','media_entitlement',2000) RETURNING id INTO program_id;
 INSERT INTO public.partnership_enrollments(program_id,participant_type,participant_id)
 VALUES(program_id,'company',buyer) RETURNING id INTO enrollment_id;
 INSERT INTO public.inventory_entitlements(program_id,enrollment_id,inventory_id,beneficiary_type,beneficiary_id,insertion_quantity,recurrence,unused_policy,starts_at,ends_at)
 VALUES(program_id,enrollment_id,inventory_id,'company',buyer,2000,'monthly','return_to_pool',now(),now()+interval '1 year') RETURNING id INTO entitlement_id;
 INSERT INTO public.entitlement_periods(entitlement_id,period_start,period_end,granted_quantity)
 VALUES(entitlement_id,current_date,current_date+30,2000) RETURNING id INTO ep_id;
 SELECT count(*) INTO ledger_before FROM public.wallet_ledger;
 q1:=public.consume_inventory_entitlement(ep_id,campaign_id,500,'eco:quota');
 q2:=public.consume_inventory_entitlement(ep_id,campaign_id,500,'eco:quota');
 IF q1<>q2 OR (SELECT used_quantity FROM public.entitlement_periods WHERE id=ep_id)<>500 THEN RAISE EXCEPTION 'FAIL entitlement idempotency'; END IF;
 failed:=false; BEGIN PERFORM public.consume_inventory_entitlement(ep_id,campaign_id,1600,'eco:quota-over'); EXCEPTION WHEN OTHERS THEN failed:=position('insuficiente' in lower(SQLERRM))>0; END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL entitlement overuse'; END IF;
 SELECT count(*) INTO ledger_after FROM public.wallet_ledger;
 IF ledger_before<>ledger_after THEN RAISE EXCEPTION 'FAIL entitlement generated credit'; END IF;

 SELECT id INTO profile_id FROM public.profiles WHERE NOT COALESCE(is_master_admin,false) ORDER BY created_at LIMIT 1;
 IF profile_id IS NULL THEN RAISE EXCEPTION 'FAIL no profile fixture available'; END IF;
 INSERT INTO public.creator_profiles(user_id,display_name,status,terms_accepted_at) VALUES(profile_id,'Creator Test','active',now()) RETURNING id INTO creator_id;
 INSERT INTO public.creator_metric_snapshots(creator_id,followers,follower_growth,views,engagement_rate,local_relevance,completed_campaigns,delayed_campaigns,refused_campaigns,advertiser_rating)
 VALUES(creator_id,25000,5,100000,4.5,80,9,1,0,4.8) RETURNING id INTO v_snapshot_id;
 score:=public.recalculate_creator_score(creator_id,v_snapshot_id,'creator-v1');
 IF (score->>'creator_score')::numeric<=0 OR (score->>'media_value_score')::numeric<=0 OR NOT EXISTS(SELECT 1 FROM public.creator_score_history h WHERE h.snapshot_id=v_snapshot_id) THEN RAISE EXCEPTION 'FAIL creator score: %',score; END IF;

 INSERT INTO public.social_connections(owner_type,owner_id,provider,provider_account_id,status)
 VALUES('company',seller,'instagram','eco-account','active') RETURNING id INTO connection_id;
 INSERT INTO public.social_channels(connection_id,owner_type,owner_id,provider,channel_type,provider_channel_id,display_name,participation_enabled,status,max_publications_per_month)
 VALUES(connection_id,'company',seller,'instagram','instagram_professional','eco-channel','Canal Eco',true,'active',10) RETURNING id INTO channel_id;
 SELECT id INTO social_inventory FROM public.media_inventory WHERE source_type='social_channel' AND source_id=channel_id;
 IF social_inventory IS NULL OR NOT (SELECT commercial_enabled FROM public.media_inventory WHERE id=social_inventory) THEN RAISE EXCEPTION 'FAIL social inventory adapter'; END IF;
 social_quote:=public.quote_media_inventory(social_inventory,buyer,10,current_date::timestamptz,(current_date+31)::timestamptz-interval '1 millisecond',NULL,'feed','commercial',NULL,'eco:social-quote');
 contract_id:=public.create_media_commercial_contract((social_quote->>'quote_id')::uuid,campaign_id,'company',seller,'eco:social-contract');
 INSERT INTO public.social_publications(channel_id,campaign_id,media_asset_id,status,published_at,idempotency_key,proof)
 VALUES(channel_id,campaign_id,media_id,'published',now(),'eco:publication','{"provider_permalink":"https://example.invalid/proof"}') RETURNING id INTO publication_id;
 proof_result:=public.record_validated_delivery_proof(contract_id,'social_publication',publication_id,1,now(),'{"validated_by":"test"}','eco:social-proof');
 IF proof_result->>'status'<>'pending' OR (proof_result->>'supplier_net_credits')::numeric<>.45 THEN RAISE EXCEPTION 'FAIL social pending settlement: %',proof_result; END IF;
 released_count:=public.release_pending_mpm_settlements(now()+interval '49 hours');
 SELECT status INTO settlement_status FROM public.settlement_entries WHERE id=(proof_result->>'settlement_id')::uuid;
 IF released_count<1 OR settlement_status<>'earned' THEN RAISE EXCEPTION 'FAIL social retention release count %, status %, proof %',released_count,settlement_status,proof_result; END IF;
 INSERT INTO public.partner_programs(code,name,program_type,reward_type,reward_value,reward_cap)
 VALUES('ECO-AFFILIATE','Afiliado Test','affiliate','recurring_percentage',10,1) RETURNING id INTO commission_program_id;
 INSERT INTO public.acquisition_attributions(program_id,source_type,source_code,attributed_holder_type,attributed_holder_id,converted_company_id,idempotency_key)
 VALUES(commission_program_id,'code','ECO','company',buyer,buyer,'eco:attribution') RETURNING id INTO attribution_id;
 commission_id:=public.accrue_partner_commission(attribution_id,(proof_result->>'settlement_id')::uuid,'2099-01','eco:commission');
 IF commission_id IS NULL OR public.release_partner_commissions(now())<>1 THEN RAISE EXCEPTION 'FAIL partner commission'; END IF;

 INSERT INTO public.events(owner_company_id,name,city,state,starts_at,ends_at,status)
 VALUES(seller,'Evento Eco','Cuiabá','MT',now()+interval '1 day',now()+interval '2 days','active') RETURNING id INTO event_id;
 event_result:=public.create_event_inventory(event_id,'Painel Evento',1000,300,700,'eco:event');
 IF (event_result->>'event_inventory_id') IS NULL OR (SELECT total_capacity FROM public.event_inventory WHERE id=(event_result->>'event_inventory_id')::uuid)<>1000 THEN RAISE EXCEPTION 'FAIL event inventory: %',event_result; END IF;

 PERFORM public.mpm_grant_credits(buyer,'earned',100,'test',NULL,'eco:earned','{}');
 SELECT id INTO wallet_id FROM public.wallet_accounts WHERE company_id=buyer AND credit_class='earned';
 UPDATE public.wallet_accounts SET cashout_eligible_balance=100 WHERE id=wallet_id;
 INSERT INTO public.payout_accounts(holder_type,holder_id,status,kyc_status) VALUES('company',buyer,'verified','approved') RETURNING id INTO payout_id;
 cashout:=public.create_cashout_simulation(payout_id,wallet_id,50,'eco:cashout');
 IF cashout->>'status'<>'blocked' OR cashout->>'simulation_only'<>'true' OR NOT ((cashout->'block_reasons') ? 'cashout_feature_disabled') THEN RAISE EXCEPTION 'FAIL cashout guard: %',cashout; END IF;

 maintenance1:=public.run_mpm_maintenance('eco:test-run'); maintenance2:=public.run_mpm_maintenance('eco:test-run');
 IF maintenance2->>'deduplicated'<>'true' THEN RAISE EXCEPTION 'FAIL maintenance idempotency: %',maintenance2; END IF;
 ecosystem_job1:=public.run_mpm_ecosystem_jobs('eco:ecosystem-job'); ecosystem_job2:=public.run_mpm_ecosystem_jobs('eco:ecosystem-job');
 IF ecosystem_job2->>'deduplicated'<>'true' THEN RAISE EXCEPTION 'FAIL ecosystem job idempotency: %',ecosystem_job2; END IF;
END
$test$;

DO $rls$
DECLARE uid UUID; cid UUID; visible_count INTEGER; denied BOOLEAN;
BEGIN
 SELECT user_id,id INTO uid,cid FROM public.creator_profiles WHERE display_name='Creator Test';
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO visible_count FROM public.creator_score_history WHERE creator_id=cid;
 IF visible_count<>1 THEN RAISE EXCEPTION 'FAIL creator self RLS'; END IF;
 SELECT count(*) INTO visible_count FROM public.social_connections WHERE provider_account_id='eco-account';
 IF visible_count<>0 THEN RAISE EXCEPTION 'FAIL creator accessed company social token metadata'; END IF;
 denied:=false; BEGIN PERFORM encrypted_access_token FROM public.social_connections LIMIT 1; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL encrypted social token column exposed'; END IF;
 SELECT count(*) INTO visible_count FROM public.legacy_balance_reconciliations;
 IF visible_count<>0 THEN RAISE EXCEPTION 'FAIL non-master accessed legacy reconciliation'; END IF;
 denied:=false; BEGIN PERFORM public.get_mpm_admin_dashboard(); EXCEPTION WHEN OTHERS THEN denied:=position('Master' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL non-master accessed admin dashboard'; END IF;
END
$rls$;

ROLLBACK;
