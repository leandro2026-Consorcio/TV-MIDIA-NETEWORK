-- Operações transacionais do ciclo. Não ativa rollout nem cria cobrança/payout.
CREATE OR REPLACE FUNCTION public.initialize_screen_capacity_cycle(p_screen_id UUID,p_plan_code TEXT,p_start DATE,p_end DATE,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.screens%ROWTYPE; mi public.media_inventory%ROWTYPE; plan public.screen_capacity_plan_versions%ROWTYPE;
 cp_id UUID; mins BIGINT; technical BIGINT; own_equiv BIGINT; sellable BIGINT; cycle_no INTEGER;
BEGIN
 IF NULLIF(trim(p_idempotency_key),'') IS NULL OR p_end<p_start THEN RAISE EXCEPTION 'Ciclo inválido.'; END IF;
 SELECT * INTO s FROM public.screens WHERE id=p_screen_id;
 IF s.id IS NULL OR NOT(public.is_master_admin() OR s.company_id IN(SELECT public.get_user_admin_company_ids())) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF s.paired_at IS NULL OR s.status='inactive' THEN RAISE EXCEPTION 'TV precisa estar pareada e ativa.'; END IF;
 IF NOT public.is_master_admin() AND NOT COALESCE((SELECT(value#>>'{}')::boolean FROM public.platform_settings WHERE key='dynamic_screen_capacity_enabled'),false) THEN RAISE EXCEPTION 'Rollout de capacidade ainda não liberado.'; END IF;
 SELECT * INTO mi FROM public.media_inventory WHERE source_type='company_screen' AND source_id=p_screen_id AND status='active';
 SELECT * INTO plan FROM public.screen_capacity_plan_versions WHERE code=p_plan_code AND effective_from<=now() AND effective_to IS NULL;
 IF mi.id IS NULL OR plan.id IS NULL THEN RAISE EXCEPTION 'Inventário ou plano vigente não encontrado.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('screen-capacity:'||p_idempotency_key,0));
 SELECT id INTO cp_id FROM public.inventory_capacity_periods WHERE calculation_inputs->>'idempotency_key'=p_idempotency_key;
 IF cp_id IS NOT NULL THEN RETURN cp_id; END IF;
 mins:=public.calculate_screen_planned_minutes(p_screen_id,p_start,p_end); technical:=floor(mins*60/plan.slot_seconds);
 own_equiv:=ceil(plan.own_insertions*plan.own_max_seconds::numeric/plan.slot_seconds); cycle_no:=1+(SELECT count(*) FROM public.inventory_capacity_periods WHERE media_inventory_id=mi.id);
 IF plan.network_insertions+own_equiv+plan.mpm_reserve_insertions+plan.sponsor_insertions+plan.commercial_insertions>technical THEN RAISE EXCEPTION 'Agenda não comporta os compromissos do plano.'; END IF;
 sellable:=least(plan.commercial_insertions,greatest(0,technical-plan.network_insertions-own_equiv-plan.mpm_reserve_insertions-plan.sponsor_insertions));
 INSERT INTO public.inventory_capacity_periods(media_inventory_id,period_start,period_end,cycle_type,calculation_source,calculation_version,calculation_inputs,theoretical_capacity,own_use_capacity,network_capacity,reserved_capacity,committed_capacity,delivered_capacity,available_capacity,status,plan_version_id,planned_minutes,certified_capacity,own_inventory,mpm_reserve,sponsor_reserve,commercial_inventory,sold_inventory,rights_target,rights_released,cycle_number,plan_snapshot,created_by)
 VALUES(mi.id,p_start,p_end,'monthly','calculated',1,jsonb_build_object('idempotency_key',p_idempotency_key,'schedule_based',true),technical,own_equiv,plan.network_insertions,plan.mpm_reserve_insertions+plan.sponsor_insertions,0,0,sellable,'active',plan.id,mins,technical,plan.own_insertions,plan.mpm_reserve_insertions,plan.sponsor_insertions,plan.commercial_insertions,0,round(plan.network_insertions*plan.media_right_ratio),0,cycle_no,to_jsonb(plan),auth.uid()) RETURNING id INTO cp_id;
 INSERT INTO public.inventory_bucket_policies(capacity_period_id,bucket_type,capacity_quantity,reason,status)
 VALUES(cp_id,'own_use',own_equiv,'Conteúdo próprio do plano','active'),(cp_id,'partnership',plan.sponsor_insertions,'Sponsor protegido do programa','active'),(cp_id,'mpm_growth',plan.mpm_reserve_insertions,'Reserva MPM','active'),(cp_id,'automatic_pool',plan.network_insertions+plan.commercial_insertions,'Rede e inventário comercial não vendido','active');
 INSERT INTO public.inventory_audit_logs(inventory_id,capacity_period_id,action,actor_id,details) VALUES(mi.id,cp_id,'CAPACITY_CYCLE_INITIALIZED',auth.uid(),jsonb_build_object('plan_version_id',plan.id,'technical_capacity',technical,'commercial_sellable',sellable));
 RETURN cp_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_capacity_media_right(p_capacity_period_id UUID,p_media_right_account_id UUID,p_availability_percent NUMERIC,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cp public.inventory_capacity_periods%ROWTYPE; plan public.screen_capacity_plan_versions%ROWTYPE; mi public.media_inventory%ROWTYPE; target NUMERIC; release_total NUMERIC; delta NUMERIC; ledger_id UUID;
BEGIN
 SELECT * INTO cp FROM public.inventory_capacity_periods WHERE id=p_capacity_period_id FOR UPDATE;
 SELECT * INTO mi FROM public.media_inventory WHERE id=cp.media_inventory_id;
 IF cp.id IS NULL OR NOT(public.is_master_admin() OR mi.owner_id IN(SELECT public.get_user_admin_company_ids())) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF p_availability_percent<0 THEN RAISE EXCEPTION 'Disponibilidade inválida.'; END IF;
 SELECT * INTO plan FROM public.screen_capacity_plan_versions WHERE id=cp.plan_version_id;
 target:=cp.rights_target;
 release_total:=CASE WHEN cp.cycle_number=1 THEN target*plan.initial_release_percent/100 ELSE target*(plan.advance_release_percent+plan.performance_release_percent*least(p_availability_percent,100)/100)/100 END;
 delta:=greatest(0,least(target,release_total)-cp.rights_released);
 IF delta=0 THEN RETURN NULL; END IF;
 ledger_id:=public._post_media_right_entry(p_media_right_account_id,NULL,'grant',delta,delta,0,'screen_capacity_cycle',cp.id,p_idempotency_key,NULL,jsonb_build_object('capacity_period_id',cp.id,'availability_percent',p_availability_percent,'demand_independent',true,'plan_version_id',plan.id));
 UPDATE public.inventory_capacity_periods SET rights_released=rights_released+delta,available_minutes=round(planned_minutes*least(p_availability_percent,100)/100),updated_at=now() WHERE id=cp.id;
 RETURN ledger_id;
END $$;

CREATE OR REPLACE FUNCTION public.certify_screen_capacity(p_screen_id UUID,p_window_end DATE,p_safety_margin_percent NUMERIC DEFAULT 15)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE samples INTEGER; avg_cap BIGINT; min_cap BIGINT; cert BIGINT; cert_id UUID;
BEGIN
 IF NOT public.is_master_admin() THEN RAISE EXCEPTION 'Somente Master pode certificar capacidade.'; END IF;
 SELECT count(*),round(avg(produced_equivalent_slots)),min(produced_equivalent_slots) INTO samples,avg_cap,min_cap FROM public.screen_capacity_daily WHERE screen_id=p_screen_id AND service_date BETWEEN p_window_end-29 AND p_window_end AND status IN('closed','certified');
 IF samples<30 THEN RAISE EXCEPTION 'Janela estável de 30 dias incompleta.'; END IF;
 cert:=least(min_cap,floor(avg_cap*(100-p_safety_margin_percent)/100));
 INSERT INTO public.screen_capacity_certifications(screen_id,window_start,window_end,sample_days,average_capacity,minimum_capacity,safety_margin_percent,certified_capacity,proposed_commercial_inventory)
 VALUES(p_screen_id,p_window_end-29,p_window_end,samples,avg_cap,min_cap,p_safety_margin_percent,cert,greatest(3000,cert-35000)) RETURNING id INTO cert_id;
 RETURN cert_id;
END $$;
REVOKE ALL ON FUNCTION public.initialize_screen_capacity_cycle(UUID,TEXT,DATE,DATE,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.release_capacity_media_right(UUID,UUID,NUMERIC,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.certify_screen_capacity(UUID,DATE,NUMERIC) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.initialize_screen_capacity_cycle(UUID,TEXT,DATE,DATE,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.release_capacity_media_right(UUID,UUID,NUMERIC,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.certify_screen_capacity(UUID,DATE,NUMERIC) TO authenticated,service_role;
