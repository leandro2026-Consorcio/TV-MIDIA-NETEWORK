-- Executar com `supabase test db` após aplicar as migrations em banco local descartável.
-- O arquivo usa ROLLBACK e não deixa fixtures persistidas.
BEGIN;

DO $$
DECLARE
  v_company_id UUID;
  v_screen_id UUID;
  v_inventory_id UUID;
  v_period_id UUID;
  v_bucket_id UUID;
  v_first_allocation UUID;
  v_failed BOOLEAN;
BEGIN
  INSERT INTO public.companies(trade_name, city, state)
  VALUES('Package 1 DB Test', 'Cuiabá', 'MT')
  RETURNING id INTO v_company_id;

  INSERT INTO public.screens(company_id, name, orientation, status)
  VALUES(v_company_id, 'Package 1 Screen', 'horizontal', 'online')
  RETURNING id INTO v_screen_id;

  SELECT id INTO v_inventory_id
  FROM public.media_inventory
  WHERE source_type = 'company_screen' AND source_id = v_screen_id;
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: sync aditivo de media_inventory não criou o inventário.';
  END IF;

  INSERT INTO public.inventory_capacity_periods(
    media_inventory_id, period_start, period_end, calculation_source,
    theoretical_capacity, available_capacity
  ) VALUES(v_inventory_id, DATE '2099-01-01', DATE '2099-01-31', 'manual', 10, 10)
  RETURNING id INTO v_period_id;

  INSERT INTO public.inventory_bucket_policies(capacity_period_id, bucket_type, capacity_quantity, reason)
  VALUES(v_period_id, 'automatic_pool', 10, 'Teste transacional')
  RETURNING id INTO v_bucket_id;

  INSERT INTO public.inventory_allocations(
    inventory_id, capacity_period_id, bucket_policy_id, allocation_type,
    beneficiary_type, beneficiary_id, insertion_quantity, reserved_quantity,
    starts_at, ends_at, source_type, idempotency_key
  ) VALUES(
    v_inventory_id, v_period_id, v_bucket_id, 'commercial_reservation',
    'company', v_company_id, 6, 6,
    '2099-01-01T00:00:00Z', '2099-01-31T23:59:59Z', 'database_test', 'package1-idempotency'
  ) RETURNING id INTO v_first_allocation;

  v_failed := FALSE;
  BEGIN
    INSERT INTO public.inventory_allocations(
      inventory_id, capacity_period_id, bucket_policy_id, allocation_type,
      beneficiary_type, beneficiary_id, insertion_quantity, reserved_quantity,
      starts_at, ends_at, source_type, idempotency_key
    ) VALUES(
      v_inventory_id, v_period_id, v_bucket_id, 'commercial_reservation',
      'company', v_company_id, 5, 5,
      '2099-01-01T00:00:00Z', '2099-01-31T23:59:59Z', 'database_test', 'package1-overbooking'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := POSITION('overbooking' IN lower(SQLERRM)) > 0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: overbooking não foi recusado.'; END IF;

  v_failed := FALSE;
  BEGIN
    INSERT INTO public.inventory_allocations(
      inventory_id, capacity_period_id, bucket_policy_id, allocation_type,
      beneficiary_type, beneficiary_id, insertion_quantity, reserved_quantity,
      starts_at, ends_at, source_type, idempotency_key
    ) VALUES(
      v_inventory_id, v_period_id, v_bucket_id, 'commercial_reservation',
      'company', v_company_id, 1, 1,
      '2099-01-01T00:00:00Z', '2099-01-31T23:59:59Z', 'database_test', 'package1-idempotency'
    );
  EXCEPTION WHEN unique_violation THEN
    v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: idempotency_key duplicada foi aceita.'; END IF;

  v_failed := FALSE;
  BEGIN
    INSERT INTO public.media_inventory(
      owner_type, owner_id, source_type, source_id, channel_family,
      inventory_type, orientation, proof_method
    ) VALUES(
      'company', gen_random_uuid(), 'company_screen', v_screen_id, 'indoor',
      'tv', 'horizontal', 'proof_of_play'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := POSITION('não corresponde' IN lower(SQLERRM)) > 0
      OR SQLSTATE = '23505';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: ownership divergente foi aceito.'; END IF;

  IF (SELECT reserved_capacity FROM public.inventory_capacity_periods WHERE id = v_period_id) <> 6 THEN
    RAISE EXCEPTION 'FAIL: contador reservado não foi materializado.';
  END IF;

  RAISE NOTICE 'PASS: sync, ownership, overbooking, idempotência e contadores.';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'media_inventory'
      AND policyname = 'MediaInventory - owner read'
  ) THEN RAISE EXCEPTION 'FAIL: política RLS de media_inventory ausente.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_validate_playback_distribution_authority' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'FAIL: proteção cross-company do Proof of Play ausente.'; END IF;
  RAISE NOTICE 'PASS: contratos RLS e service_role guard presentes.';
END;
$$;

ROLLBACK;
