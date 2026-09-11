-- MPM Fase 3 — replicação multicanal bidirecional.
-- Camada aditiva. Não altera OAuth, tokens, campanhas econômicas ou migrations anteriores.

INSERT INTO public.platform_settings(key,value,description) VALUES
 ('multichannel_replication_enabled','false'::jsonb,'Kill switch geral da replicação multicanal.'),
 ('social_to_tv_replication_enabled','false'::jsonb,'Autoriza materialização social para TV com mídia canônica aprovada.'),
 ('social_crosspost_enabled','false'::jsonb,'Autoriza planejamento de crosspost entre redes com capability válida.'),
 ('multichannel_auto_mode_enabled','false'::jsonb,'Autoriza execução automática de regras elegíveis.')
ON CONFLICT(key) DO UPDATE SET description=excluded.description;

CREATE POLICY "Multichannel flags read" ON public.platform_settings FOR SELECT TO authenticated
USING(key IN('multichannel_replication_enabled','social_to_tv_replication_enabled','social_crosspost_enabled','multichannel_auto_mode_enabled'));

CREATE TABLE public.multichannel_provider_capabilities(
 provider TEXT PRIMARY KEY CHECK(provider IN('instagram','facebook','tiktok','mpm','tv')),
 detection_mode TEXT NOT NULL CHECK(detection_mode IN('realtime','polling','manual','unavailable')),
 source_detection_capable BOOLEAN NOT NULL DEFAULT false,
 automatic_publish_capable BOOLEAN NOT NULL DEFAULT false,
 evidence TEXT NOT NULL,
 observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.multichannel_provider_capabilities(provider,detection_mode,source_detection_capable,automatic_publish_capable,evidence) VALUES
 ('mpm','realtime',true,true,'Evento interno transacional do MPM.'),
 ('tv','realtime',true,true,'Scheduler e playlists internas do MPM.'),
 ('instagram','manual',false,false,'Sem evidência de webhook/publicação automática aprovada neste ambiente.'),
 ('facebook','manual',false,false,'Sem evidência de webhook/publicação automática aprovada neste ambiente.'),
 ('tiktok','manual',false,false,'Login Kit homologado; publicação automática não aprovada.')
ON CONFLICT(provider) DO UPDATE SET detection_mode=excluded.detection_mode,source_detection_capable=excluded.source_detection_capable,
 automatic_publish_capable=excluded.automatic_publish_capable,evidence=excluded.evidence,updated_at=now();

CREATE TABLE public.multichannel_rules(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_type TEXT NOT NULL CHECK(owner_type IN('company','creator')),
 owner_id UUID NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 120),
 source_kind TEXT NOT NULL CHECK(source_kind IN('mpm','tv','social')),
 source_social_channel_id UUID REFERENCES public.social_channels(id) ON DELETE RESTRICT,
 source_screen_id UUID REFERENCES public.screens(id) ON DELETE RESTRICT,
 campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
 eligibility_mode TEXT NOT NULL DEFAULT 'campaigns_mpm' CHECK(eligibility_mode IN('campaigns_mpm','mpm_created','hashtag','all_eligible')),
 required_hashtag TEXT,
 included_formats TEXT[] NOT NULL DEFAULT '{}', excluded_formats TEXT[] NOT NULL DEFAULT '{}',
 mode TEXT NOT NULL DEFAULT 'approval' CHECK(mode IN('off','approval','automatic','automatic_temporary')),
 starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
 fallback_mode TEXT NOT NULL DEFAULT 'approval' CHECK(fallback_mode IN('approval','off')),
 timezone TEXT NOT NULL DEFAULT 'America/Cuiaba',
 max_depth SMALLINT NOT NULL DEFAULT 3 CHECK(max_depth BETWEEN 1 AND 10),
 approval_expiry_minutes INTEGER NOT NULL DEFAULT 1440 CHECK(approval_expiry_minutes BETWEEN 5 AND 43200),
 frequency_cap_count INTEGER CHECK(frequency_cap_count IS NULL OR frequency_cap_count>0),
 frequency_cap_window_hours INTEGER NOT NULL DEFAULT 24 CHECK(frequency_cap_window_hours BETWEEN 1 AND 720),
 collaborative_network_allowed BOOLEAN NOT NULL DEFAULT false,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','paused','archived')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 filters JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at),
 CHECK((source_kind='social' AND source_social_channel_id IS NOT NULL AND source_screen_id IS NULL) OR
       (source_kind='tv' AND source_screen_id IS NOT NULL AND source_social_channel_id IS NULL) OR
       (source_kind='mpm' AND source_social_channel_id IS NULL AND source_screen_id IS NULL)),
 CHECK(eligibility_mode<>'hashtag' OR NULLIF(trim(required_hashtag),'') IS NOT NULL),
 CHECK(eligibility_mode<>'all_eligible' OR filters->>'advanced_confirmed'='true'),
 CHECK(mode<>'automatic_temporary' OR (starts_at IS NOT NULL AND ends_at IS NOT NULL))
);
CREATE INDEX idx_multichannel_rules_owner ON public.multichannel_rules(owner_type,owner_id,status);

CREATE TABLE public.multichannel_rule_targets(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rule_id UUID NOT NULL REFERENCES public.multichannel_rules(id) ON DELETE CASCADE,
 target_type TEXT NOT NULL CHECK(target_type IN('tv','playlist','social','campaign_tvs','collaborative_network')),
 target_key TEXT NOT NULL,
 target_provider TEXT CHECK(target_provider IN('instagram','facebook','tiktok')),
 target_social_channel_id UUID REFERENCES public.social_channels(id) ON DELETE RESTRICT,
 target_screen_id UUID REFERENCES public.screens(id) ON DELETE RESTRICT,
 target_playlist_id UUID REFERENCES public.playlists(id) ON DELETE RESTRICT,
 target_format TEXT NOT NULL DEFAULT 'feed',
 mode_override TEXT CHECK(mode_override IS NULL OR mode_override IN('off','approval','automatic')),
 requires_canonical_asset BOOLEAN NOT NULL DEFAULT true,
 residential_allowed BOOLEAN NOT NULL DEFAULT false CHECK(residential_allowed=false),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','paused','archived')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(rule_id,target_key),
 CHECK((target_type='social' AND target_social_channel_id IS NOT NULL AND target_provider IS NOT NULL) OR
       (target_type='tv' AND target_screen_id IS NOT NULL) OR
       (target_type='playlist' AND target_playlist_id IS NOT NULL) OR
       target_type IN('campaign_tvs','collaborative_network'))
);

CREATE TABLE public.propagation_events(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), propagation_id UUID NOT NULL DEFAULT gen_random_uuid(),
 root_event_id UUID REFERENCES public.propagation_events(id) ON DELETE RESTRICT,
 rule_id UUID REFERENCES public.multichannel_rules(id) ON DELETE SET NULL,
 owner_type TEXT NOT NULL CHECK(owner_type IN('company','creator')), owner_id UUID NOT NULL,
 campaign_id UUID REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE RESTRICT,
 source_social_publication_id UUID REFERENCES public.social_publications(id) ON DELETE RESTRICT,
 source_kind TEXT NOT NULL CHECK(source_kind IN('mpm','tv','social')),
 source_provider TEXT CHECK(source_provider IN('instagram','facebook','tiktok','mpm','tv')),
 source_channel_id UUID REFERENCES public.social_channels(id) ON DELETE RESTRICT,
 source_external_post_id TEXT,
 detection_mode TEXT NOT NULL CHECK(detection_mode IN('realtime','polling','manual','unavailable')),
 asset_hash TEXT, content_hash TEXT NOT NULL,
 visited_destinations TEXT[] NOT NULL DEFAULT '{}', depth SMALLINT NOT NULL DEFAULT 0 CHECK(depth BETWEEN 0 AND 10),
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), idempotency_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'detected' CHECK(status IN('detected','planned','partial','completed','requires_attention','blocked_loop','blocked_depth')),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_propagation_events_owner ON public.propagation_events(owner_type,owner_id,created_at DESC);
CREATE INDEX idx_propagation_events_content_window ON public.propagation_events(content_hash,occurred_at DESC);

CREATE TABLE public.propagation_targets(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES public.propagation_events(id) ON DELETE CASCADE,
 rule_id UUID NOT NULL REFERENCES public.multichannel_rules(id) ON DELETE RESTRICT,
 rule_target_id UUID NOT NULL REFERENCES public.multichannel_rule_targets(id) ON DELETE RESTRICT,
 propagation_id UUID NOT NULL, parent_target_id UUID REFERENCES public.propagation_targets(id) ON DELETE RESTRICT,
 owner_type TEXT NOT NULL CHECK(owner_type IN('company','creator')), owner_id UUID NOT NULL,
 target_key TEXT NOT NULL, target_type TEXT NOT NULL,
 target_provider TEXT, target_social_channel_id UUID REFERENCES public.social_channels(id) ON DELETE RESTRICT,
 target_screen_id UUID REFERENCES public.screens(id) ON DELETE RESTRICT,
 target_playlist_id UUID REFERENCES public.playlists(id) ON DELETE RESTRICT,
 rule_version INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN('awaiting_approval','queued','manual','published','display_scheduled','succeeded','requires_attention','failed','dead_letter','blocked_loop','blocked_depth','blocked_frequency','blocked_capability','cancelled','ignored')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0), max_attempts INTEGER NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 20),
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(), error_category TEXT, error_message TEXT,
 social_publication_id UUID REFERENCES public.social_publications(id) ON DELETE RESTRICT,
 playlist_item_id UUID REFERENCES public.playlist_items(id) ON DELETE RESTRICT,
 economic_event_created BOOLEAN NOT NULL DEFAULT false CHECK(economic_event_created=false),
 idempotency_key TEXT NOT NULL UNIQUE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(event_id,rule_target_id,rule_version)
);
CREATE INDEX idx_propagation_targets_queue ON public.propagation_targets(status,available_at);
CREATE INDEX idx_propagation_targets_owner ON public.propagation_targets(owner_type,owner_id,created_at DESC);

CREATE TABLE public.multichannel_approval_tasks(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), target_id UUID NOT NULL UNIQUE REFERENCES public.propagation_targets(id) ON DELETE CASCADE,
 owner_type TEXT NOT NULL CHECK(owner_type IN('company','creator')), owner_id UUID NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','expired','ignored')),
 expires_at TIMESTAMPTZ NOT NULL, decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, decided_at TIMESTAMPTZ,
 decision_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_multichannel_approval_owner ON public.multichannel_approval_tasks(owner_type,owner_id,status,expires_at);

CREATE TABLE public.multichannel_asset_variants(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_type TEXT NOT NULL CHECK(owner_type IN('company','creator')), owner_id UUID NOT NULL,
 source_media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE RESTRICT,
 output_media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE RESTRICT,
 target_format TEXT NOT NULL, target_orientation TEXT NOT NULL CHECK(target_orientation IN('horizontal','vertical','square')),
 transform_strategy TEXT NOT NULL DEFAULT 'manual' CHECK(transform_strategy IN('contain','blur_background','side_bands','manual')),
 crop_approved BOOLEAN NOT NULL DEFAULT false,
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN('planned','ready','manual_required','failed')),
 source_hash TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(source_media_asset_id,target_format,transform_strategy)
);

CREATE OR REPLACE FUNCTION public.multichannel_effective_mode(p_rule public.multichannel_rules,p_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_rule.status<>'active' OR p_rule.mode='off' THEN 'off'
  WHEN p_rule.mode='automatic_temporary' AND (p_at<p_rule.starts_at OR p_at>=p_rule.ends_at) THEN p_rule.fallback_mode
  WHEN p_rule.mode='automatic_temporary' THEN 'automatic' ELSE p_rule.mode END
$$;

CREATE OR REPLACE FUNCTION public.validate_multichannel_rule_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_type TEXT; v_owner UUID; v_company UUID; v_venue TEXT;
BEGIN
 IF NEW.source_social_channel_id IS NOT NULL THEN
  SELECT owner_type,owner_id INTO v_type,v_owner FROM public.social_channels WHERE id=NEW.source_social_channel_id;
  IF v_owner IS NULL OR v_type<>NEW.owner_type OR v_owner<>NEW.owner_id THEN RAISE EXCEPTION 'Canal de origem não pertence ao owner.'; END IF;
 END IF;
 IF NEW.source_screen_id IS NOT NULL THEN
  SELECT company_id,venue_type INTO v_company,v_venue FROM public.screens WHERE id=NEW.source_screen_id;
  IF NEW.owner_type<>'company' OR v_company<>NEW.owner_id THEN RAISE EXCEPTION 'TV de origem não pertence à empresa.'; END IF;
 END IF;
 IF NEW.campaign_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=NEW.campaign_id AND c.company_id=NEW.owner_id) THEN
  RAISE EXCEPTION 'Campanha não pertence ao owner.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_multichannel_rule_owner BEFORE INSERT OR UPDATE ON public.multichannel_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_multichannel_rule_owner();

CREATE OR REPLACE FUNCTION public.validate_multichannel_target_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.multichannel_rules%ROWTYPE; v_type TEXT; v_owner UUID; v_company UUID; v_venue TEXT;
BEGIN
 SELECT * INTO r FROM public.multichannel_rules WHERE id=NEW.rule_id;
 IF NEW.target_social_channel_id IS NOT NULL THEN
  SELECT owner_type,owner_id INTO v_type,v_owner FROM public.social_channels WHERE id=NEW.target_social_channel_id;
  IF v_owner IS NULL OR v_type<>r.owner_type OR v_owner<>r.owner_id THEN RAISE EXCEPTION 'Canal de destino não pertence ao owner.'; END IF;
 END IF;
 IF NEW.target_screen_id IS NOT NULL THEN
  SELECT company_id,venue_type INTO v_company,v_venue FROM public.screens WHERE id=NEW.target_screen_id;
  IF r.owner_type<>'company' OR v_company<>r.owner_id OR v_venue='residential' THEN RAISE EXCEPTION 'TV de destino inválida ou residencial.'; END IF;
 END IF;
 IF NEW.target_playlist_id IS NOT NULL THEN
  SELECT company_id INTO v_company FROM public.playlists WHERE id=NEW.target_playlist_id;
  IF r.owner_type<>'company' OR v_company<>r.owner_id THEN RAISE EXCEPTION 'Playlist de destino não pertence à empresa.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_multichannel_target_owner BEFORE INSERT OR UPDATE ON public.multichannel_rule_targets
FOR EACH ROW EXECUTE FUNCTION public.validate_multichannel_target_owner();

CREATE OR REPLACE FUNCTION public.create_multichannel_rule(p_owner_type TEXT,p_owner_id UUID,p_name TEXT,p_source_kind TEXT,
 p_source_social_channel_id UUID,p_source_screen_id UUID,p_campaign_id UUID,p_eligibility_mode TEXT,p_required_hashtag TEXT,
 p_mode TEXT,p_starts_at TIMESTAMPTZ,p_ends_at TIMESTAMPTZ,p_fallback_mode TEXT,p_timezone TEXT,p_filters JSONB,p_targets JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id UUID; item JSONB; v_target_type TEXT; v_target_key TEXT;
BEGIN
 IF NOT public.mpm_can_manage_holder(p_owner_type,p_owner_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF jsonb_typeof(COALESCE(p_targets,'[]'))<>'array' OR jsonb_array_length(COALESCE(p_targets,'[]'))=0 THEN RAISE EXCEPTION 'Selecione ao menos um destino.'; END IF;
 INSERT INTO public.multichannel_rules(owner_type,owner_id,name,source_kind,source_social_channel_id,source_screen_id,campaign_id,
  eligibility_mode,required_hashtag,mode,starts_at,ends_at,fallback_mode,timezone,filters,created_by)
 VALUES(p_owner_type,p_owner_id,p_name,p_source_kind,p_source_social_channel_id,p_source_screen_id,p_campaign_id,
  COALESCE(p_eligibility_mode,'campaigns_mpm'),p_required_hashtag,COALESCE(p_mode,'approval'),p_starts_at,p_ends_at,
  COALESCE(p_fallback_mode,'approval'),COALESCE(NULLIF(p_timezone,''),'America/Cuiaba'),COALESCE(p_filters,'{}'),auth.uid()) RETURNING id INTO v_id;
 FOR item IN SELECT value FROM jsonb_array_elements(p_targets) LOOP
  v_target_type:=item->>'target_type'; v_target_key:=item->>'target_key';
  INSERT INTO public.multichannel_rule_targets(rule_id,target_type,target_key,target_provider,target_social_channel_id,target_screen_id,target_playlist_id,
   target_format,mode_override,requires_canonical_asset)
  VALUES(v_id,v_target_type,v_target_key,NULLIF(item->>'target_provider',''),NULLIF(item->>'target_social_channel_id','')::uuid,
   NULLIF(item->>'target_screen_id','')::uuid,NULLIF(item->>'target_playlist_id','')::uuid,COALESCE(NULLIF(item->>'target_format',''),'feed'),
   NULLIF(item->>'mode_override',''),COALESCE((item->>'requires_canonical_asset')::boolean,true));
 END LOOP;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.register_propagation_event(p_rule_id UUID,p_campaign_id UUID,p_media_asset_id UUID,
 p_source_social_publication_id UUID,p_source_external_post_id TEXT,p_detection_mode TEXT,p_content_hash TEXT,p_asset_hash TEXT,
 p_parent_event_id UUID,p_visited_destinations TEXT[],p_depth INTEGER,p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.multichannel_rules%ROWTYPE; e public.propagation_events%ROWTYPE; t public.multichannel_rule_targets%ROWTYPE;
 v_mode TEXT; v_status TEXT; v_count INTEGER; v_capable BOOLEAN; v_connection_ok BOOLEAN; v_source_provider TEXT; v_detection_mode TEXT;
BEGIN
 SELECT * INTO r FROM public.multichannel_rules WHERE id=p_rule_id;
 IF r.id IS NULL OR NOT public.mpm_can_manage_holder(r.owner_type,r.owner_id) THEN RAISE EXCEPTION 'Regra inexistente ou acesso negado.'; END IF;
 IF NOT public.mpm_feature_enabled('multichannel_replication_enabled') THEN RAISE EXCEPTION 'Replicação multicanal desabilitada.'; END IF;
 IF NULLIF(trim(p_content_hash),'') IS NULL OR NULLIF(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Hashes e idempotência são obrigatórios.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('propagation:'||p_idempotency_key,0));
 SELECT * INTO e FROM public.propagation_events WHERE idempotency_key=p_idempotency_key;
 IF e.id IS NOT NULL THEN RETURN jsonb_build_object('event_id',e.id,'deduplicated',true); END IF;
 IF p_depth>r.max_depth THEN v_status:='blocked_depth'; ELSE v_status:='detected'; END IF;
 v_source_provider:=CASE r.source_kind WHEN 'mpm' THEN 'mpm' WHEN 'tv' THEN 'tv' ELSE (SELECT provider FROM public.social_channels WHERE id=r.source_social_channel_id) END;
 SELECT detection_mode INTO v_detection_mode FROM public.multichannel_provider_capabilities WHERE provider=v_source_provider;
 IF v_detection_mode IS NULL THEN v_detection_mode:='unavailable'; END IF;
 INSERT INTO public.propagation_events(rule_id,root_event_id,owner_type,owner_id,campaign_id,media_asset_id,source_social_publication_id,
  source_kind,source_provider,source_channel_id,source_external_post_id,detection_mode,asset_hash,content_hash,visited_destinations,depth,idempotency_key,status)
 VALUES(r.id,p_parent_event_id,r.owner_type,r.owner_id,COALESCE(p_campaign_id,r.campaign_id),p_media_asset_id,p_source_social_publication_id,
  r.source_kind,v_source_provider,r.source_social_channel_id,p_source_external_post_id,v_detection_mode,p_asset_hash,p_content_hash,COALESCE(p_visited_destinations,'{}'),p_depth,p_idempotency_key,v_status)
 RETURNING * INTO e;
 IF v_status='blocked_depth' THEN RETURN jsonb_build_object('event_id',e.id,'status',v_status); END IF;
 v_mode:=public.multichannel_effective_mode(r,now());
 FOR t IN SELECT * FROM public.multichannel_rule_targets WHERE rule_id=r.id AND status='active' LOOP
  v_status:=COALESCE(t.mode_override,v_mode);
  IF t.target_key=ANY(COALESCE(p_visited_destinations,'{}')) THEN v_status:='blocked_loop';
  ELSIF v_status='off' THEN v_status:='ignored';
  ELSIF r.frequency_cap_count IS NOT NULL THEN
   SELECT count(*) INTO v_count FROM public.propagation_targets pt WHERE pt.rule_target_id=t.id AND pt.created_at>=now()-(r.frequency_cap_window_hours||' hours')::interval AND pt.status IN('queued','published','display_scheduled','succeeded');
   IF v_count>=r.frequency_cap_count THEN v_status:='blocked_frequency'; END IF;
  END IF;
  IF v_status='automatic' AND t.target_type='social' THEN
   SELECT ch.direct_post_capable AND ch.status='active' AND sc.status='active' AND (sc.expires_at IS NULL OR sc.expires_at>now())
    INTO v_connection_ok FROM public.social_channels ch JOIN public.social_connections sc ON sc.id=ch.connection_id WHERE ch.id=t.target_social_channel_id;
   SELECT automatic_publish_capable INTO v_capable FROM public.multichannel_provider_capabilities WHERE provider=t.target_provider;
   IF NOT public.mpm_feature_enabled('multichannel_auto_mode_enabled') OR NOT public.mpm_feature_enabled('social_crosspost_enabled') OR
      NOT COALESCE(v_connection_ok,false) OR NOT COALESCE(v_capable,false) THEN v_status:=CASE WHEN t.target_provider='tiktok' THEN 'manual' ELSE 'awaiting_approval' END; ELSE v_status:='queued'; END IF;
  ELSIF v_status='automatic' AND t.target_type IN('tv','playlist') THEN
   IF r.source_kind='social' AND (NOT public.mpm_feature_enabled('social_to_tv_replication_enabled') OR p_media_asset_id IS NULL) THEN v_status:='awaiting_approval';
   ELSE v_status:='queued'; END IF;
  ELSIF v_status='automatic' AND t.target_type IN('campaign_tvs','collaborative_network') THEN v_status:='awaiting_approval';
  ELSIF v_status='approval' THEN v_status:='awaiting_approval'; END IF;
  INSERT INTO public.propagation_targets(event_id,rule_id,rule_target_id,propagation_id,owner_type,owner_id,target_key,target_type,target_provider,
   target_social_channel_id,target_screen_id,target_playlist_id,rule_version,status,idempotency_key)
  VALUES(e.id,r.id,t.id,e.propagation_id,r.owner_type,r.owner_id,t.target_key,t.target_type,t.target_provider,t.target_social_channel_id,t.target_screen_id,t.target_playlist_id,
   r.version,v_status,p_idempotency_key||':'||t.target_key||':v'||r.version)
  ON CONFLICT(idempotency_key) DO NOTHING;
 END LOOP;
 INSERT INTO public.multichannel_approval_tasks(target_id,owner_type,owner_id,expires_at)
 SELECT pt.id,pt.owner_type,pt.owner_id,now()+(r.approval_expiry_minutes||' minutes')::interval FROM public.propagation_targets pt
 WHERE pt.event_id=e.id AND pt.status='awaiting_approval' ON CONFLICT(target_id) DO NOTHING;
 UPDATE public.propagation_events SET status='planned',updated_at=now() WHERE id=e.id;
 RETURN jsonb_build_object('event_id',e.id,'propagation_id',e.propagation_id,'deduplicated',false);
END $$;

CREATE OR REPLACE FUNCTION public.decide_multichannel_approval(p_task_id UUID,p_approve BOOLEAN,p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.multichannel_approval_tasks%ROWTYPE; t public.propagation_targets%ROWTYPE; e public.propagation_events%ROWTYPE; rt public.multichannel_rule_targets%ROWTYPE;
 v_playlist UUID; v_item UUID; v_pub UUID; v_duration INTEGER;
BEGIN
 SELECT * INTO a FROM public.multichannel_approval_tasks WHERE id=p_task_id FOR UPDATE;
 IF a.id IS NULL OR a.status<>'pending' OR NOT public.mpm_can_manage_holder(a.owner_type,a.owner_id) THEN RAISE EXCEPTION 'Aprovação indisponível.'; END IF;
 IF a.expires_at<=now() THEN UPDATE public.multichannel_approval_tasks SET status='expired',updated_at=now() WHERE id=a.id; RAISE EXCEPTION 'Aprovação expirada.'; END IF;
 SELECT * INTO t FROM public.propagation_targets WHERE id=a.target_id FOR UPDATE;
 SELECT * INTO e FROM public.propagation_events WHERE id=t.event_id;
 SELECT * INTO rt FROM public.multichannel_rule_targets WHERE id=t.rule_target_id;
 IF NOT p_approve THEN
  UPDATE public.multichannel_approval_tasks SET status='rejected',decided_by=auth.uid(),decided_at=now(),decision_note=p_note,updated_at=now() WHERE id=a.id;
  UPDATE public.propagation_targets SET status='cancelled',updated_at=now() WHERE id=t.id;
  RETURN jsonb_build_object('target_id',t.id,'status','cancelled');
 END IF;
 IF t.target_type='social' THEN
  IF t.target_provider='tiktok' OR NOT EXISTS(SELECT 1 FROM public.social_channels WHERE id=t.target_social_channel_id AND direct_post_capable AND status='active') THEN
   UPDATE public.propagation_targets SET status='manual',updated_at=now() WHERE id=t.id;
  ELSE
   INSERT INTO public.social_publications(channel_id,campaign_id,media_asset_id,status,scheduled_at,idempotency_key,publication_mode,metadata)
   VALUES(t.target_social_channel_id,e.campaign_id,e.media_asset_id,'scheduled',now(),t.idempotency_key,'approval',jsonb_build_object('propagation_id',t.propagation_id,'source_event_id',e.id))
   ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_pub;
   IF v_pub IS NULL THEN SELECT id INTO v_pub FROM public.social_publications WHERE idempotency_key=t.idempotency_key; END IF;
   UPDATE public.propagation_targets SET status='queued',social_publication_id=v_pub,updated_at=now() WHERE id=t.id;
  END IF;
 ELSIF t.target_type IN('tv','playlist') THEN
  IF e.media_asset_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.media_assets WHERE id=e.media_asset_id AND company_id=t.owner_id AND status='approved') THEN RAISE EXCEPTION 'Mídia canônica aprovada obrigatória para TV.'; END IF;
  IF t.target_type='playlist' THEN v_playlist:=t.target_playlist_id;
  ELSE SELECT sp.playlist_id INTO v_playlist FROM public.screen_playlists sp JOIN public.screens s ON s.id=sp.screen_id WHERE sp.screen_id=t.target_screen_id AND sp.is_active AND s.venue_type<>'residential'; END IF;
  IF v_playlist IS NULL THEN RAISE EXCEPTION 'TV sem playlist ativa elegível.'; END IF;
  SELECT playback_duration_seconds INTO v_duration FROM public.media_assets WHERE id=e.media_asset_id;
  INSERT INTO public.playlist_items(playlist_id,media_asset_id,sort_order,playback_duration_seconds,is_active)
  SELECT v_playlist,e.media_asset_id,COALESCE(max(sort_order),-1)+1,v_duration,true FROM public.playlist_items WHERE playlist_id=v_playlist
  RETURNING id INTO v_item;
  UPDATE public.propagation_targets SET status='display_scheduled',playlist_item_id=v_item,updated_at=now() WHERE id=t.id;
 ELSE
  UPDATE public.propagation_targets SET status='manual',metadata=metadata||'{"requires_v1_matching":true}'::jsonb,updated_at=now() WHERE id=t.id;
 END IF;
 UPDATE public.multichannel_approval_tasks SET status='approved',decided_by=auth.uid(),decided_at=now(),decision_note=p_note,updated_at=now() WHERE id=a.id;
 RETURN jsonb_build_object('target_id',t.id,'status',(SELECT status FROM public.propagation_targets WHERE id=t.id));
END $$;

CREATE OR REPLACE FUNCTION public.process_multichannel_scheduler(p_run_key TEXT DEFAULT to_char(now(),'YYYY-MM-DD-HH24:MI'))
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_expired INTEGER:=0; v_retry INTEGER:=0; v_dead INTEGER:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 UPDATE public.multichannel_approval_tasks SET status='expired',updated_at=now() WHERE status='pending' AND expires_at<=now(); GET DIAGNOSTICS v_expired=ROW_COUNT;
 UPDATE public.multichannel_rules SET mode=fallback_mode,version=version+1,
  filters=filters||jsonb_build_object('temporary_mode_ended_at',now()),updated_at=now()
 WHERE status='active' AND mode='automatic_temporary' AND ends_at<=now();
 UPDATE public.propagation_targets SET status='dead_letter',updated_at=now() WHERE status='failed' AND attempts>=max_attempts; GET DIAGNOSTICS v_dead=ROW_COUNT;
 UPDATE public.propagation_targets SET status='queued',available_at=now()+LEAST(3600,power(2,attempts)::int)*interval '1 second',updated_at=now()
 WHERE status='failed' AND attempts<max_attempts AND available_at<=now(); GET DIAGNOSTICS v_retry=ROW_COUNT;
 RETURN jsonb_build_object('run_key',p_run_key,'expired_approvals',v_expired,'requeued',v_retry,'dead_lettered',v_dead,
  'replication_enabled',public.mpm_feature_enabled('multichannel_replication_enabled'));
END $$;

ALTER TABLE public.multichannel_provider_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multichannel_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multichannel_rule_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propagation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propagation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multichannel_approval_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multichannel_asset_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Capabilities authenticated read" ON public.multichannel_provider_capabilities FOR SELECT TO authenticated USING(true);
CREATE POLICY "Multichannel rules owner read" ON public.multichannel_rules FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(owner_type,owner_id));
CREATE POLICY "Multichannel targets owner read" ON public.multichannel_rule_targets FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.multichannel_rules r WHERE r.id=rule_id AND public.mpm_can_manage_holder(r.owner_type,r.owner_id)));
CREATE POLICY "Propagation events owner read" ON public.propagation_events FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(owner_type,owner_id));
CREATE POLICY "Propagation targets owner read" ON public.propagation_targets FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(owner_type,owner_id));
CREATE POLICY "Approval tasks owner read" ON public.multichannel_approval_tasks FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(owner_type,owner_id));
CREATE POLICY "Asset variants owner read" ON public.multichannel_asset_variants FOR SELECT TO authenticated USING(public.mpm_can_manage_holder(owner_type,owner_id));

REVOKE ALL ON public.multichannel_provider_capabilities,public.multichannel_rules,public.multichannel_rule_targets,public.propagation_events,
 public.propagation_targets,public.multichannel_approval_tasks,public.multichannel_asset_variants FROM PUBLIC,anon;
GRANT SELECT ON public.multichannel_provider_capabilities,public.multichannel_rules,public.multichannel_rule_targets,public.propagation_events,
 public.propagation_targets,public.multichannel_approval_tasks,public.multichannel_asset_variants TO authenticated;
REVOKE ALL ON FUNCTION public.create_multichannel_rule(TEXT,UUID,TEXT,TEXT,UUID,UUID,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,JSONB,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.register_propagation_event(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT[],INTEGER,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.decide_multichannel_approval(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.process_multichannel_scheduler(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_multichannel_rule(TEXT,UUID,TEXT,TEXT,UUID,UUID,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,JSONB,JSONB) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_propagation_event(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT[],INTEGER,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.decide_multichannel_approval(UUID,BOOLEAN,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.process_multichannel_scheduler(TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
