-- PACOTE 1: fundação aditiva de inventário e capacidade.
-- Não cria Crédito MPM, não altera players e não converte microcrédito orgânico.

INSERT INTO public.platform_settings(key, value, description) VALUES
  ('media_inventory_v2', 'false'::jsonb, 'Feature flag da camada media_inventory.'),
  ('inventory_capacity_v2', 'false'::jsonb, 'Feature flag de capacidade por período.'),
  ('inventory_allocations_v2', 'false'::jsonb, 'Feature flag de bolsões, preferências e reservas.'),
  ('inventory_preferred_limit', '3'::jsonb, 'Máximo configurável de empresas preferenciais ativas por inventário.'),
  ('inventory_growth_enabled', 'false'::jsonb, 'Autoriza configuração do bolsão MPM Growth pelo Master Admin.')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read"
  ON public.platform_settings FOR SELECT TO anon, authenticated
  USING (key IN (
    'public_trial_signup_enabled', 'public_trial_days', 'trial_invites_count',
    'auto_approve_trial_internal_media', 'public_signup_disabled_message',
    'plan_price_monthly_cents', 'plan_price_annual_cents',
    'media_inventory_v2', 'inventory_capacity_v2', 'inventory_allocations_v2',
    'inventory_preferred_limit', 'inventory_growth_enabled'
  ));

CREATE TABLE IF NOT EXISTS public.media_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('company', 'organic_participant', 'creator', 'partner', 'platform')),
  owner_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('company_screen', 'organic_screen', 'social_channel', 'creator_channel', 'event_slot', 'future')),
  source_id UUID NOT NULL,
  channel_family TEXT NOT NULL CHECK (channel_family IN ('indoor', 'social', 'creator', 'event', 'future')),
  inventory_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'inactive', 'archived')),
  city TEXT,
  state TEXT,
  orientation TEXT CHECK (orientation IS NULL OR orientation IN ('horizontal', 'vertical', 'not_applicable')),
  proof_method TEXT NOT NULL DEFAULT 'proof_of_play' CHECK (proof_method IN ('proof_of_play', 'proof_of_publication', 'event_proof', 'manual', 'future')),
  commercial_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_media_inventory_source UNIQUE(source_type, source_id),
  CHECK (
    (source_type = 'company_screen' AND owner_type = 'company' AND channel_family = 'indoor') OR
    (source_type = 'organic_screen' AND owner_type = 'organic_participant' AND channel_family = 'indoor') OR
    source_type IN ('social_channel', 'creator_channel', 'event_slot', 'future')
  )
);

CREATE TABLE IF NOT EXISTS public.inventory_capacity_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  cycle_type TEXT NOT NULL DEFAULT 'monthly' CHECK (cycle_type IN ('monthly', 'custom')),
  calculation_source TEXT NOT NULL CHECK (calculation_source IN ('manual', 'estimated', 'calculated')),
  calculation_version INTEGER NOT NULL DEFAULT 1 CHECK (calculation_version > 0),
  calculation_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  theoretical_capacity BIGINT NOT NULL CHECK (theoretical_capacity >= 0),
  own_use_capacity BIGINT NOT NULL DEFAULT 0 CHECK (own_use_capacity >= 0),
  network_capacity BIGINT NOT NULL DEFAULT 0 CHECK (network_capacity >= 0),
  reserved_capacity BIGINT NOT NULL DEFAULT 0 CHECK (reserved_capacity >= 0),
  committed_capacity BIGINT NOT NULL DEFAULT 0 CHECK (committed_capacity >= 0),
  delivered_capacity BIGINT NOT NULL DEFAULT 0 CHECK (delivered_capacity >= 0),
  available_capacity BIGINT NOT NULL DEFAULT 0 CHECK (available_capacity >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed', 'cancelled')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_capacity_period UNIQUE(media_inventory_id, period_start, period_end),
  CHECK (period_end >= period_start),
  CHECK (own_use_capacity + network_capacity <= theoretical_capacity),
  CHECK (reserved_capacity <= theoretical_capacity),
  CHECK (committed_capacity <= theoretical_capacity),
  CHECK (delivered_capacity <= theoretical_capacity),
  CHECK (available_capacity <= theoretical_capacity)
);

CREATE TABLE IF NOT EXISTS public.inventory_bucket_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacity_period_id UUID NOT NULL REFERENCES public.inventory_capacity_periods(id) ON DELETE RESTRICT,
  bucket_type TEXT NOT NULL CHECK (bucket_type IN ('own_use', 'preferred', 'partnership', 'mpm_growth', 'automatic_pool')),
  capacity_quantity BIGINT NOT NULL CHECK (capacity_quantity >= 0),
  allocated_quantity BIGINT NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
  release_unused_owner_capacity BOOLEAN NOT NULL DEFAULT FALSE,
  release_after_day SMALLINT CHECK (release_after_day IS NULL OR release_after_day BETWEEN 1 AND 31),
  release_lead_days SMALLINT CHECK (release_lead_days IS NULL OR release_lead_days BETWEEN 0 AND 366),
  release_to_bucket TEXT CHECK (release_to_bucket IS NULL OR release_to_bucket IN ('preferred', 'partnership', 'mpm_growth', 'automatic_pool')),
  reason TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_bucket_period_type UNIQUE(capacity_period_id, bucket_type),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  CHECK (allocated_quantity <= capacity_quantity),
  CHECK (bucket_type = 'own_use' OR release_unused_owner_capacity = FALSE),
  CHECK (bucket_type <> 'mpm_growth' OR reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.inventory_preferred_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  preferred_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  priority SMALLINT NOT NULL CHECK (priority > 0),
  max_insertions BIGINT NOT NULL CHECK (max_insertions > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_preferred_company_window UNIQUE(inventory_id, preferred_company_id, starts_at, ends_at),
  CHECK (ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS public.inventory_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  capacity_period_id UUID NOT NULL REFERENCES public.inventory_capacity_periods(id) ON DELETE RESTRICT,
  bucket_policy_id UUID NOT NULL REFERENCES public.inventory_bucket_policies(id) ON DELETE RESTRICT,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('own_use', 'preferred', 'partnership', 'mpm_growth', 'commercial_reservation')),
  beneficiary_type TEXT NOT NULL CHECK (beneficiary_type IN ('inventory_owner', 'company', 'partner', 'platform')),
  beneficiary_id UUID,
  insertion_quantity BIGINT NOT NULL CHECK (insertion_quantity > 0),
  reserved_quantity BIGINT NOT NULL CHECK (reserved_quantity >= 0),
  consumed_quantity BIGINT NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('draft', 'reserved', 'committed', 'partially_consumed', 'consumed', 'released', 'expired', 'cancelled')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  release_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_type TEXT NOT NULL,
  source_id UUID,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at >= starts_at),
  CHECK (expires_at IS NULL OR expires_at >= starts_at),
  CHECK (reserved_quantity <= insertion_quantity),
  CHECK (consumed_quantity <= insertion_quantity),
  CHECK (beneficiary_type IN ('inventory_owner', 'platform') OR beneficiary_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.inventory_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES public.media_inventory(id) ON DELETE RESTRICT,
  capacity_period_id UUID REFERENCES public.inventory_capacity_periods(id) ON DELETE RESTRICT,
  allocation_id UUID REFERENCES public.inventory_allocations(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_inventory_owner ON public.media_inventory(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_media_inventory_source ON public.media_inventory(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_media_inventory_region ON public.media_inventory(state, city);
CREATE INDEX IF NOT EXISTS idx_capacity_inventory_period ON public.inventory_capacity_periods(media_inventory_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_bucket_period_status ON public.inventory_bucket_policies(capacity_period_id, status);
CREATE INDEX IF NOT EXISTS idx_preferred_inventory_status ON public.inventory_preferred_participants(inventory_id, status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_allocations_period_status ON public.inventory_allocations(capacity_period_id, status);
CREATE INDEX IF NOT EXISTS idx_allocations_inventory_window ON public.inventory_allocations(inventory_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_inventory_created ON public.inventory_audit_logs(inventory_id, created_at DESC);

ALTER TABLE public.media_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_capacity_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_bucket_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_preferred_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_inventory_feature_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_key IN ('media_inventory_v2', 'inventory_capacity_v2', 'inventory_allocations_v2', 'inventory_growth_enabled')
      THEN COALESCE((SELECT (value #>> '{}')::BOOLEAN FROM public.platform_settings WHERE key = p_key), FALSE)
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_media_inventory(p_inventory_id UUID, p_require_admin BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_inventory public.media_inventory%ROWTYPE;
BEGIN
  IF public.is_master_admin() THEN RETURN TRUE; END IF;
  SELECT * INTO v_inventory FROM public.media_inventory WHERE id = p_inventory_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_inventory.owner_type = 'company' THEN
    IF p_require_admin THEN
      RETURN v_inventory.owner_id IN (SELECT public.get_user_admin_company_ids());
    END IF;
    RETURN v_inventory.owner_id IN (SELECT public.get_user_company_ids());
  END IF;
  IF v_inventory.owner_type = 'organic_participant' AND NOT p_require_admin THEN
    RETURN EXISTS (SELECT 1 FROM public.organic_participants WHERE id = v_inventory.owner_id AND user_id = auth.uid());
  END IF;
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_media_inventory(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_media_inventory(UUID, BOOLEAN) TO authenticated, service_role;

CREATE POLICY "MediaInventory - owner read"
  ON public.media_inventory FOR SELECT TO authenticated
  USING (public.can_access_media_inventory(id, FALSE));
CREATE POLICY "CapacityPeriods - owner read"
  ON public.inventory_capacity_periods FOR SELECT TO authenticated
  USING (public.can_access_media_inventory(media_inventory_id, FALSE));
CREATE POLICY "BucketPolicies - owner read"
  ON public.inventory_bucket_policies FOR SELECT TO authenticated
  USING (public.can_access_media_inventory((SELECT media_inventory_id FROM public.inventory_capacity_periods WHERE id = capacity_period_id), FALSE));
CREATE POLICY "PreferredParticipants - owner read"
  ON public.inventory_preferred_participants FOR SELECT TO authenticated
  USING (public.can_access_media_inventory(inventory_id, FALSE));
CREATE POLICY "InventoryAllocations - owner read"
  ON public.inventory_allocations FOR SELECT TO authenticated
  USING (public.can_access_media_inventory(inventory_id, FALSE));
CREATE POLICY "InventoryAudit - owner read"
  ON public.inventory_audit_logs FOR SELECT TO authenticated
  USING (inventory_id IS NOT NULL AND public.can_access_media_inventory(inventory_id, FALSE));

CREATE OR REPLACE FUNCTION public.validate_media_inventory_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_owner UUID;
BEGIN
  IF NEW.source_type = 'company_screen' THEN
    SELECT company_id INTO v_owner FROM public.screens WHERE id = NEW.source_id;
    IF v_owner IS NULL OR NEW.owner_type <> 'company' OR NEW.owner_id <> v_owner THEN
      RAISE EXCEPTION 'Inventário não corresponde à tela empresarial de origem.';
    END IF;
  ELSIF NEW.source_type = 'organic_screen' THEN
    SELECT participant_id INTO v_owner FROM public.organic_screens WHERE id = NEW.source_id;
    IF v_owner IS NULL OR NEW.owner_type <> 'organic_participant' OR NEW.owner_id <> v_owner THEN
      RAISE EXCEPTION 'Inventário não corresponde à tela orgânica de origem.';
    END IF;
  ELSIF NEW.source_type IN ('social_channel', 'creator_channel', 'event_slot', 'future') THEN
    RAISE EXCEPTION 'Source futuro ainda não pode ser ativado no Pacote 1.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_media_inventory_source
  BEFORE INSERT OR UPDATE OF owner_type, owner_id, source_type, source_id ON public.media_inventory
  FOR EACH ROW EXECUTE FUNCTION public.validate_media_inventory_source();

CREATE OR REPLACE FUNCTION public.sync_company_screen_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_city TEXT; v_state TEXT; v_inventory_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.media_inventory SET status = 'archived', commercial_enabled = FALSE, updated_at = NOW()
    WHERE source_type = 'company_screen' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT city, state INTO v_city, v_state FROM public.companies WHERE id = NEW.company_id;
  INSERT INTO public.media_inventory(
    owner_type, owner_id, source_type, source_id, channel_family, inventory_type,
    status, city, state, orientation, proof_method, commercial_enabled
  ) VALUES (
    'company', NEW.company_id, 'company_screen', NEW.id, 'indoor', NEW.device_type,
    CASE WHEN NEW.status = 'inactive' THEN 'inactive' ELSE 'active' END,
    v_city, v_state, NEW.orientation, 'proof_of_play', FALSE
  ) ON CONFLICT (source_type, source_id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id, inventory_type = EXCLUDED.inventory_type,
    status = EXCLUDED.status, city = EXCLUDED.city, state = EXCLUDED.state,
    orientation = EXCLUDED.orientation, updated_at = NOW()
  RETURNING id INTO v_inventory_id;
  INSERT INTO public.inventory_audit_logs(inventory_id, action, details)
  VALUES(v_inventory_id, CASE WHEN TG_OP = 'INSERT' THEN 'INVENTORY_CREATED' ELSE 'INVENTORY_SOURCE_SYNCED' END,
    jsonb_build_object('source_type', 'company_screen', 'source_id', NEW.id));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_organic_screen_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_city TEXT; v_state TEXT; v_inventory_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.media_inventory SET status = 'archived', commercial_enabled = FALSE, updated_at = NOW()
    WHERE source_type = 'organic_screen' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT city, state INTO v_city, v_state FROM public.organic_participants WHERE id = NEW.participant_id;
  INSERT INTO public.media_inventory(
    owner_type, owner_id, source_type, source_id, channel_family, inventory_type,
    status, city, state, orientation, proof_method, commercial_enabled
  ) VALUES (
    'organic_participant', NEW.participant_id, 'organic_screen', NEW.id, 'indoor', NEW.device_type,
    CASE WHEN NEW.status IN ('blocked', 'paused') THEN 'paused' ELSE 'active' END,
    v_city, v_state, NEW.orientation, 'proof_of_play', FALSE
  ) ON CONFLICT (source_type, source_id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id, inventory_type = EXCLUDED.inventory_type,
    status = EXCLUDED.status, city = EXCLUDED.city, state = EXCLUDED.state,
    orientation = EXCLUDED.orientation, updated_at = NOW()
  RETURNING id INTO v_inventory_id;
  INSERT INTO public.inventory_audit_logs(inventory_id, action, details)
  VALUES(v_inventory_id, CASE WHEN TG_OP = 'INSERT' THEN 'INVENTORY_CREATED' ELSE 'INVENTORY_SOURCE_SYNCED' END,
    jsonb_build_object('source_type', 'organic_screen', 'source_id', NEW.id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_company_screen_inventory
  AFTER INSERT OR UPDATE OF company_id, device_type, status, orientation ON public.screens
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_screen_inventory();
CREATE TRIGGER trg_archive_company_screen_inventory
  AFTER DELETE ON public.screens FOR EACH ROW EXECUTE FUNCTION public.sync_company_screen_inventory();
CREATE TRIGGER trg_sync_organic_screen_inventory
  AFTER INSERT OR UPDATE OF participant_id, device_type, status, orientation ON public.organic_screens
  FOR EACH ROW EXECUTE FUNCTION public.sync_organic_screen_inventory();
CREATE TRIGGER trg_archive_organic_screen_inventory
  AFTER DELETE ON public.organic_screens FOR EACH ROW EXECUTE FUNCTION public.sync_organic_screen_inventory();

-- Backfill aditivo; não habilita comercialização nem altera as tabelas-fonte.
INSERT INTO public.media_inventory(owner_type, owner_id, source_type, source_id, channel_family, inventory_type, status, city, state, orientation, proof_method, commercial_enabled)
SELECT 'company', s.company_id, 'company_screen', s.id, 'indoor', s.device_type,
  CASE WHEN s.status = 'inactive' THEN 'inactive' ELSE 'active' END,
  c.city, c.state, s.orientation, 'proof_of_play', FALSE
FROM public.screens s JOIN public.companies c ON c.id = s.company_id
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.media_inventory(owner_type, owner_id, source_type, source_id, channel_family, inventory_type, status, city, state, orientation, proof_method, commercial_enabled)
SELECT 'organic_participant', s.participant_id, 'organic_screen', s.id, 'indoor', s.device_type,
  CASE WHEN s.status IN ('blocked', 'paused') THEN 'paused' ELSE 'active' END,
  p.city, p.state, s.orientation, 'proof_of_play', FALSE
FROM public.organic_screens s JOIN public.organic_participants p ON p.id = s.participant_id
ON CONFLICT (source_type, source_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_inventory_capacity_counters(p_capacity_period_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_reserved BIGINT; v_committed BIGINT; v_delivered BIGINT; v_consumed BIGINT; v_theoretical BIGINT;
BEGIN
  SELECT theoretical_capacity INTO v_theoretical FROM public.inventory_capacity_periods WHERE id = p_capacity_period_id FOR UPDATE;
  SELECT
    COALESCE(SUM(reserved_quantity) FILTER (WHERE status IN ('reserved', 'committed', 'partially_consumed')), 0),
    COALESCE(SUM(reserved_quantity) FILTER (WHERE status IN ('committed', 'partially_consumed', 'consumed')), 0),
    COALESCE(SUM(consumed_quantity), 0),
    COALESCE(SUM(insertion_quantity) FILTER (WHERE status NOT IN ('draft', 'released', 'expired', 'cancelled')), 0)
  INTO v_reserved, v_committed, v_delivered, v_consumed
  FROM public.inventory_allocations WHERE capacity_period_id = p_capacity_period_id;

  UPDATE public.inventory_capacity_periods SET
    reserved_capacity = v_reserved,
    committed_capacity = v_committed,
    delivered_capacity = v_delivered,
    available_capacity = GREATEST(0, v_theoretical - v_consumed),
    updated_at = NOW()
  WHERE id = p_capacity_period_id;

  UPDATE public.inventory_bucket_policies b SET
    allocated_quantity = COALESCE((
      SELECT SUM(a.insertion_quantity) FROM public.inventory_allocations a
      WHERE a.bucket_policy_id = b.id AND a.status NOT IN ('draft', 'released', 'expired', 'cancelled')
    ), 0), updated_at = NOW()
  WHERE b.capacity_period_id = p_capacity_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_inventory_bucket_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_theoretical BIGINT; v_total BIGINT; v_inventory_id UUID;
BEGIN
  SELECT theoretical_capacity, media_inventory_id INTO v_theoretical, v_inventory_id
  FROM public.inventory_capacity_periods WHERE id = NEW.capacity_period_id FOR UPDATE;
  IF v_theoretical IS NULL THEN RAISE EXCEPTION 'Período de capacidade inexistente.'; END IF;
  IF NEW.bucket_type = 'mpm_growth' AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Bolsão MPM Growth é exclusivo do Master Admin.';
  END IF;
  SELECT COALESCE(SUM(capacity_quantity), 0) INTO v_total
  FROM public.inventory_bucket_policies
  WHERE capacity_period_id = NEW.capacity_period_id AND id IS DISTINCT FROM NEW.id
    AND status NOT IN ('expired', 'cancelled');
  IF v_total + NEW.capacity_quantity > v_theoretical THEN
    INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, action, actor_id, details)
    VALUES(v_inventory_id, NEW.capacity_period_id, 'OVERBOOKING_REJECTED', auth.uid(),
      jsonb_build_object('kind', 'bucket', 'requested', NEW.capacity_quantity, 'current', v_total, 'capacity', v_theoretical));
    RAISE EXCEPTION 'Soma dos bolsões excede a capacidade do período.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_inventory_bucket_capacity
  BEFORE INSERT OR UPDATE OF capacity_period_id, capacity_quantity, bucket_type, status
  ON public.inventory_bucket_policies FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_bucket_capacity();

CREATE OR REPLACE FUNCTION public.refresh_inventory_bucket_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_period_id UUID := COALESCE(NEW.capacity_period_id, OLD.capacity_period_id);
BEGIN
  UPDATE public.inventory_capacity_periods cp SET
    own_use_capacity = COALESCE((SELECT SUM(capacity_quantity) FROM public.inventory_bucket_policies WHERE capacity_period_id = v_period_id AND bucket_type = 'own_use' AND status NOT IN ('expired', 'cancelled')), 0),
    network_capacity = COALESCE((SELECT SUM(capacity_quantity) FROM public.inventory_bucket_policies WHERE capacity_period_id = v_period_id AND bucket_type <> 'own_use' AND status NOT IN ('expired', 'cancelled')), 0),
    updated_at = NOW()
  WHERE cp.id = v_period_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_refresh_inventory_bucket_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_bucket_policies
  FOR EACH ROW EXECUTE FUNCTION public.refresh_inventory_bucket_totals();

CREATE OR REPLACE FUNCTION public.validate_inventory_allocation_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period public.inventory_capacity_periods%ROWTYPE;
  v_bucket public.inventory_bucket_policies%ROWTYPE;
  v_period_used BIGINT;
  v_bucket_used BIGINT;
  v_expected_bucket TEXT;
BEGIN
  SELECT * INTO v_period FROM public.inventory_capacity_periods WHERE id = NEW.capacity_period_id FOR UPDATE;
  SELECT * INTO v_bucket FROM public.inventory_bucket_policies WHERE id = NEW.bucket_policy_id FOR UPDATE;
  IF v_period.id IS NULL OR v_bucket.id IS NULL OR v_bucket.capacity_period_id <> v_period.id OR NEW.inventory_id <> v_period.media_inventory_id THEN
    RAISE EXCEPTION 'Reserva, período, bolsão e inventário não correspondem.';
  END IF;
  IF v_period.status <> 'active' OR v_bucket.status <> 'active' THEN
    RAISE EXCEPTION 'Período ou bolsão não está ativo.';
  END IF;

  v_expected_bucket := CASE NEW.allocation_type
    WHEN 'commercial_reservation' THEN 'automatic_pool' ELSE NEW.allocation_type END;
  IF v_bucket.bucket_type <> v_expected_bucket THEN
    RAISE EXCEPTION 'Tipo de reserva incompatível com o bolsão.';
  END IF;
  IF NEW.starts_at::date < v_period.period_start OR NEW.ends_at::date > v_period.period_end THEN
    RAISE EXCEPTION 'Janela da reserva fora do período de capacidade.';
  END IF;

  IF NEW.status NOT IN ('draft', 'released', 'expired', 'cancelled') THEN
    SELECT COALESCE(SUM(insertion_quantity), 0) INTO v_period_used
    FROM public.inventory_allocations
    WHERE capacity_period_id = NEW.capacity_period_id
      AND id IS DISTINCT FROM NEW.id
      AND status NOT IN ('draft', 'released', 'expired', 'cancelled');
    SELECT COALESCE(SUM(insertion_quantity), 0) INTO v_bucket_used
    FROM public.inventory_allocations
    WHERE bucket_policy_id = NEW.bucket_policy_id
      AND id IS DISTINCT FROM NEW.id
      AND status NOT IN ('draft', 'released', 'expired', 'cancelled');

    IF v_period_used + NEW.insertion_quantity > v_period.theoretical_capacity
       OR v_bucket_used + NEW.insertion_quantity > v_bucket.capacity_quantity THEN
      INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, action, actor_id, details)
      VALUES(NEW.inventory_id, NEW.capacity_period_id, 'OVERBOOKING_REJECTED', auth.uid(),
        jsonb_build_object('kind', 'allocation', 'requested', NEW.insertion_quantity,
          'period_used', v_period_used, 'period_capacity', v_period.theoretical_capacity,
          'bucket_used', v_bucket_used, 'bucket_capacity', v_bucket.capacity_quantity));
      RAISE EXCEPTION 'Reserva recusada por overbooking.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_inventory_allocation_capacity
  BEFORE INSERT OR UPDATE OF inventory_id, capacity_period_id, bucket_policy_id, allocation_type, insertion_quantity, status, starts_at, ends_at
  ON public.inventory_allocations FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_allocation_capacity();

CREATE OR REPLACE FUNCTION public.after_inventory_allocation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.refresh_inventory_capacity_counters(COALESCE(NEW.capacity_period_id, OLD.capacity_period_id));
  INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, allocation_id, action, actor_id, details)
  VALUES(COALESCE(NEW.inventory_id, OLD.inventory_id), COALESCE(NEW.capacity_period_id, OLD.capacity_period_id),
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'ALLOCATION_CREATED' ELSE 'ALLOCATION_CHANGED' END,
    auth.uid(), jsonb_build_object('operation', TG_OP, 'status', COALESCE(NEW.status, OLD.status)));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_after_inventory_allocation_change
  AFTER INSERT OR UPDATE ON public.inventory_allocations
  FOR EACH ROW EXECUTE FUNCTION public.after_inventory_allocation_change();

CREATE OR REPLACE FUNCTION public.validate_preferred_participant_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_limit INTEGER; v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.inventory_id::text, 0));
  SELECT GREATEST(0, COALESCE((value #>> '{}')::INTEGER, 3)) INTO v_limit
  FROM public.platform_settings WHERE key = 'inventory_preferred_limit';
  v_limit := COALESCE(v_limit, 3);
  SELECT COUNT(*) INTO v_count FROM public.inventory_preferred_participants
  WHERE inventory_id = NEW.inventory_id AND id IS DISTINCT FROM NEW.id
    AND status = 'active' AND tstzrange(starts_at, ends_at, '[]') && tstzrange(NEW.starts_at, NEW.ends_at, '[]');
  IF NEW.status = 'active' AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite configurado de % preferenciais atingido.', v_limit;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_preferred_participant_limit
  BEFORE INSERT OR UPDATE OF inventory_id, starts_at, ends_at, status
  ON public.inventory_preferred_participants FOR EACH ROW EXECUTE FUNCTION public.validate_preferred_participant_limit();

CREATE OR REPLACE FUNCTION public.upsert_inventory_capacity_period(
  p_inventory_id UUID, p_period_start DATE, p_period_end DATE,
  p_theoretical_capacity BIGINT, p_own_use_capacity BIGINT, p_network_capacity BIGINT,
  p_calculation_source TEXT, p_calculation_inputs JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id UUID; v_old JSONB; v_used BIGINT; v_bucket_total BIGINT;
BEGIN
  IF NOT public.is_inventory_feature_enabled('inventory_capacity_v2') THEN RAISE EXCEPTION 'inventory_capacity_v2 desabilitado.'; END IF;
  IF NOT public.can_access_media_inventory(p_inventory_id, TRUE) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_period_end < p_period_start OR p_theoretical_capacity < 0 OR p_own_use_capacity < 0 OR p_network_capacity < 0
     OR p_own_use_capacity + p_network_capacity > p_theoretical_capacity
     OR p_calculation_source NOT IN ('manual', 'estimated', 'calculated') THEN
    RAISE EXCEPTION 'Parâmetros de capacidade inválidos.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_inventory_id::text || p_period_start::text || p_period_end::text, 0));
  SELECT id, to_jsonb(cp) INTO v_id, v_old FROM public.inventory_capacity_periods cp
  WHERE media_inventory_id = p_inventory_id AND period_start = p_period_start AND period_end = p_period_end FOR UPDATE;
  IF v_id IS NOT NULL THEN
    SELECT COALESCE(SUM(insertion_quantity), 0) INTO v_used FROM public.inventory_allocations
    WHERE capacity_period_id = v_id AND status NOT IN ('draft', 'released', 'expired', 'cancelled');
    SELECT COALESCE(SUM(capacity_quantity), 0) INTO v_bucket_total
    FROM public.inventory_bucket_policies WHERE capacity_period_id = v_id AND status NOT IN ('expired', 'cancelled');
    IF p_theoretical_capacity < v_used THEN RAISE EXCEPTION 'Nova capacidade é menor que reservas/entregas existentes.'; END IF;
    IF p_theoretical_capacity < v_bucket_total THEN RAISE EXCEPTION 'Nova capacidade é menor que a soma dos bolsões existentes.'; END IF;
    UPDATE public.inventory_capacity_periods SET
      calculation_source = p_calculation_source, calculation_version = calculation_version + 1,
      calculation_inputs = COALESCE(p_calculation_inputs, '{}'::jsonb), theoretical_capacity = p_theoretical_capacity,
      own_use_capacity = p_own_use_capacity, network_capacity = p_network_capacity,
      available_capacity = p_theoretical_capacity - v_used, updated_at = NOW()
    WHERE id = v_id;
    INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, action, actor_id, details)
    VALUES(p_inventory_id, v_id, 'CAPACITY_RECALCULATED', auth.uid(), jsonb_build_object('before', v_old, 'source', p_calculation_source));
  ELSE
    INSERT INTO public.inventory_capacity_periods(
      media_inventory_id, period_start, period_end, cycle_type, calculation_source, calculation_inputs,
      theoretical_capacity, own_use_capacity, network_capacity, available_capacity, created_by
    ) VALUES(
      p_inventory_id, p_period_start, p_period_end,
      CASE WHEN p_period_start = date_trunc('month', p_period_start)::date AND p_period_end = (date_trunc('month', p_period_start) + interval '1 month - 1 day')::date THEN 'monthly' ELSE 'custom' END,
      p_calculation_source, COALESCE(p_calculation_inputs, '{}'::jsonb), p_theoretical_capacity,
      p_own_use_capacity, p_network_capacity, p_theoretical_capacity, auth.uid()
    ) RETURNING id INTO v_id;
    INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, action, actor_id, details)
    VALUES(p_inventory_id, v_id, 'CAPACITY_CREATED', auth.uid(), jsonb_build_object('source', p_calculation_source, 'capacity', p_theoretical_capacity));
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_inventory_bucket_policy(
  p_capacity_period_id UUID, p_bucket_type TEXT, p_capacity_quantity BIGINT,
  p_release_unused BOOLEAN DEFAULT FALSE, p_release_after_day SMALLINT DEFAULT NULL,
  p_release_lead_days SMALLINT DEFAULT NULL, p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_inventory_id UUID; v_id UUID;
BEGIN
  IF NOT public.is_inventory_feature_enabled('inventory_allocations_v2') THEN RAISE EXCEPTION 'inventory_allocations_v2 desabilitado.'; END IF;
  SELECT media_inventory_id INTO v_inventory_id FROM public.inventory_capacity_periods WHERE id = p_capacity_period_id;
  IF NOT public.can_access_media_inventory(v_inventory_id, TRUE) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_bucket_type IN ('partnership', 'mpm_growth') AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Bolsão de parceria/MPM Growth é exclusivo do Master Admin.';
  END IF;
  IF p_bucket_type = 'mpm_growth' AND NOT public.is_inventory_feature_enabled('inventory_growth_enabled') THEN
    RAISE EXCEPTION 'MPM Growth não autorizado pela feature flag.';
  END IF;
  INSERT INTO public.inventory_bucket_policies(
    capacity_period_id, bucket_type, capacity_quantity, release_unused_owner_capacity,
    release_after_day, release_lead_days, release_to_bucket, reason, created_by
  ) VALUES(
    p_capacity_period_id, p_bucket_type, p_capacity_quantity,
    CASE WHEN p_bucket_type = 'own_use' THEN p_release_unused ELSE FALSE END,
    CASE WHEN p_bucket_type = 'own_use' THEN p_release_after_day ELSE NULL END,
    CASE WHEN p_bucket_type = 'own_use' THEN p_release_lead_days ELSE NULL END,
    CASE WHEN p_bucket_type = 'own_use' AND p_release_unused THEN 'automatic_pool' ELSE NULL END,
    p_reason, auth.uid()
  ) ON CONFLICT (capacity_period_id, bucket_type) DO UPDATE SET
    capacity_quantity = EXCLUDED.capacity_quantity,
    release_unused_owner_capacity = EXCLUDED.release_unused_owner_capacity,
    release_after_day = EXCLUDED.release_after_day,
    release_lead_days = EXCLUDED.release_lead_days,
    release_to_bucket = EXCLUDED.release_to_bucket,
    reason = EXCLUDED.reason, updated_at = NOW()
  RETURNING id INTO v_id;
  INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, action, actor_id, details)
  VALUES(v_inventory_id, p_capacity_period_id, 'BUCKET_CHANGED', auth.uid(), jsonb_build_object('bucket', p_bucket_type, 'capacity', p_capacity_quantity));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_inventory_allocation(
  p_inventory_id UUID, p_capacity_period_id UUID, p_bucket_policy_id UUID,
  p_allocation_type TEXT, p_beneficiary_type TEXT, p_beneficiary_id UUID,
  p_insertion_quantity BIGINT, p_starts_at TIMESTAMPTZ, p_ends_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ, p_release_policy JSONB, p_source_type TEXT,
  p_source_id UUID, p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_inventory_feature_enabled('inventory_allocations_v2') THEN RAISE EXCEPTION 'inventory_allocations_v2 desabilitado.'; END IF;
  IF NOT public.can_access_media_inventory(p_inventory_id, TRUE) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_allocation_type IN ('partnership', 'mpm_growth') AND NOT public.is_master_admin() THEN RAISE EXCEPTION 'Tipo de reserva exclusivo do Master Admin.'; END IF;
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'Chave de idempotência obrigatória.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('inventory-allocation:' || p_idempotency_key, 0));
  SELECT id INTO v_id FROM public.inventory_allocations WHERE idempotency_key = p_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.inventory_allocations(
    inventory_id, capacity_period_id, bucket_policy_id, allocation_type,
    beneficiary_type, beneficiary_id, insertion_quantity, reserved_quantity,
    starts_at, ends_at, expires_at, release_policy, source_type, source_id,
    idempotency_key, created_by
  ) VALUES(
    p_inventory_id, p_capacity_period_id, p_bucket_policy_id, p_allocation_type,
    p_beneficiary_type, p_beneficiary_id, p_insertion_quantity, p_insertion_quantity,
    p_starts_at, p_ends_at, p_expires_at, COALESCE(p_release_policy, '{}'::jsonb),
    p_source_type, p_source_id, p_idempotency_key, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_inventory_allocation(p_allocation_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_allocation public.inventory_allocations%ROWTYPE;
BEGIN
  SELECT * INTO v_allocation FROM public.inventory_allocations WHERE id = p_allocation_id FOR UPDATE;
  IF NOT public.can_access_media_inventory(v_allocation.inventory_id, TRUE) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF v_allocation.status IN ('consumed', 'released', 'expired', 'cancelled') THEN RETURN FALSE; END IF;
  UPDATE public.inventory_allocations SET status = 'cancelled', release_policy = release_policy || jsonb_build_object('cancellation_reason', p_reason), updated_at = NOW()
  WHERE id = p_allocation_id;
  INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, allocation_id, action, actor_id, details)
  VALUES(v_allocation.inventory_id, v_allocation.capacity_period_id, v_allocation.id, 'ALLOCATION_CANCELLED', auth.uid(), jsonb_build_object('reason', p_reason));
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_unused_owner_capacity(p_capacity_period_id UUID, p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_period public.inventory_capacity_periods%ROWTYPE; v_own public.inventory_bucket_policies%ROWTYPE; v_pool public.inventory_bucket_policies%ROWTYPE; v_unused BIGINT; v_consumed BIGINT;
BEGIN
  SELECT * INTO v_period FROM public.inventory_capacity_periods WHERE id = p_capacity_period_id FOR UPDATE;
  IF NOT public.can_access_media_inventory(v_period.media_inventory_id, TRUE) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO v_own FROM public.inventory_bucket_policies WHERE capacity_period_id = p_capacity_period_id AND bucket_type = 'own_use' FOR UPDATE;
  IF v_own.id IS NULL OR NOT v_own.release_unused_owner_capacity THEN RETURN 0; END IF;
  IF (v_own.release_after_day IS NULL OR EXTRACT(DAY FROM p_now) < v_own.release_after_day)
     AND (v_own.release_lead_days IS NULL OR p_now::date < v_period.period_end - v_own.release_lead_days) THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(consumed_quantity), 0) INTO v_consumed FROM public.inventory_allocations WHERE bucket_policy_id = v_own.id;
  v_unused := GREATEST(0, v_own.capacity_quantity - v_consumed);
  IF v_unused = 0 THEN RETURN 0; END IF;
  SELECT * INTO v_pool FROM public.inventory_bucket_policies WHERE capacity_period_id = p_capacity_period_id AND bucket_type = 'automatic_pool' FOR UPDATE;
  UPDATE public.inventory_allocations SET
    insertion_quantity = CASE WHEN consumed_quantity > 0 THEN consumed_quantity ELSE insertion_quantity END,
    reserved_quantity = consumed_quantity,
    status = CASE WHEN consumed_quantity > 0 THEN 'consumed' ELSE 'released' END, updated_at = NOW()
  WHERE bucket_policy_id = v_own.id AND status IN ('reserved', 'committed', 'partially_consumed');
  UPDATE public.inventory_bucket_policies SET capacity_quantity = v_consumed, updated_at = NOW() WHERE id = v_own.id;
  IF v_pool.id IS NULL THEN
    INSERT INTO public.inventory_bucket_policies(capacity_period_id, bucket_type, capacity_quantity, reason, created_by)
    VALUES(p_capacity_period_id, 'automatic_pool', v_unused, 'Liberação automática de own_use', auth.uid()) RETURNING * INTO v_pool;
  ELSE
    UPDATE public.inventory_bucket_policies SET capacity_quantity = capacity_quantity + v_unused, updated_at = NOW() WHERE id = v_pool.id;
  END IF;
  INSERT INTO public.inventory_audit_logs(inventory_id, capacity_period_id, action, actor_id, details)
  VALUES(v_period.media_inventory_id, p_capacity_period_id, 'OWNER_CAPACITY_RELEASED', auth.uid(), jsonb_build_object('quantity', v_unused, 'to', 'automatic_pool'));
  RETURN v_unused;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_inventory_preferred_participant(
  p_inventory_id UUID, p_preferred_company_id UUID, p_priority SMALLINT,
  p_max_insertions BIGINT, p_starts_at TIMESTAMPTZ, p_ends_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_inventory_feature_enabled('inventory_allocations_v2') THEN RAISE EXCEPTION 'inventory_allocations_v2 desabilitado.'; END IF;
  IF NOT public.can_access_media_inventory(p_inventory_id, TRUE) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  INSERT INTO public.inventory_preferred_participants(inventory_id, preferred_company_id, priority, max_insertions, starts_at, ends_at, created_by)
  VALUES(p_inventory_id, p_preferred_company_id, p_priority, p_max_insertions, p_starts_at, p_ends_at, auth.uid())
  ON CONFLICT (inventory_id, preferred_company_id, starts_at, ends_at) DO UPDATE SET
    priority = EXCLUDED.priority, max_insertions = EXCLUDED.max_insertions, status = 'active', updated_at = NOW()
  RETURNING id INTO v_id;
  INSERT INTO public.inventory_audit_logs(inventory_id, action, actor_id, details)
  VALUES(p_inventory_id, 'PREFERRED_PARTICIPANT_CHANGED', auth.uid(), jsonb_build_object('preferred_company_id', p_preferred_company_id, 'priority', p_priority, 'max_insertions', p_max_insertions));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_inventory_allocations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Execução exclusiva do service_role.'; END IF;
  WITH changed AS (
    UPDATE public.inventory_allocations SET status = 'expired', updated_at = NOW()
    WHERE status IN ('reserved', 'committed', 'partially_consumed') AND expires_at IS NOT NULL AND expires_at <= NOW()
    RETURNING id
  ) SELECT COUNT(*) INTO v_count FROM changed;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_media_inventory_commercial_enabled(p_inventory_id UUID, p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_inventory public.media_inventory%ROWTYPE;
BEGIN
  IF NOT public.is_inventory_feature_enabled('media_inventory_v2') THEN RAISE EXCEPTION 'media_inventory_v2 desabilitado.'; END IF;
  IF NOT public.can_access_media_inventory(p_inventory_id, TRUE) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO v_inventory FROM public.media_inventory WHERE id = p_inventory_id FOR UPDATE;
  IF v_inventory.owner_type <> 'company' THEN RAISE EXCEPTION 'Participação comercial orgânica não é habilitada neste pacote.'; END IF;
  UPDATE public.media_inventory SET commercial_enabled = p_enabled, updated_at = NOW() WHERE id = p_inventory_id;
  INSERT INTO public.company_network_preferences(company_id, participates_in_network, updated_at)
  VALUES(v_inventory.owner_id, p_enabled, NOW())
  ON CONFLICT (company_id) DO UPDATE SET participates_in_network = EXCLUDED.participates_in_network, updated_at = NOW();
  INSERT INTO public.inventory_audit_logs(inventory_id, action, actor_id, details)
  VALUES(p_inventory_id, CASE WHEN p_enabled THEN 'INVENTORY_ENABLED' ELSE 'INVENTORY_DISABLED' END, auth.uid(), '{}'::jsonb);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.configure_inventory_period(
  p_inventory_id UUID, p_period_start DATE, p_period_end DATE,
  p_theoretical_capacity BIGINT, p_calculation_source TEXT, p_calculation_inputs JSONB,
  p_own_use BIGINT, p_preferred BIGINT, p_partnership BIGINT,
  p_mpm_growth BIGINT, p_automatic_pool BIGINT,
  p_release_unused BOOLEAN, p_release_after_day SMALLINT, p_release_lead_days SMALLINT,
  p_growth_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_period_id UUID; v_existing_partnership BIGINT := 0; v_existing_growth BIGINT := 0;
BEGIN
  IF p_own_use < 0 OR p_preferred < 0 OR p_partnership < 0 OR p_mpm_growth < 0 OR p_automatic_pool < 0
     OR p_own_use + p_preferred + p_partnership + p_mpm_growth + p_automatic_pool > p_theoretical_capacity THEN
    RAISE EXCEPTION 'Soma dos bolsões excede a capacidade informada.';
  END IF;
  v_period_id := public.upsert_inventory_capacity_period(
    p_inventory_id, p_period_start, p_period_end, p_theoretical_capacity,
    p_own_use, p_preferred + p_partnership + p_mpm_growth + p_automatic_pool,
    p_calculation_source, p_calculation_inputs
  );

  SELECT COALESCE(MAX(capacity_quantity) FILTER (WHERE bucket_type = 'partnership'), 0),
         COALESCE(MAX(capacity_quantity) FILTER (WHERE bucket_type = 'mpm_growth'), 0)
  INTO v_existing_partnership, v_existing_growth
  FROM public.inventory_bucket_policies WHERE capacity_period_id = v_period_id;

  IF NOT public.is_master_admin() AND (p_partnership <> v_existing_partnership OR p_mpm_growth <> v_existing_growth) THEN
    RAISE EXCEPTION 'Parceria e MPM Growth só podem ser alterados pelo Master Admin.';
  END IF;

  PERFORM public.set_inventory_bucket_policy(v_period_id, 'own_use', p_own_use, p_release_unused, p_release_after_day, p_release_lead_days, 'Reserva de uso próprio');
  PERFORM public.set_inventory_bucket_policy(v_period_id, 'preferred', p_preferred, FALSE, NULL, NULL, 'Empresas preferenciais');
  IF public.is_master_admin() THEN
    PERFORM public.set_inventory_bucket_policy(v_period_id, 'partnership', p_partnership, FALSE, NULL, NULL, 'Cotas de parceria');
    IF p_mpm_growth > 0 OR v_existing_growth > 0 THEN
      PERFORM public.set_inventory_bucket_policy(v_period_id, 'mpm_growth', p_mpm_growth, FALSE, NULL, NULL, COALESCE(NULLIF(trim(p_growth_reason), ''), 'Estratégia MPM configurada pelo Master'));
    END IF;
  END IF;
  PERFORM public.set_inventory_bucket_policy(v_period_id, 'automatic_pool', p_automatic_pool, FALSE, NULL, NULL, 'Pool automático');
  RETURN v_period_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_inventory_feature_enabled(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_inventory_feature_enabled(TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_inventory_capacity_period(UUID, DATE, DATE, BIGINT, BIGINT, BIGINT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_inventory_capacity_period(UUID, DATE, DATE, BIGINT, BIGINT, BIGINT, TEXT, JSONB) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_inventory_bucket_policy(UUID, TEXT, BIGINT, BOOLEAN, SMALLINT, SMALLINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_inventory_bucket_policy(UUID, TEXT, BIGINT, BOOLEAN, SMALLINT, SMALLINT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_inventory_allocation(UUID, UUID, UUID, TEXT, TEXT, UUID, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_inventory_allocation(UUID, UUID, UUID, TEXT, TEXT, UUID, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_inventory_allocation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_inventory_allocation(UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_unused_owner_capacity(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_unused_owner_capacity(UUID, TIMESTAMPTZ) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_inventory_preferred_participant(UUID, UUID, SMALLINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_inventory_preferred_participant(UUID, UUID, SMALLINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.expire_inventory_allocations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_inventory_allocations() TO service_role;
REVOKE ALL ON FUNCTION public.set_media_inventory_commercial_enabled(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_media_inventory_commercial_enabled(UUID, BOOLEAN) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.configure_inventory_period(UUID, DATE, DATE, BIGINT, TEXT, JSONB, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, SMALLINT, SMALLINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configure_inventory_period(UUID, DATE, DATE, BIGINT, TEXT, JSONB, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, SMALLINT, SMALLINT, TEXT) TO authenticated, service_role;

COMMENT ON TABLE public.media_inventory IS 'Camada superior de inventário; referencia screens/organic_screens sem duplicar sua operação.';
COMMENT ON TABLE public.inventory_capacity_periods IS 'Capacidade auditável por ciclo. Nenhum valor comercial de 30.000 é universal ou hardcoded.';
COMMENT ON TABLE public.inventory_allocations IS 'Reserva/cota/direito de capacidade. Não é entrega e nunca gera Crédito MPM neste pacote.';
COMMENT ON FUNCTION public.validate_inventory_allocation_capacity() IS 'Lock pessimista do período e bolsão; impede overbooking inclusive por service_role.';
