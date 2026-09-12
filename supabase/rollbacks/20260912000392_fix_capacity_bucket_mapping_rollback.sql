-- Kill switch seguro para a correcao: desativa qualquer rollout antes de restaurar
-- manualmente a funcao anterior da migration 390.
UPDATE public.screen_capacity_rollouts SET dynamic_player_enabled=false,capacity_tracking_enabled=false,ends_at=now(),updated_at=now() WHERE dynamic_player_enabled OR capacity_tracking_enabled;
