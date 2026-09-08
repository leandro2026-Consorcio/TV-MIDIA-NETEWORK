-- Políticas configuráveis de matching, consumo de créditos e Growth.

CREATE TABLE public.mpm_spend_policies (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), purpose TEXT NOT NULL UNIQUE,
 credit_class_order TEXT[] NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT true,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (purpose IN ('media_purchase','monthly_subscription','annual_subscription')),
 CHECK (cardinality(credit_class_order)>0 AND credit_class_order<@ARRAY['earned','purchased','promotional','legacy_organic']::text[])
);
INSERT INTO public.mpm_spend_policies(purpose,credit_class_order,metadata) VALUES
 ('media_purchase',ARRAY['earned','purchased','promotional'],'{"promotional_allowed":true,"legacy_isolated":true}'::jsonb),
 ('monthly_subscription',ARRAY['earned','purchased'],'{"purchased_allowed":true,"promotional_allowed":false}'::jsonb),
 ('annual_subscription',ARRAY['earned','purchased'],'{"purchased_allowed":true,"promotional_allowed":false}'::jsonb)
ON CONFLICT(purpose) DO NOTHING;

CREATE TABLE public.campaign_matching_requirements (
 campaign_id UUID PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
 category TEXT,
 target_cities TEXT[] NOT NULL DEFAULT '{}', target_states TEXT[] NOT NULL DEFAULT '{}',
 blocked_companies UUID[] NOT NULL DEFAULT '{}', blocked_segments UUID[] NOT NULL DEFAULT '{}',
 max_budget_credits NUMERIC(18,4), max_frequency_per_inventory INTEGER,
 priority_contract_level INTEGER NOT NULL DEFAULT 0,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(max_budget_credits IS NULL OR max_budget_credits>=0), CHECK(max_frequency_per_inventory IS NULL OR max_frequency_per_inventory>0)
);
CREATE TABLE public.inventory_matching_rules (
 inventory_id UUID PRIMARY KEY REFERENCES public.media_inventory(id) ON DELETE CASCADE,
 allowed_categories TEXT[] NOT NULL DEFAULT '{}', blocked_categories TEXT[] NOT NULL DEFAULT '{}',
 blocked_companies UUID[] NOT NULL DEFAULT '{}', blocked_segments UUID[] NOT NULL DEFAULT '{}',
 service_cities TEXT[] NOT NULL DEFAULT '{}', service_states TEXT[] NOT NULL DEFAULT '{}',
 max_campaign_frequency_monthly INTEGER, minimum_budget_credits NUMERIC(18,4),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(max_campaign_frequency_monthly IS NULL OR max_campaign_frequency_monthly>0), CHECK(minimum_budget_credits IS NULL OR minimum_budget_credits>=0)
);
ALTER TABLE public.mpm_spend_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_matching_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_matching_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spend policies read" ON public.mpm_spend_policies FOR SELECT TO authenticated USING(is_active OR public.is_master_admin());
CREATE POLICY "Campaign matching tenant read" ON public.campaign_matching_requirements FOR SELECT TO authenticated USING(campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Inventory matching owner read" ON public.inventory_matching_rules FOR SELECT TO authenticated USING(public.can_access_media_inventory(inventory_id,false));

CREATE OR REPLACE FUNCTION public.mpm_reserve_credits(p_company_id UUID,p_amount NUMERIC,p_purpose TEXT,p_source_type TEXT,p_source_id UUID,p_idempotency_key TEXT,p_expires_at TIMESTAMPTZ DEFAULT NULL,p_metadata JSONB DEFAULT '{}')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_reservation UUID; v_remaining NUMERIC(18,4):=p_amount; v_take NUMERIC(18,4); v_account RECORD; v_classes TEXT[]; v_class TEXT;
BEGIN
 IF NOT public.mpm_can_manage_company(p_company_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF p_amount<=0 OR p_purpose NOT IN ('media_purchase','monthly_subscription','annual_subscription') THEN RAISE EXCEPTION 'Reserva inválida.'; END IF;
 SELECT credit_class_order INTO v_classes FROM public.mpm_spend_policies WHERE purpose=p_purpose AND is_active;
 IF v_classes IS NULL THEN RAISE EXCEPTION 'Política de consumo MPM não configurada.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('mpm-reservation:'||p_idempotency_key,0));
 SELECT id INTO v_reservation FROM public.wallet_reservations WHERE idempotency_key=p_idempotency_key; IF v_reservation IS NOT NULL THEN RETURN v_reservation; END IF;
 FOREACH v_class IN ARRAY v_classes LOOP PERFORM public.mpm_ensure_account(p_company_id,v_class); END LOOP;
 INSERT INTO public.wallet_reservations(company_id,purpose,amount,source_type,source_id,idempotency_key,expires_at,metadata,created_by)
 VALUES(p_company_id,p_purpose,p_amount,p_source_type,p_source_id,p_idempotency_key,p_expires_at,COALESCE(p_metadata,'{}'),auth.uid()) RETURNING id INTO v_reservation;
 FOR v_account IN SELECT * FROM public.wallet_accounts WHERE company_id=p_company_id AND credit_class=ANY(v_classes) ORDER BY array_position(v_classes,credit_class) FOR UPDATE LOOP
  EXIT WHEN v_remaining<=0; v_take:=LEAST(v_remaining,v_account.available_balance);
  IF v_take>0 THEN
   PERFORM public._mpm_post_entry(v_account.id,'reserve','transfer',v_take,-v_take,0,v_take,p_source_type,p_source_id,p_idempotency_key||':reserve:'||v_account.credit_class,NULL,NULL,NULL,NULL,jsonb_build_object('reservation_id',v_reservation,'policy_order',v_classes));
   INSERT INTO public.wallet_reservation_lines(reservation_id,account_id,amount) VALUES(v_reservation,v_account.id,v_take); v_remaining:=v_remaining-v_take;
  END IF;
 END LOOP;
 IF v_remaining>0 THEN RAISE EXCEPTION 'Saldo MPM insuficiente: faltam % créditos.',v_remaining; END IF;
 RETURN v_reservation;
END $$;

CREATE OR REPLACE FUNCTION public.validate_growth_bucket_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE lim BIGINT;
BEGIN
 IF NEW.bucket_type='mpm_growth' THEN
  SELECT COALESCE((value#>>'{}')::bigint,1000) INTO lim FROM public.platform_settings WHERE key='inventory_growth_monthly_limit';
  IF NEW.capacity_quantity>lim THEN RAISE EXCEPTION 'MPM Growth excede o limite configurado de % inserções por período.',lim; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_growth_bucket_limit BEFORE INSERT OR UPDATE OF bucket_type,capacity_quantity ON public.inventory_bucket_policies FOR EACH ROW EXECUTE FUNCTION public.validate_growth_bucket_limit();

CREATE OR REPLACE FUNCTION public.enforce_matching_candidate_policies()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE req public.campaign_matching_requirements%ROWTYPE; rule public.inventory_matching_rules%ROWTYPE; inv public.media_inventory%ROWTYPE;
 runrow public.matching_runs%ROWTYPE; buyer_segments UUID[]; prior_count INTEGER; estimated NUMERIC:=0; unit_price NUMERIC;
BEGIN
 SELECT * INTO runrow FROM public.matching_runs WHERE id=NEW.run_id;
 SELECT * INTO req FROM public.campaign_matching_requirements WHERE campaign_id=runrow.campaign_id;
 SELECT * INTO rule FROM public.inventory_matching_rules WHERE inventory_id=NEW.inventory_id;
 SELECT * INTO inv FROM public.media_inventory WHERE id=NEW.inventory_id;
 SELECT COALESCE(array_agg(segment_id),'{}') INTO buyer_segments FROM public.company_segments WHERE company_id=runrow.buyer_company_id;
 IF cardinality(req.target_cities)>0 AND NOT (inv.city=ANY(req.target_cities)) THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'city_mismatch'); END IF;
 IF cardinality(req.target_states)>0 AND NOT (inv.state=ANY(req.target_states)) THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'state_mismatch'); END IF;
 IF inv.owner_type='company' AND inv.owner_id=ANY(req.blocked_companies) THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'supplier_blocked_by_campaign'); END IF;
 IF cardinality(rule.blocked_companies)>0 AND runrow.buyer_company_id=ANY(rule.blocked_companies) THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'buyer_blocked_by_inventory'); END IF;
 IF cardinality(rule.blocked_segments)>0 AND rule.blocked_segments&&buyer_segments THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'competitor_segment'); END IF;
 IF req.category IS NOT NULL AND ((cardinality(rule.allowed_categories)>0 AND NOT req.category=ANY(rule.allowed_categories)) OR req.category=ANY(rule.blocked_categories)) THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'category_blocked'); END IF;
 IF cardinality(rule.service_cities)>0 AND NOT inv.city=ANY(rule.service_cities) THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'outside_service_city'); END IF;
 SELECT count(*) INTO prior_count FROM public.matching_decisions d WHERE d.campaign_id=runrow.campaign_id AND d.inventory_id=inv.id AND d.created_at>=date_trunc('month',now());
 IF COALESCE(req.max_frequency_per_inventory,rule.max_campaign_frequency_monthly) IS NOT NULL AND prior_count>=COALESCE(req.max_frequency_per_inventory,rule.max_campaign_frequency_monthly) THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'frequency_cap'); END IF;
 SELECT unit_price_credits*occupancy_multiplier INTO unit_price FROM public.media_price_rules p WHERE p.is_active AND (p.inventory_id IS NULL OR p.inventory_id=inv.id) AND (p.channel_family IS NULL OR p.channel_family=inv.channel_family) ORDER BY p.priority DESC,p.version DESC LIMIT 1;
 estimated:=COALESCE(unit_price,0)*LEAST(runrow.requested_insertions,NEW.available_capacity);
 IF req.max_budget_credits IS NOT NULL AND estimated>req.max_budget_credits THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'budget_exceeded'); END IF;
 IF rule.minimum_budget_credits IS NOT NULL AND COALESCE(req.max_budget_credits,0)<rule.minimum_budget_credits THEN NEW.eligible:=false; NEW.exclusion_reasons:=array_append(NEW.exclusion_reasons,'minimum_budget_not_met'); END IF;
 NEW.score:=NEW.score+COALESCE(req.priority_contract_level,0)*5;
 NEW.score_components:=NEW.score_components||jsonb_build_object('category',req.category,'estimated_credits',estimated,'prior_frequency',prior_count,'contract_priority',COALESCE(req.priority_contract_level,0));
 RETURN NEW;
END $$;
CREATE TRIGGER trg_matching_candidate_policies BEFORE INSERT ON public.matching_candidates FOR EACH ROW EXECUTE FUNCTION public.enforce_matching_candidate_policies();
