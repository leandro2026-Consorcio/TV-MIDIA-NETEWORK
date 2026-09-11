-- MPM Fase 2 — Indicações, Leads, Conversões e Comissões Financeiras.
-- Camada aditiva sobre campaign, campaign_offers, offer_acceptances, partner_programs,
-- payout_accounts e a Rede Colaborativa V1. Não movimenta Crédito MPM ou Direito de Mídia.

INSERT INTO public.platform_settings(key,value,description) VALUES
 ('creator_referral_leads_enabled','false'::jsonb,'Links e captação de Leads por indicação.'),
 ('external_lead_api_enabled','false'::jsonb,'API externa de eventos de Lead e conversão.'),
 ('conversion_commissions_enabled','false'::jsonb,'Comissões financeiras de conversão.'),
 ('commission_billing_enabled','false'::jsonb,'Cobrança real consolidada de comissões; manter desligada até autorização.'),
 ('creator_cash_payout_enabled','false'::jsonb,'Payout real de comissão ao Creator; manter desligado até autorização.')
ON CONFLICT(key) DO UPDATE SET description=excluded.description;

CREATE OR REPLACE FUNCTION public.mpm_feature_enabled(p_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE((SELECT (value #>> '{}')::boolean FROM public.platform_settings WHERE key=p_key),false)
$$;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read" ON public.platform_settings FOR SELECT TO anon,authenticated USING(key IN(
 'public_trial_signup_enabled','public_trial_days','trial_invites_count','auto_approve_trial_internal_media','public_signup_disabled_message',
 'plan_price_monthly_cents','plan_price_annual_cents','media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2',
 'inventory_preferred_limit','inventory_growth_enabled','inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2','partner_programs_v2',
 'social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2','inventory_growth_monthly_limit','mpm_default_unit_price',
 'expansion_program_v1','expansion_public_base_url','social_auto_publish_master_enabled',
 'social_connection_enabled','social_manual_publish_enabled','social_approval_publish_enabled','social_metrics_enabled',
 'tiktok_connection_enabled','tiktok_display_enabled','tiktok_upload_enabled','tiktok_direct_post_enabled',
 'collaborative_media_network_enabled','collaborative_creator_offers_enabled','collaborative_business_channels_enabled','collaborative_campaign_rewards_enabled',
 'creator_referral_leads_enabled','external_lead_api_enabled','conversion_commissions_enabled','commission_billing_enabled','creator_cash_payout_enabled'
));

CREATE TABLE public.franchise_networks(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 program_id UUID NOT NULL UNIQUE REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('draft','active','paused','ended')),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.franchises(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 network_id UUID NOT NULL REFERENCES public.franchise_networks(id) ON DELETE RESTRICT,
 company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 code TEXT NOT NULL,
 legal_name TEXT, tax_id_fingerprint TEXT,
 billing_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_frequency IN('weekly','biweekly','monthly','manual')),
 dispute_window_days INTEGER NOT NULL DEFAULT 7 CHECK(dispute_window_days BETWEEN 0 AND 90),
 timezone TEXT NOT NULL DEFAULT 'America/Cuiaba',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('draft','active','paused','ended')),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(network_id,code), UNIQUE(network_id,company_id)
);

ALTER TABLE public.campaigns
 ADD COLUMN IF NOT EXISTS result_modes TEXT[] NOT NULL DEFAULT ARRAY['media']::text[],
 ADD COLUMN IF NOT EXISTS referral_franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS landing_mode TEXT NOT NULL DEFAULT 'mpm' CHECK(landing_mode IN('mpm','external')),
 ADD COLUMN IF NOT EXISTS landing_url TEXT,
 ADD COLUMN IF NOT EXISTS landing_fields JSONB NOT NULL DEFAULT '["name","phone","city","consent"]'::jsonb,
 ADD COLUMN IF NOT EXISTS commission_trigger_event TEXT;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_result_modes_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_result_modes_check CHECK(
 cardinality(result_modes)>0 AND result_modes <@ ARRAY['media','referral','conversion','hybrid']::text[]
);

CREATE TABLE public.referral_attribution_rule_versions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
 version TEXT NOT NULL,
 strategy TEXT NOT NULL DEFAULT 'first_valid_lead' CHECK(strategy IN('first_valid_lead','first_click','last_click','manual_review')),
 attribution_window_days INTEGER NOT NULL DEFAULT 30 CHECK(attribution_window_days BETWEEN 1 AND 730),
 dedupe_fields TEXT[] NOT NULL DEFAULT ARRAY['phone_hash']::text[],
 risk_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
 effective_from TIMESTAMPTZ NOT NULL DEFAULT now(), effective_to TIMESTAMPTZ,
 created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(program_id,version), CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX uq_referral_rule_current ON public.referral_attribution_rule_versions(program_id) WHERE effective_to IS NULL;

CREATE TABLE public.campaign_referral_settings(
 campaign_id UUID PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
 program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
 franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT,
 attribution_rule_version_id UUID NOT NULL REFERENCES public.referral_attribution_rule_versions(id) ON DELETE RESTRICT,
 landing_mode TEXT NOT NULL DEFAULT 'mpm' CHECK(landing_mode IN('mpm','external')),
 landing_url TEXT, fields JSONB NOT NULL DEFAULT '["name","phone","city","consent"]'::jsonb,
 commission_trigger_event TEXT NOT NULL DEFAULT 'contract.activated',
 conversion_event TEXT NOT NULL DEFAULT 'sale.confirmed',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('draft','active','paused','ended')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_referrals(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 offer_acceptance_id UUID REFERENCES public.offer_acceptances(id) ON DELETE RESTRICT,
 creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
 company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT,
 attribution_rule_version_id UUID NOT NULL REFERENCES public.referral_attribution_rule_versions(id) ON DELETE RESTRICT,
 public_code TEXT NOT NULL UNIQUE CHECK(public_code ~ '^[A-Z0-9_-]{8,32}$'),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','paused','expired','revoked')),
 attribution_started_at TIMESTAMPTZ NOT NULL DEFAULT now(), attribution_expires_at TIMESTAMPTZ NOT NULL,
 source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,creator_id,franchise_id), CHECK(attribution_expires_at>attribution_started_at)
);
CREATE INDEX idx_campaign_referrals_public ON public.campaign_referrals(public_code,status);

CREATE TABLE public.referral_clicks(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), referral_id UUID NOT NULL REFERENCES public.campaign_referrals(id) ON DELETE RESTRICT,
 source_channel TEXT, source_provider TEXT, session_fingerprint TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.referral_leads(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 referral_id UUID NOT NULL REFERENCES public.campaign_referrals(id) ON DELETE RESTRICT,
 creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
 company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT,
 source_channel TEXT, source_provider TEXT,
 masked_identifier TEXT NOT NULL, encrypted_contact TEXT NOT NULL, contact_key_version INTEGER NOT NULL DEFAULT 1,
 phone_hash TEXT, email_hash TEXT, document_hash TEXT,
 external_lead_id TEXT, external_opportunity_id TEXT,
 attribution_rule_version_id UUID NOT NULL REFERENCES public.referral_attribution_rule_versions(id) ON DELETE RESTRICT,
 attribution_started_at TIMESTAMPTZ NOT NULL, attribution_expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'received' CHECK(status IN('received','contacted','qualified','proposal','converted','cancelled','rejected')),
 validation_status TEXT NOT NULL DEFAULT 'pending' CHECK(validation_status IN('pending','valid','possible_duplicate','duplicate','disputed','invalid')),
 risk_flags TEXT[] NOT NULL DEFAULT '{}', qualified_at TIMESTAMPTZ, converted_at TIMESTAMPTZ,
 consent_at TIMESTAMPTZ NOT NULL, consent_purpose TEXT NOT NULL, consent_policy_version TEXT NOT NULL,
 idempotency_key TEXT NOT NULL UNIQUE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(franchise_id,external_lead_id)
);
CREATE INDEX idx_referral_leads_scope ON public.referral_leads(franchise_id,campaign_id,created_at DESC);
CREATE INDEX idx_referral_leads_phone ON public.referral_leads(franchise_id,phone_hash) WHERE phone_hash IS NOT NULL;

CREATE TABLE public.lead_lifecycle_events(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL REFERENCES public.referral_leads(id) ON DELETE RESTRICT,
 event_type TEXT NOT NULL CHECK(event_type IN('lead.created','lead.received','lead.contacted','lead.qualified','proposal.created','sale.created','sale.confirmed','contract.signed','contract.activated','quota.activated','payment.confirmed','commission.eligible','sale.cancelled','commission.reversed','lead.attribution_changed')),
 external_event_id TEXT, partner_id UUID, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 idempotency_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conversion_sales(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL REFERENCES public.referral_leads(id) ON DELETE RESTRICT,
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT, creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
 company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT, franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT,
 external_sale_id TEXT, external_contract_id TEXT, external_payment_id TEXT,
 sale_amount NUMERIC(18,2), credit_amount NUMERIC(18,2), product_type TEXT, currency CHAR(3) NOT NULL DEFAULT 'BRL',
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN('created','confirmed','validated','cancelled','reversed')),
 conversion_event TEXT, converted_at TIMESTAMPTZ, validated_at TIMESTAMPTZ,
 idempotency_key TEXT NOT NULL UNIQUE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(franchise_id,external_sale_id)
);

CREATE TABLE public.conversion_commission_rule_versions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
 franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT, campaign_id UUID REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 version TEXT NOT NULL, calculation_mode TEXT NOT NULL DEFAULT 'fixed' CHECK(calculation_mode IN('fixed','percentage','tiered')),
 fixed_amount NUMERIC(18,2), percentage_rate NUMERIC(9,6), tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
 mpm_fee_rate NUMERIC(9,6) NOT NULL DEFAULT 10 CHECK(mpm_fee_rate BETWEEN 0 AND 100),
 commission_trigger_event TEXT NOT NULL DEFAULT 'contract.activated', currency CHAR(3) NOT NULL DEFAULT 'BRL',
 reversal_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
 effective_from TIMESTAMPTZ NOT NULL DEFAULT now(), effective_to TIMESTAMPTZ,
 created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(program_id,franchise_id,campaign_id,version), CHECK(effective_to IS NULL OR effective_to>effective_from)
);

CREATE TABLE public.conversion_commissions(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL UNIQUE REFERENCES public.conversion_sales(id) ON DELETE RESTRICT,
 lead_id UUID NOT NULL REFERENCES public.referral_leads(id) ON DELETE RESTRICT, creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
 campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT, franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT,
 rule_version_id UUID NOT NULL REFERENCES public.conversion_commission_rule_versions(id) ON DELETE RESTRICT,
 gross_commission_amount NUMERIC(18,2) NOT NULL CHECK(gross_commission_amount>=0),
 mpm_fee_rate NUMERIC(9,6) NOT NULL, mpm_fee_amount NUMERIC(18,2) NOT NULL CHECK(mpm_fee_amount>=0),
 creator_net_amount NUMERIC(18,2) NOT NULL CHECK(creator_net_amount>=0), commission_rule_version TEXT NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'BRL', trigger_event TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'forecast' CHECK(status IN('forecast','eligible','invoiced','received','payable','paid','disputed','reversed','cancelled')),
 eligible_at TIMESTAMPTZ, idempotency_key TEXT NOT NULL UNIQUE, snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(round(mpm_fee_amount+creator_net_amount,2)=round(gross_commission_amount,2))
);

CREATE TABLE public.commission_receivables(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), commission_id UUID NOT NULL UNIQUE REFERENCES public.conversion_commissions(id) ON DELETE RESTRICT,
 sale_id UUID NOT NULL REFERENCES public.conversion_sales(id) ON DELETE RESTRICT, lead_id UUID NOT NULL REFERENCES public.referral_leads(id) ON DELETE RESTRICT,
 creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT, campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
 franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE RESTRICT,
 gross_amount NUMERIC(18,2) NOT NULL, fee_amount NUMERIC(18,2) NOT NULL, creator_net_amount NUMERIC(18,2) NOT NULL,
 due_date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','closing','invoiced','received','cancelled','reversed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_closings(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE RESTRICT,
 period_start DATE NOT NULL, period_end DATE NOT NULL, frequency TEXT NOT NULL CHECK(frequency IN('weekly','biweekly','monthly','manual')),
 gross_amount NUMERIC(18,2) NOT NULL DEFAULT 0, fee_amount NUMERIC(18,2) NOT NULL DEFAULT 0, creator_net_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
 dispute_until TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'preview' CHECK(status IN('preview','disputed','approved','invoiced','paid','partially_paid','cancelled','adjusted')),
 billing_origin TEXT NOT NULL DEFAULT 'MPM_CREATOR_COMMISSION', simulation_only BOOLEAN NOT NULL DEFAULT true,
 provider_charge_id TEXT, idempotency_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(franchise_id,period_start,period_end), CHECK(period_end>=period_start)
);
CREATE TABLE public.commission_closing_items(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), closing_id UUID NOT NULL REFERENCES public.commission_closings(id) ON DELETE RESTRICT,
 receivable_id UUID NOT NULL UNIQUE REFERENCES public.commission_receivables(id) ON DELETE RESTRICT,
 commission_id UUID NOT NULL REFERENCES public.conversion_commissions(id) ON DELETE RESTRICT,
 gross_amount NUMERIC(18,2) NOT NULL, fee_amount NUMERIC(18,2) NOT NULL, creator_net_amount NUMERIC(18,2) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.commission_disputes(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), closing_id UUID NOT NULL REFERENCES public.commission_closings(id) ON DELETE RESTRICT,
 commission_id UUID REFERENCES public.conversion_commissions(id) ON DELETE RESTRICT,
 reason TEXT NOT NULL CHECK(reason IN('existing_lead','incorrect_attribution','cancelled_sale','duplicate_customer','ineligible_sale','other')),
 description TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','under_review','accepted','rejected','resolved')),
 opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 resolution TEXT, opened_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);

CREATE TABLE public.conversion_commission_ledger(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), commission_id UUID REFERENCES public.conversion_commissions(id) ON DELETE RESTRICT,
 closing_id UUID REFERENCES public.commission_closings(id) ON DELETE RESTRICT,
 creator_id UUID REFERENCES public.creator_profiles(id) ON DELETE RESTRICT, franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT,
 event_type TEXT NOT NULL CHECK(event_type IN('accrued','eligible','invoiced','received','platform_fee','creator_payable','paid','reversed','adjustment')),
 gross_delta NUMERIC(18,2) NOT NULL DEFAULT 0, fee_delta NUMERIC(18,2) NOT NULL DEFAULT 0, creator_delta NUMERIC(18,2) NOT NULL DEFAULT 0,
 currency CHAR(3) NOT NULL DEFAULT 'BRL', reverses_entry_id UUID UNIQUE REFERENCES public.conversion_commission_ledger(id) ON DELETE RESTRICT,
 idempotency_key TEXT NOT NULL UNIQUE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_payables(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
 commission_id UUID NOT NULL UNIQUE REFERENCES public.conversion_commissions(id) ON DELETE RESTRICT,
 closing_id UUID NOT NULL REFERENCES public.commission_closings(id) ON DELETE RESTRICT,
 payout_account_id UUID REFERENCES public.payout_accounts(id) ON DELETE RESTRICT,
 amount NUMERIC(18,2) NOT NULL CHECK(amount>0), currency CHAR(3) NOT NULL DEFAULT 'BRL',
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN('blocked_kyc','available','requested','processing','paid','failed','reversed','offset')),
 requested_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, external_payment_id TEXT, proof JSONB,
 simulation_only BOOLEAN NOT NULL DEFAULT true, idempotency_key TEXT NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_partners(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), program_id UUID REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
 franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT, name TEXT NOT NULL, partner_key TEXT NOT NULL UNIQUE,
 scopes TEXT[] NOT NULL DEFAULT ARRAY['leads:write','events:write']::text[], rate_limit_per_minute INTEGER NOT NULL DEFAULT 60 CHECK(rate_limit_per_minute BETWEEN 1 AND 10000),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','paused','revoked')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.integration_credentials(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES public.integration_partners(id) ON DELETE CASCADE,
 key_id TEXT NOT NULL UNIQUE, api_key_hash TEXT NOT NULL UNIQUE, encrypted_hmac_secret TEXT NOT NULL, key_version INTEGER NOT NULL DEFAULT 1,
 scopes TEXT[] NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','rotating','revoked','expired')),
 expires_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.integration_events(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES public.integration_partners(id) ON DELETE RESTRICT,
 franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT, external_event_id TEXT NOT NULL, event_type TEXT NOT NULL,
 event_timestamp TIMESTAMPTZ NOT NULL, payload_hash TEXT NOT NULL, payload JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'received' CHECK(status IN('received','processed','duplicate','failed','dead_letter')),
 error_message TEXT, processed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(partner_id,external_event_id)
);
CREATE TABLE public.integration_request_windows(
 partner_id UUID NOT NULL REFERENCES public.integration_partners(id) ON DELETE CASCADE, window_started_at TIMESTAMPTZ NOT NULL,
 request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count>=0), PRIMARY KEY(partner_id,window_started_at)
);
CREATE TABLE public.integration_outbox(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES public.integration_partners(id) ON DELETE RESTRICT,
 aggregate_type TEXT NOT NULL, aggregate_id UUID NOT NULL, event_type TEXT NOT NULL, payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','delivered','retry','dead_letter','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 10, available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 delivered_at TIMESTAMPTZ, last_error TEXT, idempotency_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_outbox_delivery ON public.integration_outbox(status,available_at);

ALTER TABLE public.campaign_offers ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'Ledger financeiro imutável; use reversão ou ajuste.'; END $$;
CREATE TRIGGER trg_conversion_commission_ledger_immutable BEFORE UPDATE OR DELETE ON public.conversion_commission_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_ledger_mutation();

CREATE OR REPLACE FUNCTION public.generate_referral_public_code() RETURNS TEXT
LANGUAGE plpgsql VOLATILE SET search_path=public,pg_temp AS $$
DECLARE code TEXT;
BEGIN LOOP code:=upper(substr(encode(gen_random_bytes(12),'hex'),1,12)); EXIT WHEN NOT EXISTS(SELECT 1 FROM public.campaign_referrals WHERE public_code=code); END LOOP; RETURN code; END $$;

CREATE OR REPLACE FUNCTION public.ensure_campaign_referral(p_acceptance_id UUID,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.offer_acceptances%ROWTYPE; c public.campaigns%ROWTYPE; s public.campaign_referral_settings%ROWTYPE; r UUID;
BEGIN
 IF NOT public.mpm_feature_enabled('creator_referral_leads_enabled') THEN RAISE EXCEPTION 'Indicações por Creator estão desabilitadas.'; END IF;
 SELECT * INTO a FROM public.offer_acceptances WHERE id=p_acceptance_id FOR SHARE;
 SELECT * INTO c FROM public.campaigns WHERE id=a.campaign_id FOR SHARE;
 SELECT * INTO s FROM public.campaign_referral_settings WHERE campaign_id=c.id;
 IF a.id IS NULL OR a.participant_type<>'creator' OR s.campaign_id IS NULL OR NOT public.mpm_can_manage_holder('creator',a.participant_id) THEN RAISE EXCEPTION 'Aceite Creator ou campanha de indicação inválida.'; END IF;
 SELECT id INTO r FROM public.campaign_referrals WHERE campaign_id=c.id AND creator_id=a.participant_id AND franchise_id IS NOT DISTINCT FROM s.franchise_id;
 IF r IS NOT NULL THEN RETURN r; END IF;
 INSERT INTO public.campaign_referrals(campaign_id,offer_acceptance_id,creator_id,company_id,franchise_id,attribution_rule_version_id,public_code,attribution_expires_at,source_metadata)
 SELECT c.id,a.id,a.participant_id,c.company_id,s.franchise_id,s.attribution_rule_version_id,public.generate_referral_public_code(),now()+make_interval(days=>ar.attribution_window_days),jsonb_build_object('idempotency_key',p_idempotency_key)
 FROM public.referral_attribution_rule_versions ar WHERE ar.id=s.attribution_rule_version_id RETURNING id INTO r;
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.capture_referral_lead(
 p_public_code TEXT,p_masked_identifier TEXT,p_encrypted_contact TEXT,p_phone_hash TEXT,p_email_hash TEXT,
 p_source_channel TEXT,p_source_provider TEXT,p_consent_purpose TEXT,p_consent_policy_version TEXT,p_idempotency_key TEXT,p_external_lead_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.campaign_referrals%ROWTYPE; l UUID; duplicate_id UUID; validation TEXT:='valid'; flags TEXT[]:='{}';
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Captação exige serviço confiável.'; END IF;
 IF NOT public.mpm_feature_enabled('creator_referral_leads_enabled') THEN RAISE EXCEPTION 'Captação de Leads está desabilitada.'; END IF;
 SELECT * INTO r FROM public.campaign_referrals WHERE public_code=upper(p_public_code) AND status='active' FOR SHARE;
 IF r.id IS NULL OR r.attribution_expires_at<=now() THEN RAISE EXCEPTION 'Indicação inválida ou expirada.'; END IF;
 SELECT id INTO l FROM public.referral_leads WHERE idempotency_key=p_idempotency_key; IF l IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deduplicated',true,'lead_id',l); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('referral-lead:'||COALESCE(p_phone_hash,p_email_hash,p_idempotency_key),0));
 SELECT id INTO duplicate_id FROM public.referral_leads WHERE franchise_id IS NOT DISTINCT FROM r.franchise_id AND
   ((p_phone_hash IS NOT NULL AND phone_hash=p_phone_hash) OR (p_email_hash IS NOT NULL AND email_hash=p_email_hash))
   AND attribution_expires_at>now() ORDER BY created_at LIMIT 1;
 IF duplicate_id IS NOT NULL THEN validation:='possible_duplicate'; flags:=array_append(flags,'existing_attribution'); END IF;
 INSERT INTO public.referral_leads(campaign_id,referral_id,creator_id,company_id,franchise_id,source_channel,source_provider,masked_identifier,encrypted_contact,
  phone_hash,email_hash,external_lead_id,attribution_rule_version_id,attribution_started_at,attribution_expires_at,validation_status,risk_flags,
  consent_at,consent_purpose,consent_policy_version,idempotency_key,metadata)
 VALUES(r.campaign_id,r.id,r.creator_id,r.company_id,r.franchise_id,p_source_channel,p_source_provider,p_masked_identifier,p_encrypted_contact,
  p_phone_hash,p_email_hash,p_external_lead_id,r.attribution_rule_version_id,r.attribution_started_at,r.attribution_expires_at,validation,flags,
  now(),p_consent_purpose,p_consent_policy_version,p_idempotency_key,jsonb_build_object('possible_duplicate_of',duplicate_id)) RETURNING id INTO l;
 INSERT INTO public.lead_lifecycle_events(lead_id,event_type,idempotency_key,payload) VALUES(l,'lead.created',p_idempotency_key||':created',jsonb_build_object('validation_status',validation));
 RETURN jsonb_build_object('success',true,'lead_id',l,'validation_status',validation);
END $$;

CREATE OR REPLACE FUNCTION public.calculate_conversion_commission(p_rule UUID,p_sale_amount NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE r public.conversion_commission_rule_versions%ROWTYPE; amount NUMERIC(18,2); tier JSONB;
BEGIN
 SELECT * INTO r FROM public.conversion_commission_rule_versions WHERE id=p_rule;
 IF r.calculation_mode='fixed' THEN amount:=r.fixed_amount;
 ELSIF r.calculation_mode='percentage' THEN amount:=round(COALESCE(p_sale_amount,0)*r.percentage_rate/100,2);
 ELSE
  SELECT value INTO tier FROM jsonb_array_elements(r.tiers) WHERE COALESCE((value->>'min')::numeric,0)<=COALESCE(p_sale_amount,0)
   AND ((value->>'max') IS NULL OR COALESCE(p_sale_amount,0)<=(value->>'max')::numeric) ORDER BY COALESCE((value->>'min')::numeric,0) DESC LIMIT 1;
  amount:=COALESCE((tier->>'amount')::numeric,0);
 END IF;
 RETURN round(COALESCE(amount,0),2);
END $$;

CREATE OR REPLACE FUNCTION public.apply_conversion_event(p_lead_id UUID,p_event_type TEXT,p_external_event_id TEXT,p_payload JSONB,p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.referral_leads%ROWTYPE; s public.conversion_sales%ROWTYPE; cfg public.campaign_referral_settings%ROWTYPE;
 rule public.conversion_commission_rule_versions%ROWTYPE; sale_id UUID; commission_id UUID; gross NUMERIC(18,2); fee NUMERIC(18,2); net NUMERIC(18,2); new_status TEXT;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Evento exige serviço confiável.'; END IF;
 IF NOT public.mpm_feature_enabled('conversion_commissions_enabled') THEN RAISE EXCEPTION 'Conversões e comissões estão desabilitadas.'; END IF;
 SELECT * INTO l FROM public.referral_leads WHERE id=p_lead_id FOR UPDATE; IF l.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado.'; END IF;
 IF EXISTS(SELECT 1 FROM public.lead_lifecycle_events WHERE idempotency_key=p_idempotency_key) THEN RETURN jsonb_build_object('success',true,'deduplicated',true); END IF;
 INSERT INTO public.lead_lifecycle_events(lead_id,event_type,external_event_id,payload,idempotency_key) VALUES(l.id,p_event_type,p_external_event_id,COALESCE(p_payload,'{}'),p_idempotency_key);
 new_status:=CASE p_event_type WHEN 'lead.contacted' THEN 'contacted' WHEN 'lead.qualified' THEN 'qualified' WHEN 'proposal.created' THEN 'proposal' WHEN 'sale.confirmed' THEN 'converted' WHEN 'contract.activated' THEN 'converted' WHEN 'quota.activated' THEN 'converted' WHEN 'sale.cancelled' THEN 'cancelled' ELSE l.status END;
 UPDATE public.referral_leads SET status=new_status,qualified_at=CASE WHEN p_event_type='lead.qualified' THEN now() ELSE qualified_at END,
  converted_at=CASE WHEN p_event_type IN('sale.confirmed','contract.activated','quota.activated') THEN now() ELSE converted_at END,updated_at=now() WHERE id=l.id;
 IF p_event_type IN('sale.created','sale.confirmed','contract.activated','quota.activated','payment.confirmed') THEN
  IF NULLIF(p_payload->>'external_sale_id','') IS NULL THEN RAISE EXCEPTION 'external_sale_id é obrigatório para eventos de venda.'; END IF;
  INSERT INTO public.conversion_sales(lead_id,campaign_id,creator_id,company_id,franchise_id,external_sale_id,external_contract_id,external_payment_id,sale_amount,credit_amount,product_type,status,conversion_event,converted_at,idempotency_key,metadata)
  VALUES(l.id,l.campaign_id,l.creator_id,l.company_id,l.franchise_id,p_payload->>'external_sale_id',p_payload->>'external_contract_id',p_payload->>'external_payment_id',
   NULLIF(p_payload->>'sale_amount','')::numeric,NULLIF(p_payload->>'credit_amount','')::numeric,p_payload->>'product_type',CASE WHEN p_event_type='sale.created' THEN 'created' ELSE 'confirmed' END,p_event_type,now(),p_idempotency_key||':sale',COALESCE(p_payload,'{}'))
  ON CONFLICT(franchise_id,external_sale_id) DO UPDATE SET external_contract_id=COALESCE(excluded.external_contract_id,public.conversion_sales.external_contract_id),external_payment_id=COALESCE(excluded.external_payment_id,public.conversion_sales.external_payment_id),sale_amount=COALESCE(excluded.sale_amount,public.conversion_sales.sale_amount),credit_amount=COALESCE(excluded.credit_amount,public.conversion_sales.credit_amount),status=excluded.status,conversion_event=excluded.conversion_event,updated_at=now() RETURNING * INTO s;
  sale_id:=s.id;
 END IF;
 SELECT * INTO cfg FROM public.campaign_referral_settings WHERE campaign_id=l.campaign_id;
 IF cfg.campaign_id IS NOT NULL AND p_event_type IN(cfg.conversion_event,cfg.commission_trigger_event) THEN
  SELECT * INTO rule FROM public.conversion_commission_rule_versions WHERE program_id=cfg.program_id AND (franchise_id IS NULL OR franchise_id=l.franchise_id)
   AND (campaign_id IS NULL OR campaign_id=l.campaign_id) AND effective_from<=now() AND effective_to IS NULL
   ORDER BY campaign_id NULLS LAST,franchise_id NULLS LAST LIMIT 1;
  IF rule.id IS NULL THEN RAISE EXCEPTION 'Regra de comissão vigente não encontrada.'; END IF;
  IF sale_id IS NULL THEN SELECT * INTO s FROM public.conversion_sales WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1; sale_id:=s.id; END IF;
  IF sale_id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada para cálculo da comissão.'; END IF;
  gross:=public.calculate_conversion_commission(rule,COALESCE(s.sale_amount,NULLIF(p_payload->>'sale_amount','')::numeric)); fee:=round(gross*rule.mpm_fee_rate/100,2); net:=gross-fee;
  SELECT c.id INTO commission_id FROM public.conversion_commissions c WHERE c.sale_id=s.id;
  IF commission_id IS NULL THEN
   INSERT INTO public.conversion_commissions(sale_id,lead_id,creator_id,campaign_id,franchise_id,rule_version_id,gross_commission_amount,mpm_fee_rate,mpm_fee_amount,creator_net_amount,commission_rule_version,currency,trigger_event,status,eligible_at,idempotency_key,snapshot)
   VALUES(sale_id,l.id,l.creator_id,l.campaign_id,l.franchise_id,rule.id,gross,rule.mpm_fee_rate,fee,net,rule.version,rule.currency,cfg.commission_trigger_event,
    CASE WHEN p_event_type=cfg.commission_trigger_event THEN 'eligible' ELSE 'forecast' END,
    CASE WHEN p_event_type=cfg.commission_trigger_event THEN now() ELSE NULL END,'commission:'||sale_id::text,to_jsonb(rule)) RETURNING id INTO commission_id;
   IF p_event_type<>cfg.commission_trigger_event THEN
    INSERT INTO public.conversion_commission_ledger(commission_id,creator_id,franchise_id,event_type,idempotency_key,metadata)
    VALUES(commission_id,l.creator_id,l.franchise_id,'accrued','forecast:'||commission_id::text,jsonb_build_object('projected_gross',gross,'projected_fee',fee,'projected_creator_net',net,'rule_version',rule.version));
   END IF;
  END IF;
  IF p_event_type=cfg.commission_trigger_event THEN
   UPDATE public.conversion_commissions SET status='eligible',eligible_at=COALESCE(eligible_at,now()),updated_at=now() WHERE id=commission_id AND status='forecast';
   INSERT INTO public.commission_receivables(commission_id,sale_id,lead_id,creator_id,campaign_id,franchise_id,gross_amount,fee_amount,creator_net_amount,due_date)
   VALUES(commission_id,sale_id,l.id,l.creator_id,l.campaign_id,l.franchise_id,gross,fee,net,current_date+30) ON CONFLICT(commission_id) DO NOTHING;
   INSERT INTO public.conversion_commission_ledger(commission_id,creator_id,franchise_id,event_type,gross_delta,fee_delta,creator_delta,idempotency_key,metadata)
   VALUES(commission_id,l.creator_id,l.franchise_id,'eligible',gross,fee,net,'eligible:'||commission_id::text,jsonb_build_object('rule_version',rule.version)) ON CONFLICT(idempotency_key) DO NOTHING;
  END IF;
 END IF;
 IF p_event_type='sale.cancelled' AND EXISTS(SELECT 1 FROM public.conversion_commissions c JOIN public.conversion_sales x ON x.id=c.sale_id WHERE x.lead_id=l.id AND c.status NOT IN('reversed','cancelled')) THEN
  INSERT INTO public.conversion_commission_ledger(commission_id,creator_id,franchise_id,event_type,gross_delta,fee_delta,creator_delta,reverses_entry_id,idempotency_key,metadata)
  SELECT c.id,c.creator_id,c.franchise_id,'reversed',-c.gross_commission_amount,-c.mpm_fee_amount,-c.creator_net_amount,e.id,p_idempotency_key||':reversal',jsonb_build_object('reason',p_payload->>'reason')
  FROM public.conversion_commissions c JOIN public.conversion_sales x ON x.id=c.sale_id JOIN LATERAL(SELECT id FROM public.conversion_commission_ledger WHERE commission_id=c.id AND event_type='eligible' ORDER BY created_at LIMIT 1)e ON true
  WHERE x.lead_id=l.id AND c.status NOT IN('reversed','cancelled');
  UPDATE public.conversion_commissions SET status='reversed',updated_at=now() WHERE sale_id IN(SELECT id FROM public.conversion_sales WHERE lead_id=l.id);
  UPDATE public.commission_receivables SET status='reversed',updated_at=now() WHERE lead_id=l.id;
  UPDATE public.conversion_sales SET status='cancelled',updated_at=now() WHERE lead_id=l.id;
 END IF;
 RETURN jsonb_build_object('success',true,'sale_id',sale_id,'commission_id',commission_id);
END $$;

CREATE OR REPLACE FUNCTION public.create_commission_closing(p_franchise_id UUID,p_period_start DATE,p_period_end DATE,p_idempotency_key TEXT,p_simulation_only BOOLEAN DEFAULT true)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.franchises%ROWTYPE; cid UUID;
BEGIN
 SELECT * INTO f FROM public.franchises WHERE id=p_franchise_id FOR SHARE;
 IF f.id IS NULL OR NOT(public.mpm_can_manage_company(f.company_id) OR auth.role()='service_role') THEN RAISE EXCEPTION 'Franquia inválida ou acesso negado.'; END IF;
 IF NOT p_simulation_only AND NOT public.mpm_feature_enabled('commission_billing_enabled') THEN RAISE EXCEPTION 'Cobrança real está desabilitada.'; END IF;
 INSERT INTO public.commission_closings(franchise_id,period_start,period_end,frequency,dispute_until,simulation_only,idempotency_key)
 VALUES(f.id,p_period_start,p_period_end,f.billing_frequency,now()+make_interval(days=>f.dispute_window_days),p_simulation_only,p_idempotency_key) RETURNING id INTO cid;
 INSERT INTO public.commission_closing_items(closing_id,receivable_id,commission_id,gross_amount,fee_amount,creator_net_amount)
 SELECT cid,r.id,r.commission_id,r.gross_amount,r.fee_amount,r.creator_net_amount FROM public.commission_receivables r
 WHERE r.franchise_id=f.id AND r.status='open' AND r.created_at::date BETWEEN p_period_start AND p_period_end FOR UPDATE;
 UPDATE public.commission_receivables SET status='closing',updated_at=now() WHERE id IN(SELECT receivable_id FROM public.commission_closing_items WHERE closing_id=cid);
 UPDATE public.commission_closings c SET gross_amount=x.gross,fee_amount=x.fee,creator_net_amount=x.net,updated_at=now()
 FROM(SELECT COALESCE(sum(gross_amount),0)gross,COALESCE(sum(fee_amount),0)fee,COALESCE(sum(creator_net_amount),0)net FROM public.commission_closing_items WHERE closing_id=cid)x WHERE c.id=cid;
 RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.simulate_commission_receipt(p_closing_id UUID,p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.commission_closings%ROWTYPE; item RECORD; count_payables INTEGER:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Simulação exige serviço confiável.'; END IF;
 SELECT * INTO c FROM public.commission_closings WHERE id=p_closing_id FOR UPDATE;
 IF c.id IS NULL OR NOT c.simulation_only THEN RAISE EXCEPTION 'Somente fechamento simulado pode ser recebido nesta fase.'; END IF;
 IF EXISTS(SELECT 1 FROM public.conversion_commission_ledger WHERE idempotency_key=p_idempotency_key||':received') THEN RETURN jsonb_build_object('success',true,'deduplicated',true); END IF;
 INSERT INTO public.conversion_commission_ledger(closing_id,franchise_id,event_type,gross_delta,fee_delta,creator_delta,idempotency_key,metadata)
 VALUES(c.id,c.franchise_id,'received',c.gross_amount,c.fee_amount,c.creator_net_amount,p_idempotency_key||':received',jsonb_build_object('simulation_only',true));
 FOR item IN SELECT i.*,cc.creator_id FROM public.commission_closing_items i JOIN public.conversion_commissions cc ON cc.id=i.commission_id WHERE i.closing_id=c.id LOOP
  INSERT INTO public.creator_payables(creator_id,commission_id,closing_id,amount,simulation_only,idempotency_key)
  VALUES(item.creator_id,item.commission_id,c.id,item.creator_net_amount,true,p_idempotency_key||':payable:'||item.commission_id) ON CONFLICT(idempotency_key) DO NOTHING;
  INSERT INTO public.conversion_commission_ledger(commission_id,closing_id,creator_id,franchise_id,event_type,creator_delta,idempotency_key,metadata)
  VALUES(item.commission_id,c.id,item.creator_id,c.franchise_id,'creator_payable',item.creator_net_amount,p_idempotency_key||':ledger-payable:'||item.commission_id,jsonb_build_object('simulation_only',true)) ON CONFLICT(idempotency_key) DO NOTHING;
  UPDATE public.conversion_commissions SET status='payable',updated_at=now() WHERE id=item.commission_id;
  count_payables:=count_payables+1;
 END LOOP;
 UPDATE public.commission_receivables SET status='received',updated_at=now() WHERE id IN(SELECT receivable_id FROM public.commission_closing_items WHERE closing_id=c.id);
 UPDATE public.commission_closings SET status='paid',updated_at=now() WHERE id=c.id;
 RETURN jsonb_build_object('success',true,'simulation_only',true,'payables',count_payables);
END $$;

CREATE OR REPLACE FUNCTION public.consume_integration_rate_limit(p_partner_id UUID,p_limit INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w TIMESTAMPTZ:=date_trunc('minute',now()); n INTEGER;
BEGIN INSERT INTO public.integration_request_windows(partner_id,window_started_at,request_count) VALUES(p_partner_id,w,1)
 ON CONFLICT(partner_id,window_started_at) DO UPDATE SET request_count=public.integration_request_windows.request_count+1 RETURNING request_count INTO n; RETURN n<=p_limit; END $$;

CREATE OR REPLACE FUNCTION public.protect_attribution_owner() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN IF OLD.creator_id<>NEW.creator_id OR OLD.referral_id<>NEW.referral_id OR OLD.attribution_rule_version_id<>NEW.attribution_rule_version_id THEN
 RAISE EXCEPTION 'Atribuição não pode ser trocada automaticamente; registre evento de auditoria e ajuste autorizado.'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_referral_lead_attribution_immutable BEFORE UPDATE ON public.referral_leads FOR EACH ROW EXECUTE FUNCTION public.protect_attribution_owner();

CREATE OR REPLACE FUNCTION public.get_my_referral_funnel()
RETURNS TABLE(lead_id UUID,masked_identifier TEXT,campaign_id UUID,campaign_name TEXT,city TEXT,stage TEXT,created_at TIMESTAMPTZ,
 gross_commission NUMERIC,creator_net NUMERIC,commission_status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT l.id,l.masked_identifier,l.campaign_id,c.name,l.metadata->>'city',l.status,l.created_at,
  cc.gross_commission_amount,cc.creator_net_amount,cc.status
 FROM public.referral_leads l JOIN public.creator_profiles cp ON cp.id=l.creator_id JOIN public.campaigns c ON c.id=l.campaign_id
 LEFT JOIN public.conversion_commissions cc ON cc.lead_id=l.id
 WHERE cp.user_id=auth.uid() OR public.is_master_admin()
 ORDER BY l.created_at DESC;
$$;

DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY[
 'franchise_networks','franchises','referral_attribution_rule_versions','campaign_referral_settings','campaign_referrals','referral_clicks','referral_leads','lead_lifecycle_events',
 'conversion_sales','conversion_commission_rule_versions','conversion_commissions','commission_receivables','commission_closings','commission_closing_items','commission_disputes',
 'conversion_commission_ledger','creator_payables','integration_partners','integration_credentials','integration_events','integration_request_windows','integration_outbox'
] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;

CREATE POLICY "Networks tenant read" ON public.franchise_networks FOR SELECT TO authenticated USING(program_id IN(SELECT id FROM public.partner_programs) OR public.is_master_admin());
CREATE POLICY "Franchises tenant read" ON public.franchises FOR SELECT TO authenticated USING(company_id IN(SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "Referral rules scoped read" ON public.referral_attribution_rule_versions FOR SELECT TO authenticated USING(program_id IN(SELECT id FROM public.partner_programs) OR public.is_master_admin());
CREATE POLICY "Campaign referral settings parties" ON public.campaign_referral_settings FOR SELECT TO authenticated USING(campaign_id IN(SELECT id FROM public.campaigns WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Referrals parties read" ON public.campaign_referrals FOR SELECT TO authenticated USING(company_id IN(SELECT public.get_user_company_ids()) OR creator_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR public.is_master_admin());
CREATE POLICY "Referral clicks aggregate owner" ON public.referral_clicks FOR SELECT TO authenticated USING(referral_id IN(SELECT id FROM public.campaign_referrals) OR public.is_master_admin());
CREATE POLICY "Leads franchise private read" ON public.referral_leads FOR SELECT TO authenticated USING(company_id IN(SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "Lead events parties read" ON public.lead_lifecycle_events FOR SELECT TO authenticated USING(lead_id IN(SELECT id FROM public.referral_leads) OR public.is_master_admin());
CREATE POLICY "Sales parties read" ON public.conversion_sales FOR SELECT TO authenticated USING(company_id IN(SELECT public.get_user_company_ids()) OR creator_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR public.is_master_admin());
CREATE POLICY "Commission rules scoped read" ON public.conversion_commission_rule_versions FOR SELECT TO authenticated USING(program_id IN(SELECT id FROM public.partner_programs) OR public.is_master_admin());
CREATE POLICY "Conversion commissions parties" ON public.conversion_commissions FOR SELECT TO authenticated USING(creator_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR franchise_id IN(SELECT id FROM public.franchises WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Receivables franchise read" ON public.commission_receivables FOR SELECT TO authenticated USING(franchise_id IN(SELECT id FROM public.franchises WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Closings franchise read" ON public.commission_closings FOR SELECT TO authenticated USING(franchise_id IN(SELECT id FROM public.franchises WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Closing items franchise read" ON public.commission_closing_items FOR SELECT TO authenticated USING(closing_id IN(SELECT id FROM public.commission_closings) OR public.is_master_admin());
CREATE POLICY "Disputes franchise manage" ON public.commission_disputes FOR ALL TO authenticated USING(closing_id IN(SELECT id FROM public.commission_closings) OR public.is_master_admin()) WITH CHECK(closing_id IN(SELECT id FROM public.commission_closings) OR public.is_master_admin());
CREATE POLICY "Commission ledger parties" ON public.conversion_commission_ledger FOR SELECT TO authenticated USING(creator_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR franchise_id IN(SELECT id FROM public.franchises WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Creator payables self" ON public.creator_payables FOR SELECT TO authenticated USING(creator_id IN(SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR public.is_master_admin());
CREATE POLICY "Integration partners master" ON public.integration_partners FOR SELECT TO authenticated USING(franchise_id IN(SELECT id FROM public.franchises WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Integration events scoped" ON public.integration_events FOR SELECT TO authenticated USING(franchise_id IN(SELECT id FROM public.franchises WHERE company_id IN(SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Integration outbox scoped" ON public.integration_outbox FOR SELECT TO authenticated USING(partner_id IN(SELECT id FROM public.integration_partners) OR public.is_master_admin());

REVOKE ALL ON public.integration_credentials,public.integration_request_windows FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.campaign_referrals,public.referral_leads,public.lead_lifecycle_events,public.conversion_sales,public.conversion_commissions,
 public.commission_receivables,public.commission_closings,public.commission_closing_items,public.conversion_commission_ledger,public.creator_payables,public.integration_events,public.integration_outbox FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.capture_referral_lead(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_referral_lead(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_campaign_referral(UUID,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_conversion_event(UUID,TEXT,TEXT,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_commission_closing(UUID,DATE,DATE,TEXT,BOOLEAN) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.simulate_commission_receipt(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_integration_rate_limit(UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_referral_funnel() TO authenticated,service_role;

COMMENT ON TABLE public.referral_invites IS 'Convites VIP legados; não representam Leads de performance.';
COMMENT ON TABLE public.conversion_commission_ledger IS 'Ledger financeiro imutável em BRL; separado de Créditos MPM, Direito de Mídia e comissões TV/Expansão.';
COMMENT ON TABLE public.integration_outbox IS 'Outbox confiável; workers aplicam retry exponencial e dead-letter sem perder eventos.';
