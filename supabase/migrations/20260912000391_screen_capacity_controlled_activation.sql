-- Ativacao operacional controlada por TV. A flag global permanece desligada.
CREATE TABLE public.screen_capacity_rollouts(
 screen_id UUID PRIMARY KEY REFERENCES public.screens(id) ON DELETE CASCADE,
 dynamic_player_enabled BOOLEAN NOT NULL DEFAULT false,
 capacity_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
 starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ends_at TIMESTAMPTZ,
 activated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 reason TEXT NOT NULL DEFAULT 'homologation',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR ends_at>starts_at)
);
ALTER TABLE public.screen_capacity_rollouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Capacity rollout tenant read" ON public.screen_capacity_rollouts FOR SELECT TO authenticated
 USING(screen_id IN(SELECT id FROM public.screens WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Capacity rollout master manage" ON public.screen_capacity_rollouts FOR ALL TO authenticated
 USING(public.is_master_admin()) WITH CHECK(public.is_master_admin());

ALTER TABLE public.screen_capacity_daily
 ADD COLUMN online_seconds BIGINT NOT NULL DEFAULT 0 CHECK(online_seconds>=0),
 ADD COLUMN last_heartbeat_at TIMESTAMPTZ;

CREATE TABLE public.screen_capacity_delivery_counters(
 capacity_period_id UUID NOT NULL REFERENCES public.inventory_capacity_periods(id) ON DELETE CASCADE,
 bucket TEXT NOT NULL CHECK(bucket IN('sold','sponsor','network','mpm_reserve','own')),
 equivalent_slots BIGINT NOT NULL DEFAULT 0 CHECK(equivalent_slots>=0),
 playback_count BIGINT NOT NULL DEFAULT 0 CHECK(playback_count>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(capacity_period_id,bucket)
);
ALTER TABLE public.screen_capacity_delivery_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Capacity delivery counters tenant read" ON public.screen_capacity_delivery_counters FOR SELECT TO authenticated USING(
 capacity_period_id IN(SELECT cp.id FROM public.inventory_capacity_periods cp JOIN public.media_inventory mi ON mi.id=cp.media_inventory_id WHERE mi.owner_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());

CREATE OR REPLACE FUNCTION public.materialize_screen_capacity_daily(p_capacity_period_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cp public.inventory_capacity_periods%ROWTYPE; mi public.media_inventory%ROWTYPE; d DATE; planned INTEGER; affected INTEGER:=0;
BEGIN
 SELECT * INTO cp FROM public.inventory_capacity_periods WHERE id=p_capacity_period_id;
 SELECT * INTO mi FROM public.media_inventory WHERE id=cp.media_inventory_id;
 IF cp.id IS NULL OR NOT(public.is_master_admin() OR mi.owner_id IN(SELECT public.get_user_admin_company_ids())) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 FOR d IN SELECT generate_series(cp.period_start,cp.period_end,'1 day')::date LOOP
  planned:=public.calculate_screen_planned_minutes(mi.source_id,d,d)::integer;
  INSERT INTO public.screen_capacity_daily(capacity_period_id,screen_id,service_date,planned_minutes,planned_equivalent_slots)
  VALUES(cp.id,mi.source_id,d,planned,floor(planned*60/15))
  ON CONFLICT(screen_id,service_date) DO UPDATE SET capacity_period_id=excluded.capacity_period_id,planned_minutes=excluded.planned_minutes,planned_equivalent_slots=excluded.planned_equivalent_slots,calculated_at=now();
  affected:=affected+1;
 END LOOP;
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.materialize_screen_capacity_daily(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.materialize_screen_capacity_daily(UUID) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.record_screen_capacity_heartbeat(p_screen_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rollout public.screen_capacity_rollouts%ROWTYPE; cp public.inventory_capacity_periods%ROWTYPE; daily public.screen_capacity_daily%ROWTYPE;
 tz TEXT:='America/Cuiaba'; local_ts TIMESTAMP; local_day DATE; local_time TIME; in_window BOOLEAN:=false; delta_seconds INTEGER:=0; planned INTEGER:=0;
BEGIN
 SELECT * INTO rollout FROM public.screen_capacity_rollouts WHERE screen_id=p_screen_id AND capacity_tracking_enabled AND starts_at<=now() AND (ends_at IS NULL OR ends_at>=now());
 IF rollout.screen_id IS NULL THEN RETURN jsonb_build_object('tracked',false,'reason','rollout_off'); END IF;
 SELECT COALESCE((SELECT timezone FROM public.screen_operating_schedules WHERE screen_id=p_screen_id AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date) ORDER BY effective_from DESC LIMIT 1),'America/Cuiaba') INTO tz;
 local_ts:=now() AT TIME ZONE tz; local_day:=local_ts::date; local_time:=local_ts::time;
 SELECT icp.* INTO cp FROM public.inventory_capacity_periods icp JOIN public.media_inventory mi ON mi.id=icp.media_inventory_id
 WHERE mi.source_type='company_screen' AND mi.source_id=p_screen_id AND icp.status='active' AND local_day BETWEEN icp.period_start AND icp.period_end ORDER BY icp.period_start DESC LIMIT 1;
 IF cp.id IS NULL THEN RETURN jsonb_build_object('tracked',false,'reason','no_active_cycle'); END IF;
 planned:=public.calculate_screen_planned_minutes(p_screen_id,local_day,local_day)::integer;
 SELECT CASE WHEN e.id IS NOT NULL THEN NOT e.is_closed AND local_time>=e.opens_at AND local_time<e.closes_at
             ELSE s.id IS NOT NULL AND NOT s.is_closed AND local_time>=s.opens_at AND local_time<s.closes_at END
 INTO in_window
 FROM (SELECT 1) seed
 LEFT JOIN public.screen_schedule_exceptions e ON e.screen_id=p_screen_id AND e.exception_date=local_day
 LEFT JOIN LATERAL(SELECT * FROM public.screen_operating_schedules x WHERE x.screen_id=p_screen_id AND x.weekday=extract(dow FROM local_day)::int AND x.effective_from<=local_day AND (x.effective_to IS NULL OR x.effective_to>=local_day) ORDER BY x.effective_from DESC LIMIT 1)s ON true;
 INSERT INTO public.screen_capacity_daily(capacity_period_id,screen_id,service_date,planned_minutes,planned_equivalent_slots,last_heartbeat_at,heartbeat_samples)
 VALUES(cp.id,p_screen_id,local_day,planned,floor(planned*60/15),now(),0)
 ON CONFLICT(screen_id,service_date) DO NOTHING;
 SELECT * INTO daily FROM public.screen_capacity_daily WHERE screen_id=p_screen_id AND service_date=local_day FOR UPDATE;
 IF in_window AND daily.last_heartbeat_at IS NOT NULL THEN delta_seconds:=least(90,greatest(0,extract(epoch FROM(now()-daily.last_heartbeat_at))::integer)); END IF;
 UPDATE public.screen_capacity_daily SET heartbeat_samples=heartbeat_samples+1,last_heartbeat_at=now(),online_seconds=online_seconds+delta_seconds,
  online_minutes=floor((online_seconds+delta_seconds)/60),produced_equivalent_slots=floor((online_seconds+delta_seconds)/15),calculated_at=now()
 WHERE id=daily.id;
 UPDATE public.inventory_capacity_periods SET available_minutes=COALESCE((SELECT floor(sum(online_seconds)/60) FROM public.screen_capacity_daily WHERE capacity_period_id=cp.id),0),updated_at=now() WHERE id=cp.id;
 RETURN jsonb_build_object('tracked',true,'inside_schedule',in_window,'added_seconds',delta_seconds,'service_date',local_day);
END $$;
REVOKE ALL ON FUNCTION public.record_screen_capacity_heartbeat(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_screen_capacity_heartbeat(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.aggregate_screen_capacity_playback()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cp_id UUID; local_day DATE; units BIGINT; tz TEXT:='America/Cuiaba'; bucket_name TEXT:='network'; campaign_kind TEXT;
BEGIN
 IF NEW.status<>'completed' OR NOT EXISTS(SELECT 1 FROM public.screen_capacity_rollouts r WHERE r.screen_id=NEW.screen_id AND r.capacity_tracking_enabled AND r.starts_at<=now() AND (r.ends_at IS NULL OR r.ends_at>=now())) THEN RETURN NEW; END IF;
 SELECT COALESCE((SELECT timezone FROM public.screen_operating_schedules WHERE screen_id=NEW.screen_id AND effective_from<=NEW.started_at::date ORDER BY effective_from DESC LIMIT 1),'America/Cuiaba') INTO tz;
 local_day:=(NEW.started_at AT TIME ZONE tz)::date;
 SELECT icp.id INTO cp_id FROM public.inventory_capacity_periods icp JOIN public.media_inventory mi ON mi.id=icp.media_inventory_id
 WHERE mi.source_type='company_screen' AND mi.source_id=NEW.screen_id AND icp.status='active' AND local_day BETWEEN icp.period_start AND icp.period_end ORDER BY icp.period_start DESC LIMIT 1;
 IF cp_id IS NULL THEN RETURN NEW; END IF;
 units:=ceil(NEW.planned_duration_seconds::numeric/15);
 IF NEW.playlist_id IS NOT NULL THEN bucket_name:='own';
 ELSE
  SELECT c.campaign_type INTO campaign_kind FROM public.campaigns c JOIN public.campaign_screens cs ON cs.campaign_id=c.id JOIN public.campaign_media cm ON cm.campaign_id=c.id
  WHERE cs.screen_id=NEW.screen_id AND cm.media_asset_id=NEW.media_asset_id AND cs.is_active AND cm.is_active ORDER BY c.created_at DESC LIMIT 1;
  bucket_name:=CASE WHEN campaign_kind='internal' THEN 'mpm_reserve' WHEN campaign_kind IN('paid','marketplace','commercial') THEN 'sold' ELSE 'network' END;
 END IF;
 UPDATE public.screen_capacity_daily SET validated_deliveries=validated_deliveries+1,calculated_at=now()
 WHERE capacity_period_id=cp_id AND screen_id=NEW.screen_id AND service_date=local_day;
 INSERT INTO public.screen_capacity_delivery_counters(capacity_period_id,bucket,equivalent_slots,playback_count)
 VALUES(cp_id,bucket_name,units,1) ON CONFLICT(capacity_period_id,bucket) DO UPDATE SET equivalent_slots=screen_capacity_delivery_counters.equivalent_slots+excluded.equivalent_slots,playback_count=screen_capacity_delivery_counters.playback_count+1,updated_at=now();
 UPDATE public.inventory_capacity_periods SET delivered_capacity=least(theoretical_capacity,delivered_capacity+units),updated_at=now() WHERE id=cp_id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_aggregate_screen_capacity_playback ON public.playback_logs;
CREATE TRIGGER trg_aggregate_screen_capacity_playback AFTER INSERT ON public.playback_logs FOR EACH ROW EXECUTE FUNCTION public.aggregate_screen_capacity_playback();

COMMENT ON TABLE public.screen_capacity_rollouts IS 'Kill switch e allowlist por TV; nao substitui a flag global e inicia vazio.';
