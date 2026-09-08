-- Funções transacionais, adapters e jobs do ecossistema MPM.

CREATE OR REPLACE FUNCTION public.sync_wallet_ledger_holder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.wallet_accounts%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.wallet_accounts WHERE id=NEW.account_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Conta MPM inexistente.'; END IF;
  NEW.holder_type:=a.holder_type; NEW.holder_id:=a.holder_id; NEW.company_id:=a.company_id;
  NEW.forecast_balance_after:=a.forecast_balance;
  NEW.cashout_eligible_balance_after:=a.cashout_eligible_balance;
  NEW.in_cashout_balance_after:=a.in_cashout_balance;
  NEW.settled_balance_after:=a.settled_balance;
  NEW.disputed_balance_after:=a.disputed_balance;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wallet_ledger_holder ON public.wallet_ledger;
CREATE TRIGGER trg_wallet_ledger_holder BEFORE INSERT ON public.wallet_ledger
FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_ledger_holder();

CREATE OR REPLACE FUNCTION public.mpm_can_manage_holder(p_holder_type TEXT,p_holder_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
 SELECT auth.role()='service_role' OR public.is_master_admin() OR
   (p_holder_type='company' AND p_holder_id IN (SELECT public.get_user_admin_company_ids())) OR
   (p_holder_type='organic_participant' AND EXISTS(SELECT 1 FROM public.organic_participants WHERE id=p_holder_id AND user_id=auth.uid())) OR
   (p_holder_type='creator' AND EXISTS(SELECT 1 FROM public.creator_profiles WHERE id=p_holder_id AND user_id=auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.mpm_ensure_holder_account(p_holder_type TEXT,p_holder_id UUID,p_credit_class TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id UUID;
BEGIN
 IF p_holder_type NOT IN ('company','organic_participant','creator','affiliate','partner','platform') OR
    p_credit_class NOT IN ('earned','purchased','promotional','legacy_organic') THEN RAISE EXCEPTION 'Titular ou classe inválida.'; END IF;
 INSERT INTO public.wallet_accounts(company_id,holder_type,holder_id,credit_class)
 VALUES(CASE WHEN p_holder_type='company' THEN p_holder_id END,p_holder_type,p_holder_id,p_credit_class)
 ON CONFLICT (holder_type,holder_id,credit_class) DO UPDATE SET holder_id=EXCLUDED.holder_id
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.quote_media_inventory(
 p_inventory_id UUID,p_buyer_company_id UUID,p_insertion_quantity BIGINT,p_starts_at TIMESTAMPTZ,p_ends_at TIMESTAMPTZ,
 p_duration_seconds INTEGER DEFAULT NULL,p_format TEXT DEFAULT NULL,p_campaign_type TEXT DEFAULT NULL,p_plan_code TEXT DEFAULT NULL,
 p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inv public.media_inventory%ROWTYPE; rule public.media_price_rules%ROWTYPE; qid UUID; unit NUMERIC(18,6); gross NUMERIC(18,4);
BEGIN
 IF NOT public.mpm_can_manage_company(p_buyer_company_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF p_insertion_quantity<=0 OR p_ends_at<p_starts_at OR NULLIF(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Cotação inválida.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('mpm-quote:'||p_idempotency_key,0));
 SELECT id INTO qid FROM public.media_price_quotes WHERE idempotency_key=p_idempotency_key;
 IF qid IS NOT NULL THEN SELECT * INTO rule FROM public.media_price_rules WHERE id=(SELECT price_rule_id FROM public.media_price_quotes WHERE id=qid); RETURN jsonb_build_object('success',true,'deduplicated',true,'quote_id',qid); END IF;
 SELECT * INTO inv FROM public.media_inventory WHERE id=p_inventory_id AND status='active' AND commercial_enabled FOR SHARE;
 IF inv.id IS NULL THEN RAISE EXCEPTION 'Inventário indisponível.'; END IF;
 SELECT * INTO rule FROM public.media_price_rules r WHERE r.is_active AND r.effective_from<=now() AND (r.effective_to IS NULL OR r.effective_to>now())
   AND (r.inventory_id IS NULL OR r.inventory_id=inv.id) AND (r.channel_family IS NULL OR r.channel_family=inv.channel_family)
   AND (r.city IS NULL OR r.city=inv.city) AND (r.state IS NULL OR r.state=inv.state)
   AND (r.inventory_type IS NULL OR r.inventory_type=inv.inventory_type)
   AND (r.duration_seconds IS NULL OR r.duration_seconds=p_duration_seconds) AND (r.format IS NULL OR r.format=p_format)
   AND (r.campaign_type IS NULL OR r.campaign_type=p_campaign_type) AND (r.plan_code IS NULL OR r.plan_code=p_plan_code)
 ORDER BY r.priority DESC,
   ((r.inventory_id IS NOT NULL)::int+(r.city IS NOT NULL)::int+(r.state IS NOT NULL)::int+(r.inventory_type IS NOT NULL)::int+
    (r.duration_seconds IS NOT NULL)::int+(r.format IS NOT NULL)::int+(r.campaign_type IS NOT NULL)::int+(r.plan_code IS NOT NULL)::int) DESC,
   r.version DESC LIMIT 1;
 IF rule.id IS NULL THEN RAISE EXCEPTION 'Regra de preço aplicável não encontrada.'; END IF;
 unit:=round(rule.unit_price_credits*rule.occupancy_multiplier,6); gross:=round(unit*p_insertion_quantity,4);
 INSERT INTO public.media_price_quotes(buyer_company_id,inventory_id,price_rule_id,insertion_quantity,unit_price_credits,gross_credits,
   pricing_context,starts_at,ends_at,expires_at,idempotency_key)
 VALUES(p_buyer_company_id,inv.id,rule.id,p_insertion_quantity,unit,gross,jsonb_build_object('duration_seconds',p_duration_seconds,'format',p_format,
   'campaign_type',p_campaign_type,'plan_code',p_plan_code,'rule_code',rule.code,'rule_version',rule.version),p_starts_at,p_ends_at,now()+interval '30 minutes',p_idempotency_key)
 RETURNING id INTO qid;
 RETURN jsonb_build_object('success',true,'quote_id',qid,'unit_price_credits',unit,'gross_credits',gross,'rule_code',rule.code,'rule_version',rule.version);
END $$;

CREATE OR REPLACE FUNCTION public.run_campaign_matching(p_campaign_id UUID,p_requested_insertions BIGINT,p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE camp public.campaigns%ROWTYPE; rid UUID; remaining BIGINT:=p_requested_insertions; take_qty BIGINT; allocation_id UUID;
 c RECORD; rank_no INTEGER:=0; allocated BIGINT:=0; starts_ts TIMESTAMPTZ; ends_ts TIMESTAMPTZ;
BEGIN
 SELECT * INTO camp FROM public.campaigns WHERE id=p_campaign_id FOR SHARE;
 IF camp.id IS NULL OR NOT public.mpm_can_manage_company(COALESCE(camp.buyer_company_id,camp.company_id)) THEN RAISE EXCEPTION 'Campanha inválida ou acesso negado.'; END IF;
 IF p_requested_insertions<=0 OR NULLIF(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Matching inválido.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('matching:'||p_idempotency_key,0));
 SELECT id INTO rid FROM public.matching_runs WHERE idempotency_key=p_idempotency_key;
 IF rid IS NOT NULL THEN RETURN (SELECT jsonb_build_object('success',true,'deduplicated',true,'run_id',id,'allocated_insertions',allocated_insertions,'status',status) FROM public.matching_runs WHERE id=rid); END IF;
 starts_ts:=COALESCE(camp.start_date,current_date)::timestamptz; ends_ts:=(COALESCE(camp.end_date,current_date+30)+1)::timestamptz-interval '1 millisecond';
 INSERT INTO public.matching_runs(campaign_id,buyer_company_id,requested_insertions,idempotency_key,weights)
 VALUES(camp.id,COALESCE(camp.buyer_company_id,camp.company_id),p_requested_insertions,p_idempotency_key,
   '{"availability":0.35,"underdelivery":0.25,"preferred":0.20,"diversity":0.10,"new_supplier":0.10}'::jsonb) RETURNING id INTO rid;

 INSERT INTO public.matching_candidates(run_id,inventory_id,capacity_period_id,bucket_policy_id,eligible,score,available_capacity,score_components,exclusion_reasons)
 SELECT rid,i.id,cp.id,b.id,
   (i.status='active' AND i.commercial_enabled AND cp.status='active' AND b.status='active' AND
    (np.company_id IS NULL OR COALESCE(np.accepts_network_ads,true)) AND
    (np.blocked_companies IS NULL OR NOT (COALESCE(camp.buyer_company_id,camp.company_id)=ANY(np.blocked_companies))) AND
    GREATEST(0,LEAST(cp.available_capacity,b.capacity_quantity-b.allocated_quantity))>0 AND
    (b.bucket_type='automatic_pool' OR (b.bucket_type='preferred' AND pref.id IS NOT NULL))) AS eligible,
   round(
     LEAST(100,GREATEST(0,LEAST(cp.available_capacity,b.capacity_quantity-b.allocated_quantity))::numeric/NULLIF(cp.theoretical_capacity,0)*100)*0.35 +
     LEAST(100,GREATEST(0,COALESCE(camp.target_insertions,0)-COALESCE(camp.delivered_insertions,0))::numeric/GREATEST(1,COALESCE(camp.target_insertions,1))*100)*0.25 +
     (CASE WHEN pref.id IS NOT NULL THEN 100 ELSE 0 END)*0.20 +
     (100.0/(1+(SELECT count(*) FROM public.matching_decisions md WHERE md.inventory_id=i.id)))*0.10 +
     (100.0/(1+(SELECT count(*) FROM public.media_inventory oi WHERE oi.owner_type=i.owner_type AND oi.owner_id=i.owner_id)))*0.10,6),
   GREATEST(0,LEAST(cp.available_capacity,b.capacity_quantity-b.allocated_quantity)),
   jsonb_build_object('available',GREATEST(0,LEAST(cp.available_capacity,b.capacity_quantity-b.allocated_quantity)),
     'preferred',pref.id IS NOT NULL,'prior_decisions',(SELECT count(*) FROM public.matching_decisions md WHERE md.inventory_id=i.id),
     'owner_inventory_count',(SELECT count(*) FROM public.media_inventory oi WHERE oi.owner_type=i.owner_type AND oi.owner_id=i.owner_id)),
   ARRAY_REMOVE(ARRAY[
     CASE WHEN i.status<>'active' OR NOT i.commercial_enabled THEN 'inventory_unavailable' END,
     CASE WHEN cp.status<>'active' OR b.status<>'active' THEN 'capacity_unavailable' END,
     CASE WHEN np.company_id IS NOT NULL AND NOT COALESCE(np.accepts_network_ads,true) THEN 'network_opt_out' END,
     CASE WHEN np.blocked_companies IS NOT NULL AND COALESCE(camp.buyer_company_id,camp.company_id)=ANY(np.blocked_companies) THEN 'buyer_blocked' END,
     CASE WHEN b.bucket_type='preferred' AND pref.id IS NULL THEN 'not_preferred' END,
     CASE WHEN GREATEST(0,LEAST(cp.available_capacity,b.capacity_quantity-b.allocated_quantity))<=0 THEN 'no_capacity' END
   ],NULL)
 FROM public.media_inventory i
 JOIN public.inventory_capacity_periods cp ON cp.media_inventory_id=i.id AND cp.period_start<=starts_ts::date AND cp.period_end>=ends_ts::date
 JOIN public.inventory_bucket_policies b ON b.capacity_period_id=cp.id AND b.bucket_type IN ('automatic_pool','preferred')
 LEFT JOIN public.company_network_preferences np ON i.owner_type='company' AND np.company_id=i.owner_id
 LEFT JOIN public.inventory_preferred_participants pref ON pref.inventory_id=i.id AND pref.preferred_company_id=COALESCE(camp.buyer_company_id,camp.company_id)
   AND pref.status='active' AND starts_ts BETWEEN pref.starts_at AND pref.ends_at
 WHERE i.source_type='company_screen';

 FOR c IN SELECT mc.*,i.source_id,b.bucket_type FROM public.matching_candidates mc JOIN public.media_inventory i ON i.id=mc.inventory_id
   JOIN public.inventory_bucket_policies b ON b.id=mc.bucket_policy_id WHERE mc.run_id=rid AND mc.eligible ORDER BY mc.score DESC,mc.inventory_id LOOP
   EXIT WHEN remaining<=0; take_qty:=LEAST(remaining,c.available_capacity); IF take_qty<=0 THEN CONTINUE; END IF;
   BEGIN
    INSERT INTO public.inventory_allocations(inventory_id,capacity_period_id,bucket_policy_id,allocation_type,beneficiary_type,beneficiary_id,
      insertion_quantity,reserved_quantity,status,starts_at,ends_at,expires_at,release_policy,source_type,source_id,idempotency_key,created_by,campaign_id)
    VALUES(c.inventory_id,c.capacity_period_id,c.bucket_policy_id,CASE WHEN c.bucket_type='preferred' THEN 'preferred' ELSE 'commercial_reservation' END,
      'company',COALESCE(camp.buyer_company_id,camp.company_id),take_qty,take_qty,'committed',starts_ts,ends_ts,NULL,
      jsonb_build_object('matching_run_id',rid,'score',c.score),'matching_run',rid,p_idempotency_key||':'||c.inventory_id::text,auth.uid(),camp.id)
    RETURNING id INTO allocation_id;
    rank_no:=rank_no+1;
    INSERT INTO public.matching_decisions(run_id,candidate_id,campaign_id,inventory_id,allocation_id,allocated_insertions,rank,decision_reason)
    VALUES(rid,c.id,camp.id,c.inventory_id,allocation_id,take_qty,rank_no,'weighted_score_and_available_capacity');
    INSERT INTO public.campaign_screens(campaign_id,screen_id,is_active) VALUES(camp.id,c.source_id,true) ON CONFLICT DO NOTHING;
    allocated:=allocated+take_qty; remaining:=remaining-take_qty;
   EXCEPTION WHEN OTHERS THEN
    UPDATE public.matching_candidates SET eligible=false,exclusion_reasons=array_append(exclusion_reasons,'materialization_failed:'||SQLSTATE) WHERE id=c.id;
   END;
 END LOOP;
 UPDATE public.matching_runs SET allocated_insertions=allocated,status=CASE WHEN allocated=p_requested_insertions THEN 'completed' WHEN allocated>0 THEN 'partial' ELSE 'failed' END,
   completed_at=now(),metadata=jsonb_build_object('remaining',remaining) WHERE id=rid;
 RETURN jsonb_build_object('success',allocated>0,'run_id',rid,'allocated_insertions',allocated,'remaining_insertions',remaining,
   'status',CASE WHEN allocated=p_requested_insertions THEN 'completed' WHEN allocated>0 THEN 'partial' ELSE 'failed' END);
END $$;

CREATE OR REPLACE FUNCTION public.consume_inventory_entitlement(p_entitlement_period_id UUID,p_campaign_id UUID,p_quantity BIGINT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ep public.entitlement_periods%ROWTYPE; ent public.inventory_entitlements%ROWTYPE; qid UUID;
BEGIN
 SELECT * INTO ep FROM public.entitlement_periods WHERE id=p_entitlement_period_id FOR UPDATE;
 SELECT * INTO ent FROM public.inventory_entitlements WHERE id=ep.entitlement_id FOR SHARE;
 IF ep.id IS NULL OR ep.status<>'active' OR p_quantity<=0 THEN RAISE EXCEPTION 'Período de direito inválido.'; END IF;
 IF NOT public.mpm_can_manage_holder(ent.beneficiary_type,ent.beneficiary_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 SELECT id INTO qid FROM public.quota_usage WHERE idempotency_key=p_idempotency_key; IF qid IS NOT NULL THEN RETURN qid; END IF;
 IF ep.used_quantity+ep.released_quantity+p_quantity>ep.granted_quantity THEN RAISE EXCEPTION 'Cota insuficiente.'; END IF;
 INSERT INTO public.quota_usage(entitlement_period_id,campaign_id,quantity,idempotency_key) VALUES(ep.id,p_campaign_id,p_quantity,p_idempotency_key) RETURNING id INTO qid;
 UPDATE public.entitlement_periods SET used_quantity=used_quantity+p_quantity WHERE id=ep.id;
 RETURN qid;
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_creator_score(p_creator_id UUID,p_snapshot_id UUID,p_formula_version TEXT DEFAULT 'creator-v1')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.creator_metric_snapshots%ROWTYPE; cs NUMERIC(7,2); mvs NUMERIC(7,2); tier_name TEXT; reliability NUMERIC; reach_score NUMERIC; hid UUID;
BEGIN
 IF NOT (auth.role()='service_role' OR public.is_master_admin() OR EXISTS(SELECT 1 FROM public.creator_profiles WHERE id=p_creator_id AND user_id=auth.uid())) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 SELECT * INTO s FROM public.creator_metric_snapshots WHERE id=p_snapshot_id AND creator_id=p_creator_id FOR SHARE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Snapshot inválido.'; END IF;
 reliability:=CASE WHEN s.completed_campaigns+s.delayed_campaigns+s.refused_campaigns=0 THEN 50 ELSE 100.0*s.completed_campaigns/(s.completed_campaigns+s.delayed_campaigns+s.refused_campaigns) END;
 reach_score:=LEAST(100,CASE WHEN s.followers<=0 THEN 0 ELSE ln(s.followers+1)/ln(1000001)*100 END);
 cs:=round(LEAST(100,GREATEST(0,reliability*0.60+LEAST(100,s.engagement_rate*10)*0.20+LEAST(100,s.local_relevance)*0.20)),2);
 mvs:=round(LEAST(100,GREATEST(0,reach_score*0.35+LEAST(100,s.engagement_rate*10)*0.25+LEAST(100,s.local_relevance)*0.20+reliability*0.20)),2);
 tier_name:=CASE WHEN cs>=85 AND mvs>=80 THEN 'elite' WHEN cs>=70 AND mvs>=60 THEN 'pro' WHEN cs>=50 THEN 'growth' ELSE 'starter' END;
 INSERT INTO public.creator_score_history(creator_id,snapshot_id,creator_score,media_value_score,tier,formula_version,score_components,next_tier_requirements)
 VALUES(p_creator_id,s.id,cs,mvs,tier_name,p_formula_version,jsonb_build_object('reliability',round(reliability,2),'reach',round(reach_score,2),'engagement',s.engagement_rate,'local_relevance',s.local_relevance),
   CASE tier_name WHEN 'starter' THEN '{"creator_score":50}'::jsonb WHEN 'growth' THEN '{"creator_score":70,"media_value_score":60}'::jsonb WHEN 'pro' THEN '{"creator_score":85,"media_value_score":80}'::jsonb ELSE '{}'::jsonb END)
 ON CONFLICT(snapshot_id) DO UPDATE SET creator_score=EXCLUDED.creator_score,media_value_score=EXCLUDED.media_value_score,tier=EXCLUDED.tier,
   formula_version=EXCLUDED.formula_version,score_components=EXCLUDED.score_components,next_tier_requirements=EXCLUDED.next_tier_requirements
 RETURNING id INTO hid;
 UPDATE public.creator_profiles SET creator_score=cs,media_value_score=mvs,tier=tier_name,updated_at=now() WHERE id=p_creator_id;
 RETURN jsonb_build_object('history_id',hid,'creator_score',cs,'media_value_score',mvs,'tier',tier_name);
END $$;

CREATE OR REPLACE FUNCTION public.sync_social_channel_inventory()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inv_owner_type TEXT; inv_source_type TEXT; inv_family TEXT;
BEGIN
 inv_owner_type:=NEW.owner_type; inv_source_type:=CASE WHEN NEW.owner_type='creator' THEN 'creator_channel' ELSE 'social_channel' END;
 inv_family:=CASE WHEN NEW.owner_type='creator' THEN 'creator' ELSE 'social' END;
 INSERT INTO public.media_inventory(owner_type,owner_id,source_type,source_id,channel_family,inventory_type,status,proof_method,commercial_enabled,metadata)
 VALUES(inv_owner_type,NEW.owner_id,inv_source_type,NEW.id,inv_family,NEW.channel_type,
   CASE WHEN NEW.status='active' THEN 'active' ELSE 'paused' END,'proof_of_publication',NEW.participation_enabled AND NEW.status='active',
   jsonb_build_object('provider',NEW.provider,'display_name',NEW.display_name))
 ON CONFLICT(source_type,source_id) DO UPDATE SET status=EXCLUDED.status,commercial_enabled=EXCLUDED.commercial_enabled,metadata=EXCLUDED.metadata,updated_at=now();
 RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_social_channel_inventory AFTER INSERT OR UPDATE OF participation_enabled,status,display_name ON public.social_channels
FOR EACH ROW EXECUTE FUNCTION public.sync_social_channel_inventory();

CREATE OR REPLACE FUNCTION public.create_event_inventory(
 p_event_id UUID,p_inventory_name TEXT,p_total_capacity BIGINT,p_sponsor_capacity BIGINT,p_commercial_capacity BIGINT,p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.events%ROWTYPE; iid UUID:=gen_random_uuid(); eiid UUID:=gen_random_uuid(); cpid UUID; sbid UUID; abid UUID;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF e.id IS NULL OR NOT public.mpm_can_manage_company(e.owner_company_id) THEN RAISE EXCEPTION 'Evento inválido ou acesso negado.'; END IF;
 IF p_total_capacity<0 OR p_sponsor_capacity<0 OR p_commercial_capacity<0 OR p_sponsor_capacity+p_commercial_capacity>p_total_capacity THEN RAISE EXCEPTION 'Capacidade inválida.'; END IF;
 SELECT id INTO eiid FROM public.event_inventory WHERE event_id=e.id AND metadata->>'idempotency_key'=p_idempotency_key;
 IF eiid IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deduplicated',true,'event_inventory_id',eiid); END IF;
 eiid:=gen_random_uuid(); iid:=gen_random_uuid();
 INSERT INTO public.media_inventory(id,owner_type,owner_id,source_type,source_id,channel_family,inventory_type,status,city,state,proof_method,commercial_enabled,metadata)
 VALUES(iid,'company',e.owner_company_id,'event_slot',eiid,'event','event_slot','active',e.city,e.state,e.proof_method,p_commercial_capacity>0,jsonb_build_object('event_id',e.id));
 INSERT INTO public.event_inventory(id,event_id,media_inventory_id,inventory_name,total_capacity,sponsor_capacity,commercial_capacity,metadata)
 VALUES(eiid,e.id,iid,p_inventory_name,p_total_capacity,p_sponsor_capacity,p_commercial_capacity,jsonb_build_object('idempotency_key',p_idempotency_key));
 INSERT INTO public.inventory_capacity_periods(media_inventory_id,period_start,period_end,cycle_type,calculation_source,calculation_inputs,theoretical_capacity,network_capacity,available_capacity,status,created_by)
 VALUES(iid,e.starts_at::date,e.ends_at::date,'custom','manual',jsonb_build_object('event_id',e.id),p_total_capacity,p_total_capacity,p_total_capacity,'active',auth.uid()) RETURNING id INTO cpid;
 IF p_sponsor_capacity>0 THEN INSERT INTO public.inventory_bucket_policies(capacity_period_id,bucket_type,capacity_quantity,reason,starts_at,ends_at,created_by)
   VALUES(cpid,'partnership',p_sponsor_capacity,'Cotas de patrocinador do evento',e.starts_at,e.ends_at,auth.uid()) RETURNING id INTO sbid; END IF;
 IF p_commercial_capacity>0 THEN INSERT INTO public.inventory_bucket_policies(capacity_period_id,bucket_type,capacity_quantity,reason,starts_at,ends_at,created_by)
   VALUES(cpid,'automatic_pool',p_commercial_capacity,'Excedente comercial do evento',e.starts_at,e.ends_at,auth.uid()) RETURNING id INTO abid; END IF;
 RETURN jsonb_build_object('success',true,'event_inventory_id',eiid,'media_inventory_id',iid,'capacity_period_id',cpid,'sponsor_bucket_id',sbid,'commercial_bucket_id',abid);
END $$;

CREATE OR REPLACE FUNCTION public.create_cashout_simulation(p_payout_account_id UUID,p_wallet_account_id UUID,p_amount NUMERIC,p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pa public.payout_accounts%ROWTYPE; wa public.wallet_accounts%ROWTYPE; cid UUID; reasons TEXT[]:='{}';
BEGIN
 SELECT * INTO pa FROM public.payout_accounts WHERE id=p_payout_account_id FOR SHARE;
 SELECT * INTO wa FROM public.wallet_accounts WHERE id=p_wallet_account_id FOR SHARE;
 IF pa.id IS NULL OR wa.id IS NULL OR NOT public.mpm_can_manage_holder(pa.holder_type,pa.holder_id) OR pa.holder_type<>wa.holder_type OR pa.holder_id<>wa.holder_id THEN RAISE EXCEPTION 'Conta de payout/carteira inválida.'; END IF;
 SELECT id INTO cid FROM public.cashout_requests WHERE idempotency_key=p_idempotency_key; IF cid IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deduplicated',true,'cashout_request_id',cid); END IF;
 IF wa.credit_class<>'earned' THEN reasons:=array_append(reasons,'only_earned'); END IF;
 IF wa.cashout_eligible_balance<p_amount THEN reasons:=array_append(reasons,'insufficient_cashout_eligible'); END IF;
 IF pa.kyc_status<>'approved' OR pa.status<>'verified' THEN reasons:=array_append(reasons,'kyc_not_approved'); END IF;
 reasons:=array_append(reasons,'cashout_feature_disabled');
 INSERT INTO public.cashout_requests(payout_account_id,wallet_account_id,amount_credits,status,simulation_only,idempotency_key,block_reasons)
 VALUES(pa.id,wa.id,p_amount,'blocked',true,p_idempotency_key,reasons) RETURNING id INTO cid;
 RETURN jsonb_build_object('success',true,'simulation_only',true,'cashout_request_id',cid,'status','blocked','block_reasons',reasons);
END $$;

CREATE OR REPLACE FUNCTION public.run_mpm_maintenance(p_run_key TEXT DEFAULT to_char(now(),'YYYY-MM-DD-HH24'))
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE jid UUID; expired_alloc INTEGER:=0; expired_quotes INTEGER:=0; ended_events INTEGER:=0; expired_entitlements INTEGER:=0; released_owner BIGINT:=0; cp RECORD;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 INSERT INTO public.mpm_job_runs(job_name,run_key,status) VALUES('mpm_maintenance',p_run_key,'running')
 ON CONFLICT(job_name,run_key) DO UPDATE SET run_key=EXCLUDED.run_key RETURNING id INTO jid;
 IF (SELECT status FROM public.mpm_job_runs WHERE id=jid)='completed' THEN RETURN (SELECT counters||jsonb_build_object('deduplicated',true) FROM public.mpm_job_runs WHERE id=jid); END IF;
 expired_alloc:=public.expire_inventory_allocations();
 UPDATE public.media_price_quotes SET status='expired' WHERE status='quoted' AND expires_at<=now(); GET DIAGNOSTICS expired_quotes=ROW_COUNT;
 UPDATE public.events SET status='ended',updated_at=now() WHERE status='active' AND ends_at<=now(); GET DIAGNOSTICS ended_events=ROW_COUNT;
 UPDATE public.event_inventory ei SET status='ended' FROM public.events e WHERE e.id=ei.event_id AND e.status='ended' AND ei.status='active';
 UPDATE public.media_inventory mi SET status='inactive',commercial_enabled=false,updated_at=now() FROM public.event_inventory ei WHERE ei.media_inventory_id=mi.id AND ei.status='ended';
 UPDATE public.entitlement_periods SET status='expired',released_quantity=granted_quantity-used_quantity WHERE status='active' AND period_end<current_date; GET DIAGNOSTICS expired_entitlements=ROW_COUNT;
 FOR cp IN SELECT id FROM public.inventory_capacity_periods WHERE status='active' LOOP
   BEGIN released_owner:=released_owner+public.release_unused_owner_capacity(cp.id,now()); EXCEPTION WHEN OTHERS THEN NULL; END;
 END LOOP;
 UPDATE public.mpm_job_runs SET status='completed',completed_at=now(),counters=jsonb_build_object('expired_allocations',expired_alloc,'expired_quotes',expired_quotes,'ended_events',ended_events,'expired_entitlements',expired_entitlements,'released_owner_capacity',released_owner) WHERE id=jid;
 RETURN (SELECT counters FROM public.mpm_job_runs WHERE id=jid);
EXCEPTION WHEN OTHERS THEN
 UPDATE public.mpm_job_runs SET status='failed',completed_at=now(),error_message=SQLERRM WHERE id=jid; RAISE;
END $$;

-- Views de dashboard: agregações sem lógica econômica paralela.
CREATE OR REPLACE VIEW public.mpm_company_dashboard WITH (security_invoker=true) AS
SELECT c.id company_id,
  (SELECT count(*) FROM public.media_inventory i WHERE i.owner_type='company' AND i.owner_id=c.id AND i.status='active') inventory_items,
  (SELECT COALESCE(sum(cp.theoretical_capacity),0) FROM public.inventory_capacity_periods cp JOIN public.media_inventory i ON i.id=cp.media_inventory_id WHERE i.owner_type='company' AND i.owner_id=c.id AND cp.status='active') total_capacity,
  (SELECT COALESCE(sum(cp.reserved_capacity+cp.committed_capacity),0) FROM public.inventory_capacity_periods cp JOIN public.media_inventory i ON i.id=cp.media_inventory_id WHERE i.owner_type='company' AND i.owner_id=c.id AND cp.status='active') occupied_capacity,
  (SELECT COALESCE(sum(a.available_balance),0) FROM public.wallet_accounts a WHERE a.holder_type='company' AND a.holder_id=c.id) available_credits,
  (SELECT COALESCE(sum(s.supplier_net_credits),0) FROM public.settlement_entries s WHERE s.seller_company_id=c.id AND s.status='earned') earned_credits,
  (SELECT COALESCE(sum(s.platform_fee_credits),0) FROM public.settlement_entries s WHERE (s.seller_company_id=c.id OR s.buyer_company_id=c.id) AND s.status='earned') fee_credits,
  (SELECT count(*) FROM public.campaigns ca WHERE ca.company_id=c.id) campaigns,
  (SELECT count(*) FROM public.playback_logs p WHERE p.company_id=c.id AND p.status='completed') proof_of_delivery_count
FROM public.companies c;

CREATE OR REPLACE VIEW public.mpm_admin_dashboard WITH (security_invoker=true) AS
SELECT
 (SELECT count(*) FROM public.media_inventory WHERE status='active') total_inventory,
 (SELECT COALESCE(sum(theoretical_capacity),0) FROM public.inventory_capacity_periods WHERE status='active') total_capacity,
 (SELECT COALESCE(sum(reserved_capacity+committed_capacity),0) FROM public.inventory_capacity_periods WHERE status='active') occupied_capacity,
 (SELECT COALESCE(sum(platform_fee_credits),0) FROM public.settlement_entries WHERE status='earned') fee_revenue_credits,
 (SELECT COALESCE(sum(available_balance+pending_balance+reserved_balance),0) FROM public.wallet_accounts) mpm_balance,
 (SELECT count(*) FROM public.settlement_entries WHERE status='pending') pending_settlements,
 (SELECT count(*) FROM public.creator_profiles WHERE status='active') active_creators,
 (SELECT count(*) FROM public.partner_programs WHERE status='active') active_programs,
 (SELECT count(*) FROM public.events WHERE status='active') active_events;

GRANT SELECT ON public.mpm_company_dashboard TO authenticated;
GRANT SELECT ON public.mpm_admin_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_media_inventory(UUID,UUID,BIGINT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER,TEXT,TEXT,TEXT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.run_campaign_matching(UUID,BIGINT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.consume_inventory_entitlement(UUID,UUID,BIGINT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_creator_score(UUID,UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_event_inventory(UUID,TEXT,BIGINT,BIGINT,BIGINT,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_cashout_simulation(UUID,UUID,NUMERIC,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.run_mpm_maintenance(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.mpm_ensure_holder_account(TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated;
