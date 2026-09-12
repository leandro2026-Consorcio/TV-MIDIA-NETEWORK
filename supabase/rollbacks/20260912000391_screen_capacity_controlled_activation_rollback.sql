DROP TRIGGER IF EXISTS trg_aggregate_screen_capacity_playback ON public.playback_logs;
DROP FUNCTION IF EXISTS public.aggregate_screen_capacity_playback();
DROP FUNCTION IF EXISTS public.record_screen_capacity_heartbeat(UUID);
DROP FUNCTION IF EXISTS public.materialize_screen_capacity_daily(UUID);
ALTER TABLE public.screen_capacity_daily DROP COLUMN IF EXISTS last_heartbeat_at, DROP COLUMN IF EXISTS online_seconds;
DROP TABLE IF EXISTS public.screen_capacity_delivery_counters;
DROP TABLE IF EXISTS public.screen_capacity_rollouts;
