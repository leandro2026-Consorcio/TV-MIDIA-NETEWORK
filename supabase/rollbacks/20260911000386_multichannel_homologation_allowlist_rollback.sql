DROP FUNCTION IF EXISTS public.register_multichannel_homologation_event(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,UUID,TEXT[],INTEGER,TEXT);
DROP FUNCTION IF EXISTS public.multichannel_owner_allowlisted(TEXT,UUID);
DROP POLICY IF EXISTS "Multichannel homologation allowlist read" ON public.platform_settings;
DELETE FROM public.platform_settings WHERE key='multichannel_homologation_allowlist';
