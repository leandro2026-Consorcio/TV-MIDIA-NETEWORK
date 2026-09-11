-- Fase 3.1 — allowlist mínima para homologação controlada por owner.
-- O público permanece OFF; o RPC de homologação usa flags locais à transação.

INSERT INTO public.platform_settings(key,value,description)
SELECT 'multichannel_homologation_allowlist',
       jsonb_build_object('owner_keys',COALESCE((SELECT jsonb_agg('company:'||x.id::text) FROM (
         SELECT c.id FROM public.companies c
         WHERE EXISTS(SELECT 1 FROM public.social_channels ch WHERE ch.owner_type='company' AND ch.owner_id=c.id AND ch.status='active')
           AND EXISTS(SELECT 1 FROM public.screens s WHERE s.company_id=c.id AND s.venue_type<>'residential')
           AND EXISTS(SELECT 1 FROM public.media_assets m WHERE m.company_id=c.id AND m.status='approved')
         ORDER BY c.created_at LIMIT 1
       ) x),'[]'::jsonb)),
       'Allowlist restrita da homologação Fase 3.1; não é rollout público.'
ON CONFLICT(key) DO UPDATE SET description=excluded.description;

DROP POLICY IF EXISTS "Multichannel homologation allowlist read" ON public.platform_settings;
CREATE POLICY "Multichannel homologation allowlist read" ON public.platform_settings FOR SELECT TO authenticated
USING(key='multichannel_homologation_allowlist');

CREATE OR REPLACE FUNCTION public.multichannel_owner_allowlisted(p_owner_type TEXT,p_owner_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.platform_settings s WHERE s.key='multichannel_homologation_allowlist'
   AND COALESCE(s.value->'owner_keys','[]'::jsonb) ? (p_owner_type||':'||p_owner_id::text));
$$;

CREATE OR REPLACE FUNCTION public.register_multichannel_homologation_event(
 p_rule_id UUID,p_campaign_id UUID,p_media_asset_id UUID,p_source_social_publication_id UUID,p_source_external_post_id TEXT,
 p_content_hash TEXT,p_asset_hash TEXT,p_parent_event_id UUID,p_visited_destinations TEXT[],p_depth INTEGER,p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.multichannel_rules%ROWTYPE; result JSONB;
BEGIN
 SELECT * INTO r FROM public.multichannel_rules WHERE id=p_rule_id;
 IF r.id IS NULL OR NOT public.mpm_can_manage_holder(r.owner_type,r.owner_id) OR NOT public.multichannel_owner_allowlisted(r.owner_type,r.owner_id) THEN
   RAISE EXCEPTION 'Owner não está na allowlist de homologação.';
 END IF;
 -- Flags são elevadas somente nesta transação; em caso de erro tudo sofre rollback.
 UPDATE public.platform_settings SET value='true'::jsonb WHERE key IN('multichannel_replication_enabled','social_to_tv_replication_enabled','multichannel_auto_mode_enabled');
 SELECT public.register_propagation_event(p_rule_id,p_campaign_id,p_media_asset_id,p_source_social_publication_id,p_source_external_post_id,
   'manual',p_content_hash,p_asset_hash,p_parent_event_id,p_visited_destinations,p_depth,p_idempotency_key) INTO result;
 UPDATE public.platform_settings SET value='false'::jsonb WHERE key IN('multichannel_replication_enabled','social_to_tv_replication_enabled','multichannel_auto_mode_enabled');
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.register_multichannel_homologation_event(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,UUID,TEXT[],INTEGER,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_multichannel_homologation_event(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,UUID,TEXT[],INTEGER,TEXT) TO authenticated,service_role;
GRANT SELECT ON public.platform_settings TO authenticated;
NOTIFY pgrst,'reload schema';
