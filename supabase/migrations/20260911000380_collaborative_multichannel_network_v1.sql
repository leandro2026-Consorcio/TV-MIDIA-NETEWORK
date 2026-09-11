-- Rede Colaborativa Multicanal V1
-- Camada aditiva: reutiliza campanhas, mídia, playlists, inventário, Social Foundation,
-- wallet_ledger, wallet_reservations, delivery_proofs e Creator Score existentes.

INSERT INTO public.platform_settings(key,value,description) VALUES
 ('collaborative_media_network_enabled','false'::jsonb,'Rollout da Rede Colaborativa Multicanal.'),
 ('collaborative_creator_offers_enabled','false'::jsonb,'Ofertas abertas e direcionadas para Creators.'),
 ('collaborative_business_channels_enabled','false'::jsonb,'Participação opt-in de canais empresariais.'),
 ('collaborative_campaign_rewards_enabled','false'::jsonb,'Reservas e recompensas auditáveis por entrega validada.')
ON CONFLICT(key) DO UPDATE SET description=excluded.description;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read" ON public.platform_settings FOR SELECT TO anon,authenticated USING(key IN(
 'public_trial_signup_enabled','public_trial_days','trial_invites_count','auto_approve_trial_internal_media','public_signup_disabled_message',
 'plan_price_monthly_cents','plan_price_annual_cents','media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2',
 'inventory_preferred_limit','inventory_growth_enabled','inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2','partner_programs_v2',
 'social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2','inventory_growth_monthly_limit','mpm_default_unit_price',
 'expansion_program_v1','expansion_public_base_url','social_auto_publish_master_enabled',
 'social_connection_enabled','social_manual_publish_enabled','social_approval_publish_enabled','social_metrics_enabled',
 'tiktok_connection_enabled','tiktok_display_enabled','tiktok_upload_enabled','tiktok_direct_post_enabled',
 'collaborative_media_network_enabled','collaborative_creator_offers_enabled',
 'collaborative_business_channels_enabled','collaborative_campaign_rewards_enabled'
));

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_campaign_type_check
 CHECK(campaign_type IN('internal','paid','exchange','external','marketplace','commercial','collaborative'));
ALTER TABLE public.campaigns
 ADD COLUMN IF NOT EXISTS reward_mode TEXT CHECK(reward_mode IN('mpm_credits','media_rights')),
 ADD COLUMN IF NOT EXISTS budget_total NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(budget_total>=0),
 ADD COLUMN IF NOT EXISTS collaborative_tvs BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS collaborative_businesses BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS collaborative_creators BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS own_tvs BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS own_social BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS collaborative_idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_collaborative_idempotency
 ON public.campaigns(collaborative_idempotency_key) WHERE collaborative_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_campaign_integrity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date<NEW.start_date THEN
   RAISE EXCEPTION 'A data de término não pode ser anterior à data de início.';
 END IF;
 IF NEW.campaign_type NOT IN('internal','paid','exchange','external','marketplace','commercial','collaborative') THEN
   RAISE EXCEPTION 'Tipo de campanha inválido.';
 END IF;
 IF NEW.campaign_type='collaborative' AND NEW.reward_mode IS NULL AND
   (NEW.collaborative_tvs OR NEW.collaborative_businesses OR NEW.collaborative_creators) THEN
   RAISE EXCEPTION 'Campanha colaborativa externa exige modalidade de recompensa explícita.';
 END IF;
 RETURN NEW;
END $$;

ALTER TABLE public.campaign_media
 ADD COLUMN IF NOT EXISTS variant_name TEXT,
 ADD COLUMN IF NOT EXISTS distribution_format TEXT NOT NULL DEFAULT 'tv_16_9'
   CHECK(distribution_format IN('tv_16_9','story_9_16','reel_9_16','feed_1_1','feed_4_5','tiktok_9_16')),
 ADD COLUMN IF NOT EXISTS is_primary_variant BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE public.playlist_campaign_items(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
 campaign_media_id UUID REFERENCES public.campaign_media(id) ON DELETE SET NULL,
 position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0),
 starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
 recurrence JSONB NOT NULL DEFAULT '{"type":"once"}'::jsonb,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(playlist_id,campaign_id,campaign_media_id),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>=starts_at)
);

CREATE TABLE public.campaign_distribution_rules(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
 destination_type TEXT NOT NULL CHECK(destination_type IN('own_tv','own_social','collaborative_tv','business_social','creator_social')),
 provider TEXT CHECK(provider IN('instagram','facebook','tiktok')),
 social_channel_id UUID REFERENCES public.social_channels(id) ON DELETE RESTRICT,
 format TEXT NOT NULL CHECK(format IN('tv','story','feed','reel','carousel','tiktok_video')),
 publication_mode TEXT NOT NULL DEFAULT 'manual' CHECK(publication_mode IN('manual','approval','automatic')),
 recurrence_type TEXT NOT NULL DEFAULT 'once' CHECK(recurrence_type IN('once','daily','weekly','specific_days','custom_period')),
 recurrence_config JSONB NOT NULL DEFAULT '{}'::jsonb,
 reuse_policy TEXT NOT NULL DEFAULT 'reuse' CHECK(reuse_policy IN('reuse','rotate','alternate')),
 budget_limit NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(budget_limit>=0),
 reward_per_validated_delivery NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(reward_per_validated_delivery>=0),
 max_deliveries INTEGER CHECK(max_deliveries IS NULL OR max_deliveries>0),
 starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','paused','completed','cancelled')),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>=starts_at),
 CHECK(provider IS NOT NULL OR destination_type IN('own_tv','collaborative_tv'))
);
CREATE INDEX idx_campaign_distribution_campaign ON public.campaign_distribution_rules(campaign_id,status);

CREATE TABLE public.collaborative_channel_settings(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 social_channel_id UUID NOT NULL UNIQUE REFERENCES public.social_channels(id) ON DELETE CASCADE,
 owner_type TEXT NOT NULL CHECK(owner_type IN('company','creator')),
 owner_id UUID NOT NULL,
 participation_enabled BOOLEAN NOT NULL DEFAULT false,
 approval_mode TEXT NOT NULL DEFAULT 'manual' CHECK(approval_mode IN('manual','approval','automatic')),
 region JSONB NOT NULL DEFAULT '{}'::jsonb,
 allowed_categories UUID[] NOT NULL DEFAULT '{}',
 blocked_categories UUID[] NOT NULL DEFAULT '{}',
 blocked_companies UUID[] NOT NULL DEFAULT '{}',
 allowed_periods JSONB NOT NULL DEFAULT '{}'::jsonb,
 minimum_reward NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(minimum_reward>=0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','paused','archived')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.collaborative_inventory(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 channel_setting_id UUID NOT NULL REFERENCES public.collaborative_channel_settings(id) ON DELETE CASCADE,
 social_channel_id UUID NOT NULL REFERENCES public.social_channels(id) ON DELETE CASCADE,
 provider TEXT NOT NULL CHECK(provider IN('instagram','facebook','tiktok')),
 format TEXT NOT NULL CHECK(format IN('story','feed','reel','carousel','tiktok_video')),
 quantity_limit INTEGER NOT NULL CHECK(quantity_limit>=0),
 period_type TEXT NOT NULL DEFAULT 'monthly' CHECK(period_type IN('daily','weekly','monthly','custom')),
 period_start DATE NOT NULL DEFAULT date_trunc('month',CURRENT_DATE)::date,
 period_end DATE NOT NULL DEFAULT (date_trunc('month',CURRENT_DATE)+INTERVAL '1 month - 1 day')::date,
 reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(reserved_quantity>=0),
 consumed_quantity INTEGER NOT NULL DEFAULT 0 CHECK(consumed_quantity>=0),
 minimum_reward NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(minimum_reward>=0),
 capability TEXT NOT NULL DEFAULT 'manual' CHECK(capability IN('manual','approval','automatic')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','paused','sold_out','archived')),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(social_channel_id,format,period_type,period_start),
 CHECK(reserved_quantity+consumed_quantity<=quantity_limit),
 CHECK(period_end>=period_start)
);
CREATE INDEX idx_collaborative_inventory_match ON public.collaborative_inventory(provider,format,status);

CREATE TABLE public.campaign_offers(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 distribution_rule_id UUID NOT NULL REFERENCES public.campaign_distribution_rules(id) ON DELETE RESTRICT,
 inventory_id UUID REFERENCES public.collaborative_inventory(id) ON DELETE RESTRICT,
 offer_type TEXT NOT NULL CHECK(offer_type IN('open','directed')),
 participant_type TEXT CHECK(participant_type IN('creator','company')),
 participant_id UUID,
 format TEXT NOT NULL CHECK(format IN('story','feed','reel','carousel','tiktok_video','tv')),
 region JSONB NOT NULL DEFAULT '{}'::jsonb,
 total_slots INTEGER NOT NULL CHECK(total_slots>0),
 slots_per_participant INTEGER NOT NULL DEFAULT 1 CHECK(slots_per_participant>0),
 daily_limit INTEGER CHECK(daily_limit IS NULL OR daily_limit>0),
 accepted_slots INTEGER NOT NULL DEFAULT 0 CHECK(accepted_slots>=0),
 reward_amount NUMERIC(18,4) NOT NULL CHECK(reward_amount>0),
 reward_mode TEXT NOT NULL CHECK(reward_mode IN('mpm_credits','media_rights')),
 status TEXT NOT NULL DEFAULT 'offered' CHECK(status IN('draft','offered','closed','expired','cancelled','completed')),
 expires_at TIMESTAMPTZ,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(accepted_slots<=total_slots),
 CHECK((offer_type='open' AND participant_id IS NULL) OR (offer_type='directed' AND participant_type IS NOT NULL AND participant_id IS NOT NULL))
);
CREATE INDEX idx_campaign_offers_marketplace ON public.campaign_offers(status,participant_type,expires_at);

CREATE TABLE public.offer_acceptances(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 offer_id UUID NOT NULL REFERENCES public.campaign_offers(id) ON DELETE RESTRICT,
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 participant_type TEXT NOT NULL CHECK(participant_type IN('creator','company')),
 participant_id UUID NOT NULL,
 social_channel_id UUID REFERENCES public.social_channels(id) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0),
 reward_amount NUMERIC(18,4) NOT NULL CHECK(reward_amount>0),
 status TEXT NOT NULL DEFAULT 'accepted' CHECK(status IN('accepted','awaiting_approval','approved','scheduled','published','validation_pending','validated','finalized','rejected','failed','cancelled')),
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 idempotency_key TEXT NOT NULL UNIQUE,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE(offer_id,participant_type,participant_id)
);

CREATE TABLE public.media_right_accounts(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 holder_type TEXT NOT NULL CHECK(holder_type IN('company','creator')),
 holder_id UUID NOT NULL,
 available_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(available_balance>=0),
 reserved_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(reserved_balance>=0),
 consumed_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(consumed_balance>=0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(holder_type,holder_id)
);
CREATE TABLE public.media_right_ledger(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id UUID NOT NULL REFERENCES public.media_right_accounts(id) ON DELETE RESTRICT,
 campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
 entry_type TEXT NOT NULL CHECK(entry_type IN('grant','reserve','release','consume','reward','expire','reversal','adjustment')),
 amount NUMERIC(18,4) NOT NULL CHECK(amount>0),
 available_delta NUMERIC(18,4) NOT NULL,
 reserved_delta NUMERIC(18,4) NOT NULL,
 available_after NUMERIC(18,4) NOT NULL CHECK(available_after>=0),
 reserved_after NUMERIC(18,4) NOT NULL CHECK(reserved_after>=0),
 source_type TEXT NOT NULL, source_id UUID,
 reverses_entry_id UUID UNIQUE REFERENCES public.media_right_ledger(id) ON DELETE RESTRICT,
 expires_at TIMESTAMPTZ,
 idempotency_key TEXT NOT NULL UNIQUE,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_budget_reservations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 acceptance_id UUID NOT NULL UNIQUE REFERENCES public.offer_acceptances(id) ON DELETE RESTRICT,
 distribution_rule_id UUID NOT NULL REFERENCES public.campaign_distribution_rules(id) ON DELETE RESTRICT,
 reward_mode TEXT NOT NULL CHECK(reward_mode IN('mpm_credits','media_rights')),
 amount NUMERIC(18,4) NOT NULL CHECK(amount>0),
 wallet_reservation_id UUID REFERENCES public.wallet_reservations(id) ON DELETE RESTRICT,
 media_right_account_id UUID REFERENCES public.media_right_accounts(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','consumed','released','reversed')),
 idempotency_key TEXT NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((reward_mode='mpm_credits' AND wallet_reservation_id IS NOT NULL AND media_right_account_id IS NULL) OR
       (reward_mode='media_rights' AND wallet_reservation_id IS NULL AND media_right_account_id IS NOT NULL))
);

CREATE TABLE public.collaborative_settlements(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 acceptance_id UUID NOT NULL REFERENCES public.offer_acceptances(id) ON DELETE RESTRICT,
 reservation_id UUID NOT NULL REFERENCES public.campaign_budget_reservations(id) ON DELETE RESTRICT,
 delivery_proof_id UUID REFERENCES public.delivery_proofs(id) ON DELETE RESTRICT,
 social_publication_id UUID REFERENCES public.social_publications(id) ON DELETE RESTRICT,
 participant_type TEXT NOT NULL CHECK(participant_type IN('creator','company')),
 participant_id UUID NOT NULL,
 reward_mode TEXT NOT NULL CHECK(reward_mode IN('mpm_credits','media_rights')),
 gross_amount NUMERIC(18,4) NOT NULL CHECK(gross_amount>0),
 fee_amount NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(fee_amount>=0),
 net_amount NUMERIC(18,4) NOT NULL CHECK(net_amount>=0),
 fee_rule_id UUID REFERENCES public.platform_fee_rules(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'finalized' CHECK(status IN('pending','finalized','reversed','disputed')),
 idempotency_key TEXT NOT NULL UNIQUE,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), reversed_at TIMESTAMPTZ,
 CHECK(gross_amount=fee_amount+net_amount)
);
CREATE UNIQUE INDEX uq_collab_settlement_acceptance_final ON public.collaborative_settlements(acceptance_id) WHERE status<>'reversed';

CREATE TABLE public.business_media_score_rules(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version INTEGER NOT NULL UNIQUE,
 weights JSONB NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT true,
 effective_from TIMESTAMPTZ NOT NULL DEFAULT now(), effective_to TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(effective_to IS NULL OR effective_to>effective_from)
);
INSERT INTO public.business_media_score_rules(version,weights) VALUES(1,
 '{"recent_reach":0.25,"local_audience":0.20,"engagement":0.15,"consistency":0.10,"mpm_history":0.10,"reliability":0.10,"category_affinity":0.05,"historical_conversion":0.05}'::jsonb)
ON CONFLICT(version) DO NOTHING;
CREATE TABLE public.business_media_score_snapshots(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 social_channel_id UUID NOT NULL REFERENCES public.social_channels(id) ON DELETE RESTRICT,
 format TEXT, score NUMERIC(7,2) NOT NULL CHECK(score BETWEEN 0 AND 100),
 completeness TEXT NOT NULL DEFAULT 'partial' CHECK(completeness IN('complete','partial')),
 rule_id UUID NOT NULL REFERENCES public.business_media_score_rules(id) ON DELETE RESTRICT,
 components JSONB NOT NULL DEFAULT '{}'::jsonb, declared_components TEXT[] NOT NULL DEFAULT '{}',
 captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_score_channel ON public.business_media_score_snapshots(social_channel_id,captured_at DESC);

ALTER TABLE public.social_publications DROP CONSTRAINT IF EXISTS social_publications_status_check;
ALTER TABLE public.social_publications ADD CONSTRAINT social_publications_status_check CHECK(status IN(
 'draft','planned','offered','accepted','awaiting_approval','pending_approval','approved','scheduled','published','validation_pending','validated','finalized','rejected','failed','cancelled','reversed'
));
ALTER TABLE public.social_publications
 ADD COLUMN IF NOT EXISTS campaign_media_id UUID REFERENCES public.campaign_media(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS offer_acceptance_id UUID REFERENCES public.offer_acceptances(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS budget_reservation_id UUID REFERENCES public.campaign_budget_reservations(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS publication_mode TEXT NOT NULL DEFAULT 'manual' CHECK(publication_mode IN('manual','approval','automatic')),
 ADD COLUMN IF NOT EXISTS permalink TEXT,
 ADD COLUMN IF NOT EXISTS minimum_retention_until TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

-- Opt-in é explícito. Canal conectado nunca ativa a rede sozinho.
CREATE OR REPLACE FUNCTION public.sync_collaborative_channel_opt_in() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.social_channels SET participation_enabled=NEW.participation_enabled,
   publication_mode=NEW.approval_mode,updated_at=now() WHERE id=NEW.social_channel_id;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_collaborative_channel_opt_in AFTER INSERT OR UPDATE OF participation_enabled,approval_mode
ON public.collaborative_channel_settings FOR EACH ROW EXECUTE FUNCTION public.sync_collaborative_channel_opt_in();

CREATE OR REPLACE FUNCTION public.prevent_append_only_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'Ledger imutável; use lançamento de reversão.'; END $$;
CREATE TRIGGER trg_media_right_ledger_immutable BEFORE UPDATE OR DELETE ON public.media_right_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_mutation();

CREATE OR REPLACE FUNCTION public.create_collaborative_campaign(
 p_company_id UUID,p_name TEXT,p_description TEXT,p_start_date DATE,p_end_date DATE,p_reward_mode TEXT,
 p_budget_total NUMERIC,p_configuration JSONB,p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cid UUID; item JSONB; dtype TEXT; provider_name TEXT; mode_name TEXT;
BEGIN
 IF NOT public.mpm_can_manage_company(p_company_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF NULLIF(trim(p_name),'') IS NULL OR p_budget_total<0 OR p_reward_mode NOT IN('mpm_credits','media_rights') OR
    (p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date<p_start_date) OR
    NULLIF(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Configuração da campanha inválida.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('collaborative-campaign:'||p_idempotency_key,0));
 SELECT id INTO cid FROM public.campaigns WHERE collaborative_idempotency_key=p_idempotency_key;
 IF cid IS NOT NULL THEN RETURN cid; END IF;
 INSERT INTO public.campaigns(company_id,name,description,campaign_type,status,start_date,end_date,reward_mode,budget_total,
  own_tvs,own_social,collaborative_tvs,collaborative_businesses,collaborative_creators,created_by,collaborative_idempotency_key)
 VALUES(p_company_id,trim(p_name),NULLIF(trim(p_description),''),'collaborative','draft',p_start_date,p_end_date,p_reward_mode,p_budget_total,
  COALESCE((p_configuration->>'own_tvs')::boolean,false),COALESCE((p_configuration->>'own_social')::boolean,false),
  COALESCE((p_configuration->>'collaborative_tvs')::boolean,false),COALESCE((p_configuration->>'collaborative_businesses')::boolean,false),
  COALESCE((p_configuration->>'collaborative_creators')::boolean,false),auth.uid(),p_idempotency_key) RETURNING id INTO cid;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_configuration->'distributions','[]'::jsonb)) LOOP
  dtype:=item->>'destination_type'; provider_name:=NULLIF(item->>'provider',''); mode_name:=COALESCE(NULLIF(item->>'publication_mode',''),'manual');
  IF provider_name='tiktok' AND mode_name='automatic' THEN mode_name:='manual'; END IF;
  IF dtype IN('own_tv','own_social') AND COALESCE((item->>'reward_per_delivery')::numeric,0)<>0 THEN
    RAISE EXCEPTION 'Canal próprio não remunera a própria empresa.';
  END IF;
  INSERT INTO public.campaign_distribution_rules(campaign_id,destination_type,provider,social_channel_id,format,publication_mode,
   recurrence_type,recurrence_config,reuse_policy,budget_limit,reward_per_validated_delivery,max_deliveries,starts_at,ends_at,status,metadata)
  VALUES(cid,dtype,provider_name,NULLIF(item->>'social_channel_id','')::uuid,item->>'format',mode_name,
   COALESCE(NULLIF(item->>'recurrence_type',''),'once'),COALESCE(item->'recurrence_config','{}'::jsonb),
   COALESCE(NULLIF(item->>'reuse_policy',''),'reuse'),COALESCE((item->>'budget_limit')::numeric,0),
   COALESCE((item->>'reward_per_delivery')::numeric,0),NULLIF(item->>'max_deliveries','')::integer,
   p_start_date::timestamptz,(p_end_date+1)::timestamptz-interval '1 millisecond','draft',
   jsonb_build_object('created_from','multichannel_wizard'));
 END LOOP;
 RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public._post_media_right_entry(
 p_account_id UUID,p_campaign_id UUID,p_entry_type TEXT,p_amount NUMERIC,p_available_delta NUMERIC,p_reserved_delta NUMERIC,
 p_source_type TEXT,p_source_id UUID,p_idempotency_key TEXT,p_expires_at TIMESTAMPTZ DEFAULT NULL,p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.media_right_accounts%ROWTYPE; eid UUID;
BEGIN
 IF p_amount<=0 OR NULLIF(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Lançamento de Direito de Mídia inválido.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('media-right:'||p_idempotency_key,0));
 SELECT id INTO eid FROM public.media_right_ledger WHERE idempotency_key=p_idempotency_key;
 IF eid IS NOT NULL THEN RETURN eid; END IF;
 SELECT * INTO a FROM public.media_right_accounts WHERE id=p_account_id FOR UPDATE;
 IF a.id IS NULL OR a.available_balance+p_available_delta<0 OR a.reserved_balance+p_reserved_delta<0 THEN
   RAISE EXCEPTION 'Direito de Mídia insuficiente.';
 END IF;
 UPDATE public.media_right_accounts SET available_balance=available_balance+p_available_delta,
  reserved_balance=reserved_balance+p_reserved_delta,
  consumed_balance=consumed_balance+CASE WHEN p_entry_type='consume' THEN p_amount ELSE 0 END,updated_at=now()
 WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.media_right_ledger(account_id,campaign_id,entry_type,amount,available_delta,reserved_delta,available_after,reserved_after,
  source_type,source_id,expires_at,idempotency_key,metadata,created_by)
 VALUES(a.id,p_campaign_id,p_entry_type,p_amount,p_available_delta,p_reserved_delta,a.available_balance,a.reserved_balance,
  p_source_type,p_source_id,p_expires_at,p_idempotency_key,COALESCE(p_metadata,'{}'),auth.uid()) RETURNING id INTO eid;
 RETURN eid;
END $$;

CREATE OR REPLACE FUNCTION public.accept_campaign_offer(
 p_offer_id UUID,p_participant_type TEXT,p_participant_id UUID,p_social_channel_id UUID,p_quantity INTEGER,p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.campaign_offers%ROWTYPE; c public.campaigns%ROWTYPE; inv public.collaborative_inventory%ROWTYPE;
 aid UUID; rid UUID; wrid UUID; mrid UUID; total NUMERIC(18,4);
BEGIN
 IF p_quantity<=0 OR NOT public.mpm_can_manage_holder(p_participant_type,p_participant_id) THEN RAISE EXCEPTION 'Participante ou quantidade inválida.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('campaign-offer:'||p_offer_id::text,0));
 SELECT * INTO o FROM public.campaign_offers WHERE id=p_offer_id FOR UPDATE;
 IF o.id IS NULL OR o.status<>'offered' OR (o.expires_at IS NOT NULL AND o.expires_at<=now()) THEN RAISE EXCEPTION 'Oferta indisponível.'; END IF;
 IF o.offer_type='directed' AND (o.participant_type<>p_participant_type OR o.participant_id<>p_participant_id) THEN RAISE EXCEPTION 'Oferta direcionada a outro participante.'; END IF;
 IF p_quantity>o.slots_per_participant OR o.accepted_slots+p_quantity>o.total_slots THEN RAISE EXCEPTION 'Vagas insuficientes.'; END IF;
 IF p_social_channel_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.collaborative_channel_settings s
   WHERE s.social_channel_id=p_social_channel_id AND s.owner_type=p_participant_type AND s.owner_id=p_participant_id
     AND s.participation_enabled AND s.status='active') THEN RAISE EXCEPTION 'Canal não aderiu à Rede Colaborativa.'; END IF;
 IF o.inventory_id IS NOT NULL THEN
  SELECT * INTO inv FROM public.collaborative_inventory WHERE id=o.inventory_id FOR UPDATE;
  IF inv.id IS NULL OR inv.status<>'active' OR inv.reserved_quantity+inv.consumed_quantity+p_quantity>inv.quantity_limit THEN RAISE EXCEPTION 'Inventário esgotado.'; END IF;
  UPDATE public.collaborative_inventory SET reserved_quantity=reserved_quantity+p_quantity,
   status=CASE WHEN reserved_quantity+consumed_quantity+p_quantity=quantity_limit THEN 'sold_out' ELSE status END,updated_at=now() WHERE id=inv.id;
 END IF;
 SELECT * INTO c FROM public.campaigns WHERE id=o.campaign_id FOR SHARE;
 total:=o.reward_amount*p_quantity;
 INSERT INTO public.offer_acceptances(offer_id,campaign_id,participant_type,participant_id,social_channel_id,quantity,reward_amount,idempotency_key)
 VALUES(o.id,o.campaign_id,p_participant_type,p_participant_id,p_social_channel_id,p_quantity,total,p_idempotency_key)
 ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=excluded.idempotency_key RETURNING id INTO aid;
 IF EXISTS(SELECT 1 FROM public.campaign_budget_reservations WHERE acceptance_id=aid) THEN
   SELECT id INTO rid FROM public.campaign_budget_reservations WHERE acceptance_id=aid;
   RETURN jsonb_build_object('success',true,'deduplicated',true,'acceptance_id',aid,'reservation_id',rid);
 END IF;
 IF o.reward_mode='mpm_credits' THEN
   wrid:=public.mpm_reserve_credits(c.company_id,total,'media_purchase','campaign_offer',o.id,p_idempotency_key||':wallet',o.expires_at,
     jsonb_build_object('campaign_id',c.id,'acceptance_id',aid,'restricted_cashout',true));
 ELSE
   SELECT id INTO mrid FROM public.media_right_accounts WHERE holder_type='company' AND holder_id=c.company_id FOR UPDATE;
   IF mrid IS NULL THEN RAISE EXCEPTION 'Conta de Direito de Mídia não encontrada.'; END IF;
   PERFORM public._post_media_right_entry(mrid,c.id,'reserve',total,-total,total,'campaign_offer',o.id,p_idempotency_key||':rights',o.expires_at);
 END IF;
 INSERT INTO public.campaign_budget_reservations(campaign_id,acceptance_id,distribution_rule_id,reward_mode,amount,wallet_reservation_id,media_right_account_id,idempotency_key,expires_at)
 VALUES(c.id,aid,o.distribution_rule_id,o.reward_mode,total,wrid,mrid,p_idempotency_key||':budget',o.expires_at) RETURNING id INTO rid;
 UPDATE public.campaign_offers SET accepted_slots=accepted_slots+p_quantity,
   status=CASE WHEN accepted_slots+p_quantity=total_slots THEN 'closed' ELSE status END,updated_at=now() WHERE id=o.id;
 RETURN jsonb_build_object('success',true,'acceptance_id',aid,'reservation_id',rid,'amount',total);
END $$;

CREATE OR REPLACE FUNCTION public.release_campaign_acceptance(p_acceptance_id UUID,p_reason TEXT,p_idempotency_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.offer_acceptances%ROWTYPE; r public.campaign_budget_reservations%ROWTYPE; o public.campaign_offers%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.offer_acceptances WHERE id=p_acceptance_id FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Aceite não encontrado.'; END IF;
 IF NOT(public.mpm_can_manage_holder(a.participant_type,a.participant_id) OR EXISTS(
   SELECT 1 FROM public.campaigns c WHERE c.id=a.campaign_id AND public.mpm_can_manage_company(c.company_id))) THEN
   RAISE EXCEPTION 'Acesso negado.';
 END IF;
 SELECT * INTO r FROM public.campaign_budget_reservations WHERE acceptance_id=a.id FOR UPDATE;
 IF r.status='released' THEN RETURN false; END IF;
 IF r.status<>'reserved' THEN RAISE EXCEPTION 'Reserva não pode ser liberada.'; END IF;
 SELECT * INTO o FROM public.campaign_offers WHERE id=a.offer_id FOR UPDATE;
 IF r.reward_mode='mpm_credits' THEN PERFORM public.mpm_release_reservation(r.wallet_reservation_id,p_idempotency_key||':wallet');
 ELSE PERFORM public._post_media_right_entry(r.media_right_account_id,r.campaign_id,'release',r.amount,r.amount,-r.amount,
   'offer_acceptance',a.id,p_idempotency_key||':rights',NULL,jsonb_build_object('reason',p_reason)); END IF;
 UPDATE public.campaign_budget_reservations SET status='released',updated_at=now() WHERE id=r.id;
 UPDATE public.offer_acceptances SET status='cancelled',metadata=metadata||jsonb_build_object('release_reason',p_reason) WHERE id=a.id;
 UPDATE public.campaign_offers SET accepted_slots=GREATEST(0,accepted_slots-a.quantity),status=CASE WHEN status='closed' THEN 'offered' ELSE status END,updated_at=now() WHERE id=o.id;
 IF o.inventory_id IS NOT NULL THEN UPDATE public.collaborative_inventory SET reserved_quantity=GREATEST(0,reserved_quantity-a.quantity),
   status=CASE WHEN status='sold_out' THEN 'active' ELSE status END,updated_at=now() WHERE id=o.inventory_id; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_collaborative_publication(
 p_acceptance_id UUID,p_social_publication_id UUID,p_evidence JSONB,p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.offer_acceptances%ROWTYPE; r public.campaign_budget_reservations%ROWTYPE; p public.social_publications%ROWTYPE;
 c public.campaigns%ROWTYPE; fee public.platform_fee_rules%ROWTYPE; gross NUMERIC(18,4); fee_amt NUMERIC(18,4); net NUMERIC(18,4);
 acc UUID; sid UUID; dest UUID; right_dest UUID; dest_class TEXT;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Validação exige serviço confiável ou Master.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('collab-settlement:'||p_acceptance_id::text,0));
 SELECT id INTO sid FROM public.collaborative_settlements WHERE idempotency_key=p_idempotency_key;
 IF sid IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deduplicated',true,'settlement_id',sid); END IF;
 SELECT * INTO a FROM public.offer_acceptances WHERE id=p_acceptance_id FOR UPDATE;
 SELECT * INTO r FROM public.campaign_budget_reservations WHERE acceptance_id=a.id FOR UPDATE;
 SELECT * INTO p FROM public.social_publications WHERE id=p_social_publication_id FOR UPDATE;
 SELECT * INTO c FROM public.campaigns WHERE id=a.campaign_id FOR SHARE;
 IF a.id IS NULL OR r.status<>'reserved' OR p.id IS NULL OR p.campaign_id<>a.campaign_id OR p.status NOT IN('published','validation_pending') THEN RAISE EXCEPTION 'Entrega ou reserva inválida.'; END IF;
 IF COALESCE(p_evidence,'{}')='{}'::jsonb THEN RAISE EXCEPTION 'Evidência obrigatória.'; END IF;
 SELECT * INTO fee FROM public.platform_fee_rules WHERE operation_type='media_sale' AND is_active AND effective_from<=now()
  AND(effective_to IS NULL OR effective_to>now()) ORDER BY effective_from DESC LIMIT 1;
 gross:=r.amount; fee_amt:=round(gross*COALESCE(fee.percentage,0)/100,4); net:=gross-fee_amt;
 IF r.reward_mode='mpm_credits' THEN
  PERFORM public.mpm_consume_reservation(r.wallet_reservation_id,p_idempotency_key||':consume');
  SELECT credit_class INTO dest_class FROM public.wallet_reservation_lines l JOIN public.wallet_accounts wa ON wa.id=l.account_id
    WHERE l.reservation_id=r.wallet_reservation_id ORDER BY CASE wa.credit_class WHEN 'promotional' THEN 0 ELSE 1 END LIMIT 1;
  dest_class:=CASE WHEN dest_class='promotional' THEN 'promotional' ELSE 'earned' END;
  dest:=public.mpm_ensure_holder_account(a.participant_type,a.participant_id,dest_class);
  PERFORM public._mpm_post_entry(dest,'earned','credit',net,net,0,0,'collaborative_settlement',a.id,p_idempotency_key||':reward',a.campaign_id,NULL,NULL,NULL,
    jsonb_build_object('cashout_eligible',false,'origin_class',dest_class));
  IF fee_amt>0 THEN
    acc:=public.mpm_ensure_holder_account('platform','00000000-0000-0000-0000-000000000001','earned');
    PERFORM public._mpm_post_entry(acc,'platform_fee','credit',fee_amt,fee_amt,0,0,'collaborative_settlement',a.id,p_idempotency_key||':fee',a.campaign_id);
  END IF;
 ELSE
  PERFORM public._post_media_right_entry(r.media_right_account_id,r.campaign_id,'consume',gross,0,-gross,'offer_acceptance',a.id,p_idempotency_key||':consume-right');
  INSERT INTO public.media_right_accounts(holder_type,holder_id) VALUES(a.participant_type,a.participant_id)
    ON CONFLICT(holder_type,holder_id) DO UPDATE SET holder_id=excluded.holder_id RETURNING id INTO right_dest;
  PERFORM public._post_media_right_entry(right_dest,r.campaign_id,'reward',net,net,0,'offer_acceptance',a.id,p_idempotency_key||':reward-right',NULL,
    jsonb_build_object('cashout_eligible',false));
 END IF;
 UPDATE public.social_publications SET status='finalized',validated_at=now(),proof=p_evidence WHERE id=p.id;
 UPDATE public.offer_acceptances SET status='finalized' WHERE id=a.id;
 UPDATE public.campaign_budget_reservations SET status='consumed',updated_at=now() WHERE id=r.id;
 INSERT INTO public.collaborative_settlements(campaign_id,acceptance_id,reservation_id,social_publication_id,participant_type,participant_id,reward_mode,
  gross_amount,fee_amount,net_amount,fee_rule_id,status,idempotency_key,metadata)
 VALUES(a.campaign_id,a.id,r.id,p.id,a.participant_type,a.participant_id,r.reward_mode,gross,fee_amt,net,fee.id,'finalized',p_idempotency_key,
  jsonb_build_object('proof_kind','Publicação Validada')) RETURNING id INTO sid;
 RETURN jsonb_build_object('success',true,'settlement_id',sid,'gross',gross,'fee',fee_amt,'net',net);
END $$;

CREATE OR REPLACE VIEW public.collaborative_campaign_budget_summary WITH(security_invoker=true) AS
SELECT c.id campaign_id,c.budget_total total,
 COALESCE(sum(r.amount) FILTER(WHERE r.status='reserved'),0) reserved,
 COALESCE(sum(r.amount) FILTER(WHERE r.status='consumed'),0) consumed,
 COALESCE(sum(r.amount) FILTER(WHERE r.status IN('released','reversed')),0) reversed,
 GREATEST(0,c.budget_total-COALESCE(sum(r.amount) FILTER(WHERE r.status IN('reserved','consumed')),0)) available
FROM public.campaigns c LEFT JOIN public.campaign_budget_reservations r ON r.campaign_id=c.id
GROUP BY c.id,c.budget_total;

-- RLS por anunciante, participante e Master. Marketplace expõe apenas ofertas abertas e dados comerciais.
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY[
 'playlist_campaign_items','campaign_distribution_rules','collaborative_channel_settings','collaborative_inventory','campaign_offers',
 'offer_acceptances','media_right_accounts','media_right_ledger','campaign_budget_reservations','collaborative_settlements',
 'business_media_score_rules','business_media_score_snapshots'
] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;

CREATE POLICY "Playlist campaigns tenant" ON public.playlist_campaign_items FOR ALL TO authenticated
 USING(playlist_id IN(SELECT id FROM public.playlists WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin())
 WITH CHECK(playlist_id IN(SELECT id FROM public.playlists WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Distribution advertiser manage" ON public.campaign_distribution_rules FOR ALL TO authenticated
 USING(campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin())
 WITH CHECK(campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Channel settings owner manage" ON public.collaborative_channel_settings FOR ALL TO authenticated USING(
 (owner_type='company' AND owner_id IN(SELECT public.get_user_company_ids())) OR
 (owner_type='creator' AND owner_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin()) WITH CHECK(
 (owner_type='company' AND owner_id IN(SELECT public.get_user_company_ids())) OR
 (owner_type='creator' AND owner_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin());
CREATE POLICY "Collaborative inventory marketplace read" ON public.collaborative_inventory FOR SELECT TO authenticated USING(status IN('active','sold_out') OR public.is_master_admin());
CREATE POLICY "Collaborative inventory owner manage" ON public.collaborative_inventory FOR ALL TO authenticated
 USING(channel_setting_id IN(SELECT id FROM public.collaborative_channel_settings) OR public.is_master_admin())
 WITH CHECK(channel_setting_id IN(SELECT id FROM public.collaborative_channel_settings) OR public.is_master_admin());
CREATE POLICY "Campaign offers marketplace read" ON public.campaign_offers FOR SELECT TO authenticated USING(
 status='offered' OR campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR
 (participant_type='creator' AND participant_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR
 (participant_type='company' AND participant_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Campaign offers advertiser manage" ON public.campaign_offers FOR ALL TO authenticated
 USING(campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin())
 WITH CHECK(campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Acceptances parties read" ON public.offer_acceptances FOR SELECT TO authenticated USING(
 campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR
 (participant_type='creator' AND participant_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR
 (participant_type='company' AND participant_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Budget advertiser read" ON public.campaign_budget_reservations FOR SELECT TO authenticated
 USING(campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Settlements parties read" ON public.collaborative_settlements FOR SELECT TO authenticated USING(
 campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR
 (participant_type='creator' AND participant_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR
 (participant_type='company' AND participant_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Media right accounts holder read" ON public.media_right_accounts FOR SELECT TO authenticated USING(
 (holder_type='company' AND holder_id IN(SELECT public.get_user_company_ids())) OR
 (holder_type='creator' AND holder_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin());
CREATE POLICY "Media right ledger holder read" ON public.media_right_ledger FOR SELECT TO authenticated
 USING(account_id IN(SELECT id FROM public.media_right_accounts) OR public.is_master_admin());
CREATE POLICY "Business score rules read" ON public.business_media_score_rules FOR SELECT TO authenticated USING(is_active OR public.is_master_admin());
CREATE POLICY "Business scores marketplace read" ON public.business_media_score_snapshots FOR SELECT TO authenticated USING(true);

REVOKE INSERT,UPDATE,DELETE ON public.offer_acceptances,public.campaign_budget_reservations,public.collaborative_settlements,
 public.media_right_accounts,public.media_right_ledger FROM authenticated,anon;
REVOKE ALL ON FUNCTION public._post_media_right_entry(UUID,UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,UUID,TEXT,TIMESTAMPTZ,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.accept_campaign_offer(UUID,TEXT,UUID,UUID,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_campaign_acceptance(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_campaign_offer(UUID,TEXT,UUID,UUID,INTEGER,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_collaborative_campaign(UUID,TEXT,TEXT,DATE,DATE,TEXT,NUMERIC,JSONB,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.release_campaign_acceptance(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_collaborative_publication(UUID,UUID,JSONB,TEXT) TO service_role;
GRANT SELECT ON public.collaborative_campaign_budget_summary TO authenticated,service_role;
