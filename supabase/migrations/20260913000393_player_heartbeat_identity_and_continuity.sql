-- Identidade enviada pelo Player e continuidade de heartbeat por sessao.
-- Nao altera capacidade economica, buckets, billing, payout ou rollout.
ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS player_version TEXT,
  ADD COLUMN IF NOT EXISTS player_build TEXT,
  ADD COLUMN IF NOT EXISTS player_commit TEXT,
  ADD COLUMN IF NOT EXISTS player_platform TEXT,
  ADD COLUMN IF NOT EXISTS player_runtime_version TEXT,
  ADD COLUMN IF NOT EXISTS last_player_session_id TEXT;

ALTER TABLE public.screen_capacity_daily
  ADD COLUMN IF NOT EXISTS last_heartbeat_session_id TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat_id TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat_in_schedule BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.record_screen_capacity_heartbeat(
  p_screen_id UUID,
  p_player_session_id TEXT,
  p_heartbeat_id TEXT,
  p_player_metadata JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 rollout public.screen_capacity_rollouts%ROWTYPE; cp public.inventory_capacity_periods%ROWTYPE; daily public.screen_capacity_daily%ROWTYPE;
 tz TEXT:='America/Cuiaba'; local_ts TIMESTAMP; local_day DATE; local_time TIME; in_window BOOLEAN:=false;
 delta_seconds INTEGER:=0; elapsed_seconds INTEGER:=0; planned INTEGER:=0; session_continuous BOOLEAN:=false; captured_at TIMESTAMPTZ:=now();
BEGIN
 UPDATE public.screens SET
  player_version=NULLIF(left(p_player_metadata->>'player_version',64),''),
  player_build=NULLIF(left(p_player_metadata->>'player_build',128),''),
  player_commit=NULLIF(left(p_player_metadata->>'player_commit',64),''),
  player_platform=NULLIF(left(p_player_metadata->>'platform',128),''),
  player_runtime_version=NULLIF(left(p_player_metadata->>'runtime_version',128),''),
  last_player_session_id=NULLIF(left(p_player_session_id,128),'')
 WHERE id=p_screen_id;

 SELECT * INTO rollout FROM public.screen_capacity_rollouts
 WHERE screen_id=p_screen_id AND capacity_tracking_enabled AND starts_at<=captured_at AND (ends_at IS NULL OR ends_at>=captured_at);
 IF rollout.screen_id IS NULL THEN RETURN jsonb_build_object('tracked',false,'reason','rollout_off'); END IF;

 SELECT COALESCE((SELECT timezone FROM public.screen_operating_schedules WHERE screen_id=p_screen_id AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date) ORDER BY effective_from DESC LIMIT 1),'America/Cuiaba') INTO tz;
 local_ts:=captured_at AT TIME ZONE tz; local_day:=local_ts::date; local_time:=local_ts::time;
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

 INSERT INTO public.screen_capacity_daily(capacity_period_id,screen_id,service_date,planned_minutes,planned_equivalent_slots,heartbeat_samples)
 VALUES(cp.id,p_screen_id,local_day,planned,floor(planned*60/15),0)
 ON CONFLICT(screen_id,service_date) DO NOTHING;
 SELECT * INTO daily FROM public.screen_capacity_daily WHERE screen_id=p_screen_id AND service_date=local_day FOR UPDATE;

 IF p_heartbeat_id IS NOT NULL AND p_heartbeat_id=daily.last_heartbeat_id THEN
  RETURN jsonb_build_object('tracked',true,'duplicate',true,'inside_schedule',in_window,'added_seconds',0,'service_date',local_day);
 END IF;

 session_continuous := p_player_session_id IS NOT DISTINCT FROM daily.last_heartbeat_session_id;
 IF in_window AND daily.last_heartbeat_in_schedule AND session_continuous AND daily.last_heartbeat_at IS NOT NULL THEN
  elapsed_seconds:=greatest(0,extract(epoch FROM(captured_at-daily.last_heartbeat_at))::integer);
  IF elapsed_seconds>0 AND elapsed_seconds<=75 THEN delta_seconds:=elapsed_seconds; END IF;
 END IF;

 UPDATE public.screen_capacity_daily SET
  heartbeat_samples=heartbeat_samples+1,
  last_heartbeat_at=captured_at,
  last_heartbeat_session_id=NULLIF(left(p_player_session_id,128),''),
  last_heartbeat_id=NULLIF(left(p_heartbeat_id,128),''),
  last_heartbeat_in_schedule=in_window,
  online_seconds=online_seconds+delta_seconds,
  online_minutes=floor((online_seconds+delta_seconds)/60),
  produced_equivalent_slots=floor((online_seconds+delta_seconds)/15),
  calculated_at=captured_at
 WHERE id=daily.id;
 UPDATE public.inventory_capacity_periods SET available_minutes=COALESCE((SELECT floor(sum(online_seconds)/60) FROM public.screen_capacity_daily WHERE capacity_period_id=cp.id),0),updated_at=captured_at WHERE id=cp.id;
 RETURN jsonb_build_object('tracked',true,'duplicate',false,'inside_schedule',in_window,'added_seconds',delta_seconds,'continuity_reset',NOT session_continuous OR elapsed_seconds>75,'service_date',local_day);
END $$;

-- Compatibilidade para qualquer chamada legada que ainda use somente screen_id.
CREATE OR REPLACE FUNCTION public.record_screen_capacity_heartbeat(p_screen_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.record_screen_capacity_heartbeat(p_screen_id,NULL,NULL,'{}'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.record_screen_capacity_heartbeat(UUID,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_screen_capacity_heartbeat(UUID,TEXT,TEXT,JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.record_screen_capacity_heartbeat(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_screen_capacity_heartbeat(UUID) TO service_role;

COMMENT ON COLUMN public.screens.player_build IS 'Build informado pelo bundle cliente no heartbeat; nunca inferido da resposta do servidor.';
COMMENT ON COLUMN public.screen_capacity_daily.last_heartbeat_session_id IS 'Sessao cliente usada para impedir continuidade artificial entre reaberturas.';
