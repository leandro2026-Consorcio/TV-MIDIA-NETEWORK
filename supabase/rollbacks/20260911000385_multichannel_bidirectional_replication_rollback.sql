-- Rollback Fase 3. Não executa automaticamente.
DROP FUNCTION IF EXISTS public.process_multichannel_scheduler(TEXT);
DROP FUNCTION IF EXISTS public.decide_multichannel_approval(UUID,BOOLEAN,TEXT);
DROP FUNCTION IF EXISTS public.register_propagation_event(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT[],INTEGER,TEXT);
DROP FUNCTION IF EXISTS public.create_multichannel_rule(TEXT,UUID,TEXT,TEXT,UUID,UUID,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,JSONB,JSONB);
DROP FUNCTION IF EXISTS public.validate_multichannel_target_owner();
DROP FUNCTION IF EXISTS public.validate_multichannel_rule_owner();
DROP FUNCTION IF EXISTS public.multichannel_effective_mode(public.multichannel_rules,TIMESTAMPTZ);
DROP TABLE IF EXISTS public.multichannel_asset_variants;
DROP TABLE IF EXISTS public.multichannel_approval_tasks;
DROP TABLE IF EXISTS public.propagation_targets;
DROP TABLE IF EXISTS public.propagation_events;
DROP TABLE IF EXISTS public.multichannel_rule_targets;
DROP TABLE IF EXISTS public.multichannel_rules;
DROP TABLE IF EXISTS public.multichannel_provider_capabilities;
DELETE FROM public.platform_settings WHERE key IN('multichannel_replication_enabled','social_to_tv_replication_enabled','social_crosspost_enabled','multichannel_auto_mode_enabled');
