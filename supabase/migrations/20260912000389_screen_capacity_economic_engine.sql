-- Motor aditivo de capacidade por TV. Reutiliza media_inventory, períodos, buckets,
-- allocations, entitlements, media_right_ledger, Proof of Play e financeiro existentes.

INSERT INTO public.platform_settings(key,value,description) VALUES
 ('dynamic_screen_capacity_enabled','false','Grade/capacidade dinâmica por TV (rollout Master).'),
 ('screen_capacity_certification_enabled','false','Certificação por histórico estável (rollout Master).'),
 ('screen_commercial_inventory_enabled','false','Inventário comercial calculado por ciclo.'),
 ('screen_inventory_sales_enabled','false','Venda real de inventário físico; inicia desligada.'),
 ('partner_sponsor_inventory_enabled','false','Bucket sponsor de programas parceiros.'),
 ('racon_partner_program_enabled','false','Programa Racon; inicia controlado.'),
 ('capacity_based_media_release_enabled','false','Liberação híbrida de Direito de Mídia.'),
 ('real_inventory_billing_enabled','false','Cobrança real de inventário; fail closed.'),
 ('real_inventory_payout_enabled','false','Payout real de inventário; fail closed.'),
 ('screen_capacity_defaults','{"slot_seconds":15,"certification_window_days":30,"safety_margin_percent":15,"advance_release_percent":30,"performance_release_percent":70,"healthy_threshold":90,"attention_threshold":75,"preferred_locations_limit":3,"max_advertiser_per_screen_cycle":2000,"media_right_accumulates":true}'::jsonb,'Parâmetros operacionais versionáveis do motor.')
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.screen_capacity_plan_versions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
 program_id UUID REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
 monthly_price_cents BIGINT NOT NULL CHECK(monthly_price_cents>=0), slot_seconds SMALLINT NOT NULL DEFAULT 15 CHECK(slot_seconds>0),
 network_insertions BIGINT NOT NULL CHECK(network_insertions>=0), own_insertions BIGINT NOT NULL CHECK(own_insertions>=0),
 own_max_seconds SMALLINT NOT NULL DEFAULT 30 CHECK(own_max_seconds>0), mpm_reserve_insertions BIGINT NOT NULL CHECK(mpm_reserve_insertions>=0),
 sponsor_insertions BIGINT NOT NULL DEFAULT 0 CHECK(sponsor_insertions>=0), commercial_insertions BIGINT NOT NULL CHECK(commercial_insertions>=0),
 commercial_unit_price_cents INTEGER NOT NULL DEFAULT 25 CHECK(commercial_unit_price_cents>=0), platform_fee_percent NUMERIC(6,3) NOT NULL DEFAULT 10 CHECK(platform_fee_percent BETWEEN 0 AND 100),
 promotional_mpm_credits_per_paid_cycle NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(promotional_mpm_credits_per_paid_cycle>=0),
 media_right_ratio NUMERIC(12,6) NOT NULL DEFAULT 1 CHECK(media_right_ratio>=0), initial_release_percent NUMERIC(6,3) NOT NULL DEFAULT 100 CHECK(initial_release_percent BETWEEN 0 AND 100),
 advance_release_percent NUMERIC(6,3) NOT NULL DEFAULT 30 CHECK(advance_release_percent BETWEEN 0 AND 100), performance_release_percent NUMERIC(6,3) NOT NULL DEFAULT 70 CHECK(performance_release_percent BETWEEN 0 AND 100),
 preferred_locations_limit SMALLINT NOT NULL DEFAULT 3 CHECK(preferred_locations_limit>=0), max_advertiser_per_screen_cycle BIGINT NOT NULL DEFAULT 2000 CHECK(max_advertiser_per_screen_cycle>0),
 excess_preset TEXT NOT NULL DEFAULT 'balanced' CHECK(excess_preset IN('balanced','more_news','more_network','more_own')),
 effective_from TIMESTAMPTZ NOT NULL DEFAULT now(), effective_to TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(code,version), CHECK(advance_release_percent+performance_release_percent<=100), CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX uq_screen_capacity_plan_current ON public.screen_capacity_plan_versions(code) WHERE effective_to IS NULL;

INSERT INTO public.screen_capacity_plan_versions(code,version,monthly_price_cents,network_insertions,own_insertions,mpm_reserve_insertions,sponsor_insertions,commercial_insertions,promotional_mpm_credits_per_paid_cycle)
VALUES('mpm_standard',1,14900,20000,5000,2000,0,3000,600);

INSERT INTO public.partner_programs(code,name,program_type,reward_type,reward_value,status,terms)
VALUES('racon-homologacao','Racon Homologação','partner','media_entitlement',18000,'draft','{"free_coupons":10,"additional_monthly_price_cents":9990,"rollout":"master_controlled"}'::jsonb)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.screen_capacity_plan_versions(code,version,program_id,monthly_price_cents,network_insertions,own_insertions,mpm_reserve_insertions,sponsor_insertions,commercial_insertions,promotional_mpm_credits_per_paid_cycle)
SELECT 'racon_partner_free',1,id,0,18000,5000,2000,2000,3000,0 FROM public.partner_programs WHERE code='racon-homologacao'
UNION ALL SELECT 'racon_partner_additional',1,id,9990,18000,5000,2000,2000,3000,0 FROM public.partner_programs WHERE code='racon-homologacao';

CREATE TABLE public.screen_operating_schedules(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
 weekday SMALLINT NOT NULL CHECK(weekday BETWEEN 0 AND 6), opens_at TIME, closes_at TIME, is_closed BOOLEAN NOT NULL DEFAULT false,
 effective_from DATE NOT NULL DEFAULT current_date, effective_to DATE, timezone TEXT NOT NULL DEFAULT 'America/Cuiaba',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(screen_id,weekday,effective_from), CHECK(is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND closes_at>opens_at)), CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
CREATE TABLE public.screen_schedule_exceptions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
 exception_date DATE NOT NULL, opens_at TIME, closes_at TIME, is_closed BOOLEAN NOT NULL DEFAULT false, reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(screen_id,exception_date), CHECK(is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND closes_at>opens_at))
);

ALTER TABLE public.inventory_capacity_periods
 ADD COLUMN plan_version_id UUID REFERENCES public.screen_capacity_plan_versions(id) ON DELETE RESTRICT,
 ADD COLUMN planned_minutes BIGINT NOT NULL DEFAULT 0 CHECK(planned_minutes>=0),
 ADD COLUMN available_minutes BIGINT NOT NULL DEFAULT 0 CHECK(available_minutes>=0),
 ADD COLUMN certified_capacity BIGINT NOT NULL DEFAULT 0 CHECK(certified_capacity>=0),
 ADD COLUMN own_inventory BIGINT NOT NULL DEFAULT 0 CHECK(own_inventory>=0),
 ADD COLUMN mpm_reserve BIGINT NOT NULL DEFAULT 0 CHECK(mpm_reserve>=0),
 ADD COLUMN sponsor_reserve BIGINT NOT NULL DEFAULT 0 CHECK(sponsor_reserve>=0),
 ADD COLUMN commercial_inventory BIGINT NOT NULL DEFAULT 0 CHECK(commercial_inventory>=0),
 ADD COLUMN sold_inventory BIGINT NOT NULL DEFAULT 0 CHECK(sold_inventory>=0),
 ADD COLUMN rights_target BIGINT NOT NULL DEFAULT 0 CHECK(rights_target>=0),
 ADD COLUMN rights_released BIGINT NOT NULL DEFAULT 0 CHECK(rights_released>=0),
 ADD COLUMN cycle_number INTEGER NOT NULL DEFAULT 1 CHECK(cycle_number>0),
 ADD COLUMN plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD CONSTRAINT capacity_sold_within_commercial CHECK(sold_inventory<=commercial_inventory),
 ADD CONSTRAINT capacity_rights_within_target CHECK(rights_released<=rights_target);

CREATE TABLE public.screen_capacity_daily(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), capacity_period_id UUID NOT NULL REFERENCES public.inventory_capacity_periods(id) ON DELETE CASCADE,
 screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE, service_date DATE NOT NULL,
 planned_minutes INTEGER NOT NULL DEFAULT 0 CHECK(planned_minutes>=0), online_minutes INTEGER NOT NULL DEFAULT 0 CHECK(online_minutes>=0),
 planned_equivalent_slots BIGINT NOT NULL DEFAULT 0 CHECK(planned_equivalent_slots>=0), produced_equivalent_slots BIGINT NOT NULL DEFAULT 0 CHECK(produced_equivalent_slots>=0),
 network_deliveries BIGINT NOT NULL DEFAULT 0 CHECK(network_deliveries>=0), validated_deliveries BIGINT NOT NULL DEFAULT 0 CHECK(validated_deliveries>=0),
 heartbeat_samples INTEGER NOT NULL DEFAULT 0 CHECK(heartbeat_samples>=0), status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','closed','certified')),
 calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(screen_id,service_date)
);
CREATE TABLE public.screen_capacity_certifications(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
 window_start DATE NOT NULL, window_end DATE NOT NULL, sample_days INTEGER NOT NULL CHECK(sample_days>0),
 average_capacity BIGINT NOT NULL CHECK(average_capacity>=0), minimum_capacity BIGINT NOT NULL CHECK(minimum_capacity>=0),
 safety_margin_percent NUMERIC(6,3) NOT NULL CHECK(safety_margin_percent BETWEEN 0 AND 100), certified_capacity BIGINT NOT NULL CHECK(certified_capacity>=0),
 proposed_commercial_inventory BIGINT NOT NULL CHECK(proposed_commercial_inventory>=0), status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN('proposed','approved','rejected','superseded')),
 approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(window_end>=window_start)
);
CREATE TABLE public.screen_capacity_preferences(
 screen_id UUID PRIMARY KEY REFERENCES public.screens(id) ON DELETE CASCADE,
 excess_preset TEXT NOT NULL DEFAULT 'balanced' CHECK(excess_preset IN('balanced','more_news','more_network','more_own')),
 updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.partner_activation_coupons(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
 code TEXT NOT NULL UNIQUE, coupon_kind TEXT NOT NULL CHECK(coupon_kind IN('free','paid_additional')),
 monthly_price_cents BIGINT NOT NULL CHECK(monthly_price_cents>=0), status TEXT NOT NULL DEFAULT 'available' CHECK(status IN('available','reserved','activated','expired','cancelled')),
 company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT, screen_id UUID REFERENCES public.screens(id) ON DELETE RESTRICT,
 activated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(status<>'activated' OR (company_id IS NOT NULL AND screen_id IS NOT NULL AND activated_at IS NOT NULL))
);
INSERT INTO public.partner_activation_coupons(program_id,code,coupon_kind,monthly_price_cents)
SELECT p.id,'RACON-HML-'||lpad(g::text,2,'0'),'free',0 FROM public.partner_programs p CROSS JOIN generate_series(1,10) g WHERE p.code='racon-homologacao'
ON CONFLICT(code) DO NOTHING;

ALTER TABLE public.screen_operating_schedules ENABLE ROW LEVEL SECURITY; ALTER TABLE public.screen_schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_capacity_daily ENABLE ROW LEVEL SECURITY; ALTER TABLE public.screen_capacity_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_capacity_preferences ENABLE ROW LEVEL SECURITY; ALTER TABLE public.partner_activation_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_capacity_plan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Capacity plans read" ON public.screen_capacity_plan_versions FOR SELECT TO authenticated USING(true);
CREATE POLICY "Screen schedules tenant" ON public.screen_operating_schedules FOR ALL TO authenticated USING(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin()) WITH CHECK(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_admin_company_ids())) OR public.is_master_admin());
CREATE POLICY "Screen exceptions tenant" ON public.screen_schedule_exceptions FOR ALL TO authenticated USING(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin()) WITH CHECK(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_admin_company_ids())) OR public.is_master_admin());
CREATE POLICY "Capacity daily tenant" ON public.screen_capacity_daily FOR SELECT TO authenticated USING(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Capacity certifications tenant" ON public.screen_capacity_certifications FOR SELECT TO authenticated USING(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Capacity preferences tenant" ON public.screen_capacity_preferences FOR ALL TO authenticated USING(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin()) WITH CHECK(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_admin_company_ids())) OR public.is_master_admin());
CREATE POLICY "Partner coupons owner or master" ON public.partner_activation_coupons FOR SELECT TO authenticated USING(program_id IN(SELECT id FROM public.partner_programs WHERE owner_company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());

CREATE OR REPLACE FUNCTION public.calculate_screen_planned_minutes(p_screen_id UUID,p_start DATE,p_end DATE) RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
 SELECT COALESCE(sum(CASE WHEN e.id IS NOT NULL THEN CASE WHEN e.is_closed THEN 0 ELSE extract(epoch FROM(e.closes_at-e.opens_at))/60 END ELSE CASE WHEN s.is_closed THEN 0 ELSE extract(epoch FROM(s.closes_at-s.opens_at))/60 END END),0)::bigint
 FROM generate_series(p_start,p_end,'1 day') d
 LEFT JOIN public.screen_schedule_exceptions e ON e.screen_id=p_screen_id AND e.exception_date=d::date
 LEFT JOIN LATERAL(SELECT * FROM public.screen_operating_schedules x WHERE x.screen_id=p_screen_id AND x.weekday=extract(dow FROM d)::int AND x.effective_from<=d::date AND (x.effective_to IS NULL OR x.effective_to>=d::date) ORDER BY x.effective_from DESC LIMIT 1)s ON true;
$$;

CREATE OR REPLACE FUNCTION public.screen_capacity_status(p_company_id UUID DEFAULT NULL) RETURNS SETOF public.inventory_capacity_periods
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
 SELECT cp.* FROM public.inventory_capacity_periods cp JOIN public.media_inventory mi ON mi.id=cp.media_inventory_id
 WHERE mi.source_type='company_screen' AND (p_company_id IS NULL OR mi.owner_id=p_company_id)
 AND (mi.owner_id IN(SELECT public.get_user_company_ids()) OR public.is_master_admin()) ORDER BY cp.period_start DESC;
$$;
REVOKE ALL ON FUNCTION public.screen_capacity_status(UUID) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.screen_capacity_status(UUID) TO authenticated,service_role;

-- A cobrança e o payout reais permanecem desligados; nenhuma linha financeira é criada por esta migration.
