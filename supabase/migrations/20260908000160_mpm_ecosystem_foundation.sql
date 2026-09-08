-- Fundação aditiva do ecossistema Mídia por Mídia.
-- Mantém economias legadas isoladas e deixa integrações externas/cash-out desabilitados.

INSERT INTO public.platform_settings(key,value,description) VALUES
  ('inventory_v2','true'::jsonb,'Alias público do core de inventário.'),
  ('wallet_mpm_v2','true'::jsonb,'Carteira e ledger MPM V2.'),
  ('settlement_v2','true'::jsonb,'Liquidação econômica por prova válida.'),
  ('matching_v2','true'::jsonb,'Matching determinístico materializado.'),
  ('partner_programs_v2','true'::jsonb,'Programas, atribuição e direitos de inventário.'),
  ('social_v2','false'::jsonb,'Integração social aguardando OAuth externo.'),
  ('creator_v2','true'::jsonb,'Cadastro, rate card e scoring de creators.'),
  ('events_v2','true'::jsonb,'Inventário temporário de eventos.'),
  ('payout_v2','false'::jsonb,'Preparação de payout; execução financeira bloqueada.'),
  ('dynamic_pricing_v2','true'::jsonb,'Preço versionado e congelado na cotação.'),
  ('cashout_enabled','false'::jsonb,'Saque MPM depende de KYC, fiscal e jurídico.'),
  ('inventory_growth_monthly_limit','1000'::jsonb,'Referência configurável de inserções Growth por tela/mês.'),
  ('mpm_default_unit_price','0.25'::jsonb,'Referência configurável: 2.000 inserções equivalem a 500 créditos.'),
  ('creator_score_weights','{"reliability":30,"delivery":30,"engagement":20,"local_relevance":20}'::jsonb,'Pesos do Creator Score.'),
  ('media_value_score_weights','{"reach":30,"engagement":25,"region":20,"niche":15,"performance":10}'::jsonb,'Pesos do Media Value Score.')
ON CONFLICT (key) DO UPDATE SET description=EXCLUDED.description;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read" ON public.platform_settings
FOR SELECT TO anon,authenticated USING (key IN (
  'public_trial_signup_enabled','public_trial_days','trial_invites_count','auto_approve_trial_internal_media',
  'public_signup_disabled_message','plan_price_monthly_cents','plan_price_annual_cents',
  'media_inventory_v2','inventory_capacity_v2','inventory_allocations_v2','inventory_preferred_limit',
  'inventory_growth_enabled','inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2',
  'partner_programs_v2','social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2',
  'inventory_growth_monthly_limit','mpm_default_unit_price'
));

-- Estados adicionais da conta. As funções existentes continuam usando available/pending/reserved.
ALTER TABLE public.wallet_accounts
  ALTER COLUMN company_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS holder_type TEXT NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS holder_id UUID,
  ADD COLUMN IF NOT EXISTS forecast_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashout_eligible_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_cashout_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disputed_balance NUMERIC(18,4) NOT NULL DEFAULT 0;
UPDATE public.wallet_accounts SET holder_id=company_id WHERE holder_id IS NULL AND company_id IS NOT NULL;
ALTER TABLE public.wallet_accounts ALTER COLUMN holder_id SET NOT NULL;
ALTER TABLE public.wallet_accounts DROP CONSTRAINT IF EXISTS wallet_accounts_holder_type_check;
ALTER TABLE public.wallet_accounts ADD CONSTRAINT wallet_accounts_holder_type_check
  CHECK (holder_type IN ('company','organic_participant','creator','affiliate','partner','platform'));
ALTER TABLE public.wallet_accounts DROP CONSTRAINT IF EXISTS wallet_accounts_holder_company_check;
ALTER TABLE public.wallet_accounts ADD CONSTRAINT wallet_accounts_holder_company_check
  CHECK ((holder_type='company' AND company_id=holder_id) OR (holder_type<>'company' AND company_id IS NULL));
ALTER TABLE public.wallet_accounts DROP CONSTRAINT IF EXISTS wallet_accounts_extended_balances_check;
ALTER TABLE public.wallet_accounts ADD CONSTRAINT wallet_accounts_extended_balances_check CHECK (
  forecast_balance>=0 AND cashout_eligible_balance>=0 AND in_cashout_balance>=0 AND settled_balance>=0 AND disputed_balance>=0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_accounts_holder_class ON public.wallet_accounts(holder_type,holder_id,credit_class);

ALTER TABLE public.wallet_ledger
  ALTER COLUMN company_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS holder_type TEXT NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS holder_id UUID,
  ADD COLUMN IF NOT EXISTS state_from TEXT,
  ADD COLUMN IF NOT EXISTS state_to TEXT,
  ADD COLUMN IF NOT EXISTS forecast_balance_after NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashout_eligible_balance_after NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_cashout_balance_after NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled_balance_after NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disputed_balance_after NUMERIC(18,4) NOT NULL DEFAULT 0;
UPDATE public.wallet_ledger l SET holder_type=a.holder_type,holder_id=a.holder_id
FROM public.wallet_accounts a WHERE a.id=l.account_id AND l.holder_id IS NULL;
ALTER TABLE public.wallet_ledger ALTER COLUMN holder_id SET NOT NULL;
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_entry_type_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_entry_type_check CHECK (entry_type IN (
  'grant','reserve','consume','release','settlement_gross','platform_fee','earned','subscription_payment','reversal',
  'forecast','pending','available','cashout_eligible','cashout_reserve','cashout_release','cashout_settle','dispute','adjustment',
  'commission','entitlement_usage'
));
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_state_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_state_check CHECK (
  state_from IS NULL OR state_from IN ('forecast','reserved','pending','available','cashout_eligible','in_cashout','settled','reversed','disputed')
);
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_state_to_check CHECK (
  state_to IS NULL OR state_to IN ('forecast','reserved','pending','available','cashout_eligible','in_cashout','settled','reversed','disputed')
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_holder_created ON public.wallet_ledger(holder_type,holder_id,created_at DESC);

CREATE TABLE public.legacy_balance_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_source TEXT NOT NULL CHECK (legacy_source IN ('wallets','seller_financial_ledger','organic_credit_ledger')),
  legacy_record_id UUID NOT NULL,
  holder_type TEXT NOT NULL,
  holder_id UUID NOT NULL,
  observed_amount NUMERIC(18,4) NOT NULL,
  observed_unit TEXT NOT NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'observed' CHECK (reconciliation_status IN ('observed','matched','exception','approved_bridge')),
  bridge_ledger_id UUID REFERENCES public.wallet_ledger(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(legacy_source,legacy_record_id)
);

CREATE TABLE public.settlement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  channel_family TEXT NOT NULL CHECK (channel_family IN ('indoor','social','creator','event')),
  proof_method TEXT NOT NULL CHECK (proof_method IN ('proof_of_play','proof_of_publication','event_proof','manual')),
  hold_hours INTEGER NOT NULL DEFAULT 0 CHECK (hold_hours>=0),
  minimum_proof_count INTEGER NOT NULL DEFAULT 1 CHECK (minimum_proof_count>0),
  fee_rule_id UUID REFERENCES public.platform_fee_rules(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to>effective_from)
);
INSERT INTO public.settlement_rules(code,channel_family,proof_method,hold_hours,fee_rule_id,metadata)
SELECT 'indoor-pop-v1','indoor','proof_of_play',0,id,'{"source":"existing_playback"}'::jsonb
FROM public.platform_fee_rules WHERE code='mpm-media-standard-v2'
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.settlement_rules(code,channel_family,proof_method,hold_hours,fee_rule_id,metadata)
SELECT x.code,x.channel_family,x.proof_method,x.hold_hours,f.id,'{"requires_external_validation":true}'::jsonb
FROM (VALUES ('social-pop-v1','social','proof_of_publication',48),('creator-pop-v1','creator','proof_of_publication',48),('event-pod-v1','event','event_proof',0)) x(code,channel_family,proof_method,hold_hours)
CROSS JOIN LATERAL (SELECT id FROM public.platform_fee_rules WHERE code='mpm-media-standard-v2') f
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.media_price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  channel_family TEXT,
  inventory_id UUID REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  city TEXT,
  state TEXT,
  inventory_type TEXT,
  duration_seconds INTEGER,
  format TEXT,
  weekday SMALLINT CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  starts_time TIME,
  ends_time TIME,
  campaign_type TEXT,
  plan_code TEXT,
  partnership_program_id UUID,
  unit_price_credits NUMERIC(18,6) NOT NULL CHECK (unit_price_credits>=0),
  occupancy_multiplier NUMERIC(10,6) NOT NULL DEFAULT 1 CHECK (occupancy_multiplier>0),
  priority INTEGER NOT NULL DEFAULT 0,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code,version),
  CHECK (effective_to IS NULL OR effective_to>effective_from)
);
INSERT INTO public.media_price_rules(code,version,channel_family,unit_price_credits,priority,effective_from,metadata)
VALUES ('indoor-reference',1,'indoor',0.25,0,now(),'{"reference_insertions":2000,"reference_credits":500}'::jsonb)
ON CONFLICT (code,version) DO NOTHING;

CREATE TABLE public.media_price_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  price_rule_id UUID NOT NULL REFERENCES public.media_price_rules(id) ON DELETE RESTRICT,
  insertion_quantity BIGINT NOT NULL CHECK (insertion_quantity>0),
  unit_price_credits NUMERIC(18,6) NOT NULL CHECK (unit_price_credits>=0),
  gross_credits NUMERIC(18,4) NOT NULL CHECK (gross_credits>=0),
  pricing_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','reserved','accepted','expired','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at>=starts_at)
);

CREATE TABLE public.matching_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  buyer_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  requested_insertions BIGINT NOT NULL CHECK (requested_insertions>0),
  allocated_insertions BIGINT NOT NULL DEFAULT 0 CHECK (allocated_insertions>=0),
  algorithm_version TEXT NOT NULL DEFAULT 'weighted-v1',
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','partial','failed','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.matching_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.matching_runs(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  capacity_period_id UUID REFERENCES public.inventory_capacity_periods(id) ON DELETE RESTRICT,
  bucket_policy_id UUID REFERENCES public.inventory_bucket_policies(id) ON DELETE RESTRICT,
  eligible BOOLEAN NOT NULL,
  score NUMERIC(18,6) NOT NULL DEFAULT 0,
  available_capacity BIGINT NOT NULL DEFAULT 0,
  score_components JSONB NOT NULL DEFAULT '{}'::jsonb,
  exclusion_reasons TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id,inventory_id)
);
CREATE TABLE public.matching_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.matching_runs(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL REFERENCES public.matching_candidates(id) ON DELETE RESTRICT,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  allocation_id UUID REFERENCES public.inventory_allocations(id) ON DELETE RESTRICT,
  allocated_insertions BIGINT NOT NULL CHECK (allocated_insertions>0),
  rank INTEGER NOT NULL CHECK (rank>0),
  decision_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id,inventory_id)
);

CREATE TABLE public.partner_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  program_type TEXT NOT NULL CHECK (program_type IN ('partner','affiliate','seller','influencer','api','admin')),
  attribution_window_days INTEGER NOT NULL DEFAULT 30 CHECK (attribution_window_days>=0),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('fixed','recurring_percentage','mpm_credit','media_entitlement','benefit')),
  reward_value NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (reward_value>=0),
  recurring_months INTEGER CHECK (recurring_months IS NULL OR recurring_months>0),
  reward_cap NUMERIC(18,4) CHECK (reward_cap IS NULL OR reward_cap>=0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','ended','cancelled')),
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at>=starts_at)
);
ALTER TABLE public.media_price_rules ADD CONSTRAINT media_price_rules_partnership_program_fkey
  FOREIGN KEY (partnership_program_id) REFERENCES public.partner_programs(id) ON DELETE SET NULL;
CREATE TABLE public.acquisition_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL CHECK (source_type IN ('code','link','qr','seller','affiliate','influencer','api','admin')),
  source_code TEXT,
  attributed_holder_type TEXT NOT NULL CHECK (attributed_holder_type IN ('company','organic_participant','creator','affiliate','partner')),
  attributed_holder_id UUID NOT NULL,
  converted_company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.partnership_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('company','organic_participant','creator','affiliate','partner')),
  participant_id UUID NOT NULL,
  attribution_id UUID REFERENCES public.acquisition_attributions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','paused','ended','cancelled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id,participant_type,participant_id),
  CHECK (ends_at IS NULL OR ends_at>=starts_at)
);
CREATE TABLE public.inventory_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.partnership_enrollments(id) ON DELETE RESTRICT,
  inventory_id UUID REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  beneficiary_type TEXT NOT NULL,
  beneficiary_id UUID NOT NULL,
  insertion_quantity BIGINT NOT NULL CHECK (insertion_quantity>0),
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('once','monthly','annual','custom')),
  unused_policy TEXT NOT NULL DEFAULT 'expire' CHECK (unused_policy IN ('expire','return_to_pool','carry_forward')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','expired','cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at>=starts_at)
);
CREATE TABLE public.entitlement_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID NOT NULL REFERENCES public.inventory_entitlements(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  granted_quantity BIGINT NOT NULL CHECK (granted_quantity>=0),
  used_quantity BIGINT NOT NULL DEFAULT 0 CHECK (used_quantity>=0),
  released_quantity BIGINT NOT NULL DEFAULT 0 CHECK (released_quantity>=0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','expired','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entitlement_id,period_start,period_end),
  CHECK (period_end>=period_start),
  CHECK (used_quantity+released_quantity<=granted_quantity)
);
CREATE TABLE public.quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_period_id UUID NOT NULL REFERENCES public.entitlement_periods(id) ON DELETE RESTRICT,
  allocation_id UUID REFERENCES public.inventory_allocations(id) ON DELETE RESTRICT,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  quantity BIGINT NOT NULL CHECK (quantity>0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released','reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.recurring_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE RESTRICT,
  attribution_id UUID NOT NULL REFERENCES public.acquisition_attributions(id) ON DELETE RESTRICT,
  beneficiary_type TEXT NOT NULL,
  beneficiary_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  amount_credits NUMERIC(18,4) NOT NULL CHECK (amount_credits>=0),
  period_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','paid','reversed','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  available_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('company','organic_participant','creator')),
  owner_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('facebook','instagram')),
  provider_account_id TEXT NOT NULL,
  encrypted_access_token TEXT,
  token_key_version INTEGER,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','revoked','error')),
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_account_id)
);
CREATE TABLE public.social_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE RESTRICT,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('company','organic_participant','creator')),
  owner_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('facebook','instagram')),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('facebook_page','instagram_professional')),
  provider_channel_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  participation_enabled BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  max_publications_per_month INTEGER NOT NULL DEFAULT 0 CHECK (max_publications_per_month>=0),
  allowed_formats TEXT[] NOT NULL DEFAULT '{}',
  blocked_categories UUID[] NOT NULL DEFAULT '{}',
  blocked_companies UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','revoked','archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_channel_id)
);
CREATE TABLE public.social_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.social_channels(id) ON DELETE RESTRICT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  followers BIGINT,
  reach BIGINT,
  impressions BIGINT,
  engagement_rate NUMERIC(12,6),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_payload_hash TEXT,
  UNIQUE(channel_id,captured_at)
);
CREATE TABLE public.social_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.social_channels(id) ON DELETE RESTRICT,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  provider_publication_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft','pending_approval','approved','scheduled','published','validated','failed','cancelled','reversed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  proof JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  bio TEXT,
  city TEXT,
  state TEXT,
  niches TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','suspended','archived')),
  creator_score NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (creator_score BETWEEN 0 AND 100),
  media_value_score NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (media_value_score BETWEEN 0 AND 100),
  tier TEXT NOT NULL DEFAULT 'starter',
  terms_accepted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.creator_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
  social_channel_id UUID REFERENCES public.social_channels(id) ON DELETE RESTRICT,
  format TEXT NOT NULL,
  price_credits NUMERIC(18,4) NOT NULL CHECK (price_credits>=0),
  turnaround_hours INTEGER NOT NULL DEFAULT 72 CHECK (turnaround_hours>0),
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (available_until IS NULL OR available_from IS NULL OR available_until>=available_from)
);
CREATE TABLE public.creator_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
  social_snapshot_id UUID REFERENCES public.social_metric_snapshots(id) ON DELETE SET NULL,
  followers BIGINT NOT NULL DEFAULT 0,
  follower_growth NUMERIC(12,6) NOT NULL DEFAULT 0,
  views BIGINT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(12,6) NOT NULL DEFAULT 0,
  local_relevance NUMERIC(7,2) NOT NULL DEFAULT 0,
  completed_campaigns INTEGER NOT NULL DEFAULT 0,
  delayed_campaigns INTEGER NOT NULL DEFAULT 0,
  refused_campaigns INTEGER NOT NULL DEFAULT 0,
  advertiser_rating NUMERIC(4,2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.creator_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
  snapshot_id UUID NOT NULL REFERENCES public.creator_metric_snapshots(id) ON DELETE RESTRICT,
  creator_score NUMERIC(7,2) NOT NULL CHECK (creator_score BETWEEN 0 AND 100),
  media_value_score NUMERIC(7,2) NOT NULL CHECK (media_value_score BETWEEN 0 AND 100),
  tier TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  score_components JSONB NOT NULL,
  next_tier_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id)
);
CREATE TABLE public.creator_campaign_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  rate_card_id UUID REFERENCES public.creator_rate_cards(id) ON DELETE SET NULL,
  offered_credits NUMERIC(18,4) NOT NULL CHECK (offered_credits>=0),
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','refused','expired','completed','cancelled')),
  responded_at TIMESTAMPTZ,
  response_reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id,campaign_id)
);
CREATE TABLE public.creator_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  reviewer_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id,campaign_id,reviewer_company_id)
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  venue_name TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','ended','cancelled','archived')),
  proof_method TEXT NOT NULL DEFAULT 'event_proof' CHECK (proof_method IN ('proof_of_play','event_proof','manual')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at>starts_at)
);
CREATE TABLE public.event_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  media_inventory_id UUID NOT NULL UNIQUE REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  inventory_name TEXT NOT NULL,
  total_capacity BIGINT NOT NULL CHECK (total_capacity>=0),
  sponsor_capacity BIGINT NOT NULL DEFAULT 0 CHECK (sponsor_capacity>=0),
  commercial_capacity BIGINT NOT NULL DEFAULT 0 CHECK (commercial_capacity>=0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','ended','cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sponsor_capacity+commercial_capacity<=total_capacity)
);

CREATE TABLE public.payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_type TEXT NOT NULL CHECK (holder_type IN ('company','creator','affiliate','partner')),
  holder_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_verification','verified','rejected','suspended')),
  kyc_status TEXT NOT NULL DEFAULT 'not_started' CHECK (kyc_status IN ('not_started','pending','approved','rejected','expired')),
  provider TEXT,
  provider_account_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(holder_type,holder_id)
);
CREATE TABLE public.payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_account_id UUID NOT NULL REFERENCES public.payout_accounts(id) ON DELETE RESTRICT,
  method_type TEXT NOT NULL CHECK (method_type IN ('pix','bank_transfer')),
  encrypted_details TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','disabled')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payout_account_id,fingerprint)
);
CREATE TABLE public.cashout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_account_id UUID NOT NULL REFERENCES public.payout_accounts(id) ON DELETE RESTRICT,
  wallet_account_id UUID NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE RESTRICT,
  amount_credits NUMERIC(18,4) NOT NULL CHECK (amount_credits>0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','blocked','pending_review','approved','in_cashout','settled','failed','reversed','cancelled')),
  simulation_only BOOLEAN NOT NULL DEFAULT true,
  idempotency_key TEXT NOT NULL UNIQUE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  external_transfer_id TEXT,
  block_reasons TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.mpm_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  run_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','completed','partial','failed')),
  counters JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(job_name,run_key)
);

-- RLS: leitura do próprio tenant/participante; mutações econômicas passam por RPCs.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'legacy_balance_reconciliations','settlement_rules','media_price_rules','media_price_quotes','matching_runs',
    'matching_candidates','matching_decisions','partner_programs','acquisition_attributions','partnership_enrollments',
    'inventory_entitlements','entitlement_periods','quota_usage','recurring_commissions','social_connections',
    'social_channels','social_metric_snapshots','social_publications','creator_profiles','creator_rate_cards',
    'creator_metric_snapshots','creator_score_history','creator_campaign_offers','creator_reviews','events','event_inventory',
    'payout_accounts','payout_methods','cashout_requests','mpm_job_runs'
  ] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP;
END $$;

CREATE POLICY "Settlement rules read" ON public.settlement_rules FOR SELECT TO authenticated USING (is_active OR public.is_master_admin());
CREATE POLICY "Price rules read" ON public.media_price_rules FOR SELECT TO authenticated USING (is_active OR public.is_master_admin());
CREATE POLICY "Price quotes tenant read" ON public.media_price_quotes FOR SELECT TO authenticated USING (buyer_company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "Matching runs tenant read" ON public.matching_runs FOR SELECT TO authenticated USING (buyer_company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "Matching candidates tenant read" ON public.matching_candidates FOR SELECT TO authenticated USING (run_id IN (SELECT id FROM public.matching_runs) OR public.is_master_admin());
CREATE POLICY "Matching decisions tenant read" ON public.matching_decisions FOR SELECT TO authenticated USING (run_id IN (SELECT id FROM public.matching_runs) OR public.is_master_admin());
CREATE POLICY "Partner programs visible" ON public.partner_programs FOR SELECT TO authenticated USING (status='active' OR owner_company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "Attributions holder read" ON public.acquisition_attributions FOR SELECT TO authenticated USING (converted_company_id IN (SELECT public.get_user_company_ids()) OR (attributed_holder_type='company' AND attributed_holder_id IN (SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Enrollments participant read" ON public.partnership_enrollments FOR SELECT TO authenticated USING ((participant_type='company' AND participant_id IN (SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Entitlements beneficiary read" ON public.inventory_entitlements FOR SELECT TO authenticated USING ((beneficiary_type='company' AND beneficiary_id IN (SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Entitlement periods read" ON public.entitlement_periods FOR SELECT TO authenticated USING (entitlement_id IN (SELECT id FROM public.inventory_entitlements) OR public.is_master_admin());
CREATE POLICY "Quota usage read" ON public.quota_usage FOR SELECT TO authenticated USING (entitlement_period_id IN (SELECT id FROM public.entitlement_periods) OR public.is_master_admin());
CREATE POLICY "Commissions beneficiary read" ON public.recurring_commissions FOR SELECT TO authenticated USING ((beneficiary_type='company' AND beneficiary_id IN (SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Social connections owner read" ON public.social_connections FOR SELECT TO authenticated USING ((owner_type='company' AND owner_id IN (SELECT public.get_user_company_ids())) OR (owner_type='organic_participant' AND owner_id IN (SELECT id FROM public.organic_participants WHERE user_id=auth.uid())) OR (owner_type='creator' AND owner_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin());
CREATE POLICY "Social channels owner read" ON public.social_channels FOR SELECT TO authenticated USING ((owner_type='company' AND owner_id IN (SELECT public.get_user_company_ids())) OR (owner_type='organic_participant' AND owner_id IN (SELECT id FROM public.organic_participants WHERE user_id=auth.uid())) OR (owner_type='creator' AND owner_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin());
CREATE POLICY "Social snapshots owner read" ON public.social_metric_snapshots FOR SELECT TO authenticated USING (channel_id IN (SELECT id FROM public.social_channels) OR public.is_master_admin());
CREATE POLICY "Social publications parties read" ON public.social_publications FOR SELECT TO authenticated USING (channel_id IN (SELECT id FROM public.social_channels) OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Creator profile self read" ON public.creator_profiles FOR SELECT TO authenticated USING (user_id=auth.uid() OR status='active' OR public.is_master_admin());
CREATE POLICY "Creator cards visible" ON public.creator_rate_cards FOR SELECT TO authenticated USING (is_active OR creator_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR public.is_master_admin());
CREATE POLICY "Creator snapshots self read" ON public.creator_metric_snapshots FOR SELECT TO authenticated USING (creator_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR public.is_master_admin());
CREATE POLICY "Creator score self read" ON public.creator_score_history FOR SELECT TO authenticated USING (creator_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR public.is_master_admin());
CREATE POLICY "Creator offers parties read" ON public.creator_campaign_offers FOR SELECT TO authenticated USING (creator_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR campaign_id IN (SELECT id FROM public.campaigns WHERE company_id IN (SELECT public.get_user_company_ids())) OR public.is_master_admin());
CREATE POLICY "Creator reviews parties read" ON public.creator_reviews FOR SELECT TO authenticated USING (creator_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid()) OR reviewer_company_id IN (SELECT public.get_user_company_ids()) OR public.is_master_admin());
CREATE POLICY "Events tenant read" ON public.events FOR SELECT TO authenticated USING (owner_company_id IN (SELECT public.get_user_company_ids()) OR status='active' OR public.is_master_admin());
CREATE POLICY "Event inventory visible" ON public.event_inventory FOR SELECT TO authenticated USING (event_id IN (SELECT id FROM public.events) OR public.is_master_admin());
CREATE POLICY "Payout accounts holder read" ON public.payout_accounts FOR SELECT TO authenticated USING ((holder_type='company' AND holder_id IN (SELECT public.get_user_company_ids())) OR (holder_type='creator' AND holder_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin());
CREATE POLICY "Payout methods holder read" ON public.payout_methods FOR SELECT TO authenticated USING (payout_account_id IN (SELECT id FROM public.payout_accounts) OR public.is_master_admin());
CREATE POLICY "Cashout holder read" ON public.cashout_requests FOR SELECT TO authenticated USING (payout_account_id IN (SELECT id FROM public.payout_accounts) OR public.is_master_admin());
CREATE POLICY "Legacy reconciliation master read" ON public.legacy_balance_reconciliations FOR SELECT TO authenticated USING (public.is_master_admin());
CREATE POLICY "Job runs master read" ON public.mpm_job_runs FOR SELECT TO authenticated USING (public.is_master_admin());

-- Generaliza a política da carteira sem abrir acesso cruzado.
DROP POLICY IF EXISTS "MPM accounts tenant read" ON public.wallet_accounts;
CREATE POLICY "MPM accounts holder read" ON public.wallet_accounts FOR SELECT TO authenticated USING (
  (holder_type='company' AND holder_id IN (SELECT public.get_user_company_ids())) OR
  (holder_type='organic_participant' AND holder_id IN (SELECT id FROM public.organic_participants WHERE user_id=auth.uid())) OR
  (holder_type='creator' AND holder_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin()
);
DROP POLICY IF EXISTS "MPM ledger tenant read" ON public.wallet_ledger;
CREATE POLICY "MPM ledger holder read" ON public.wallet_ledger FOR SELECT TO authenticated USING (
  (holder_type='company' AND holder_id IN (SELECT public.get_user_company_ids())) OR
  (holder_type='organic_participant' AND holder_id IN (SELECT id FROM public.organic_participants WHERE user_id=auth.uid())) OR
  (holder_type='creator' AND holder_id IN (SELECT id FROM public.creator_profiles WHERE user_id=auth.uid())) OR public.is_master_admin()
);

REVOKE INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.wallet_accounts,public.wallet_ledger,public.settlement_rules,public.media_price_rules,
  public.media_price_quotes,public.matching_runs,public.matching_candidates,public.matching_decisions,public.acquisition_attributions,
  public.partnership_enrollments,public.inventory_entitlements,public.entitlement_periods,public.quota_usage,public.recurring_commissions,
  public.social_publications,public.creator_metric_snapshots,public.creator_score_history,public.cashout_requests,public.mpm_job_runs
FROM authenticated;
