-- Correcao comprovada em homologacao: Reserva MPM nao e MPM Growth.
-- Mantem os componentes no snapshot/ciclo e usa o pool externo canonico com breakdown.
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
 own_equiv:=ceil(plan.own_insertions*plan.own_max_seconds::numeric/plan.slot_seconds);
 cycle_no:=1+(SELECT count(*) FROM public.inventory_capacity_periods WHERE media_inventory_id=mi.id AND theoretical_capacity>0 AND status IN('active','closed'));
 IF plan.network_insertions+own_equiv+plan.mpm_reserve_insertions+plan.sponsor_insertions+plan.commercial_insertions>technical THEN RAISE EXCEPTION 'Agenda não comporta os compromissos do plano.'; END IF;
 sellable:=least(plan.commercial_insertions,greatest(0,technical-plan.network_insertions-own_equiv-plan.mpm_reserve_insertions-plan.sponsor_insertions));
 INSERT INTO public.inventory_capacity_periods(media_inventory_id,period_start,period_end,cycle_type,calculation_source,calculation_version,calculation_inputs,theoretical_capacity,own_use_capacity,network_capacity,reserved_capacity,committed_capacity,delivered_capacity,available_capacity,status,plan_version_id,planned_minutes,certified_capacity,own_inventory,mpm_reserve,sponsor_reserve,commercial_inventory,sold_inventory,rights_target,rights_released,cycle_number,plan_snapshot,created_by)
 VALUES(mi.id,p_start,p_end,'monthly','calculated',2,jsonb_build_object('idempotency_key',p_idempotency_key,'schedule_based',true,'bucket_mapping','external_pool_breakdown'),technical,own_equiv,plan.network_insertions,plan.mpm_reserve_insertions+plan.sponsor_insertions,0,0,sellable,'active',plan.id,mins,technical,plan.own_insertions,plan.mpm_reserve_insertions,plan.sponsor_insertions,plan.commercial_insertions,0,round(plan.network_insertions*plan.media_right_ratio),0,cycle_no,to_jsonb(plan),auth.uid()) RETURNING id INTO cp_id;
 INSERT INTO public.inventory_bucket_policies(capacity_period_id,bucket_type,capacity_quantity,reason,status,metadata)
 VALUES(cp_id,'own_use',own_equiv,'Conteúdo próprio do plano','active',jsonb_build_object('own_equivalent',own_equiv)),
       (cp_id,'automatic_pool',plan.network_insertions+plan.mpm_reserve_insertions+plan.sponsor_insertions+plan.commercial_insertions,'Pool externo com componentes protegidos no snapshot','active',jsonb_build_object('network',plan.network_insertions,'mpm_reserve',plan.mpm_reserve_insertions,'sponsor',plan.sponsor_insertions,'commercial',plan.commercial_insertions));
 UPDATE public.inventory_capacity_periods SET own_use_capacity=own_equiv,network_capacity=plan.network_insertions,reserved_capacity=plan.mpm_reserve_insertions+plan.sponsor_insertions,available_capacity=sellable WHERE id=cp_id;
 INSERT INTO public.inventory_audit_logs(inventory_id,capacity_period_id,action,actor_id,details) VALUES(mi.id,cp_id,'CAPACITY_CYCLE_INITIALIZED',auth.uid(),jsonb_build_object('plan_version_id',plan.id,'technical_capacity',technical,'commercial_sellable',sellable,'bucket_mapping','external_pool_breakdown'));
 RETURN cp_id;
END $$;
