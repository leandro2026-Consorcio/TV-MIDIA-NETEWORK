-- Canonical civil timezone for advertiser-owned campaign DATE fields.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS timezone TEXT;

UPDATE public.companies
SET timezone = 'America/Cuiaba'
WHERE timezone IS NULL OR btrim(timezone) = '';

ALTER TABLE public.companies
  ALTER COLUMN timezone SET DEFAULT 'America/Cuiaba',
  ALTER COLUMN timezone SET NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_company_timezone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Timezone IANA inválido: %', NEW.timezone;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_company_timezone ON public.companies;
CREATE TRIGGER trg_validate_company_timezone
  BEFORE INSERT OR UPDATE OF timezone ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_timezone();

REVOKE ALL ON FUNCTION public.validate_company_timezone() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.company_civil_date(
  p_company_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS DATE
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (p_at AT TIME ZONE COALESCE(
    (SELECT NULLIF(btrim(c.timezone), '') FROM public.companies c WHERE c.id = p_company_id),
    'America/Cuiaba'
  ))::date;
$$;

REVOKE ALL ON FUNCTION public.company_civil_date(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_civil_date(UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- Preserve each mature function and replace only its civil-date predicate.
DO $migration$
DECLARE
  v_before TEXT;
  v_after TEXT;
BEGIN
  SELECT pg_get_functiondef('public.create_campaign_screen_marketplace_request(uuid,uuid,uuid,uuid,text)'::regprocedure) INTO v_before;
  v_after := regexp_replace(
    v_before,
    '\(now\(\) AT TIME ZONE ''America/Cuiaba''\)::date',
    'public.company_civil_date(v_campaign.company_id)',
    'i'
  );
  IF v_after = v_before THEN
    RAISE EXCEPTION 'Predicado civil esperado da solicitação não encontrado.';
  END IF;
  EXECUTE v_after;

  SELECT pg_get_functiondef('public.is_authorized_commercial_distribution(uuid,uuid,uuid)'::regprocedure) INTO v_before;
  v_after := regexp_replace(v_before, '\mCURRENT_DATE\M', 'public.company_civil_date(c.company_id)', 'gi');
  IF v_after = v_before THEN
    RAISE EXCEPTION 'Predicado CURRENT_DATE esperado da autorização não encontrado.';
  END IF;
  EXECUTE v_after;

  SELECT pg_get_functiondef('public.record_playback_log(text,uuid,uuid,uuid,text,integer,numeric,timestamptz,timestamptz,text,text,text,text)'::regprocedure) INTO v_before;
  v_after := regexp_replace(v_before, '\mCURRENT_DATE\M', 'public.company_civil_date(c.company_id)', 'gi');
  IF v_after = v_before THEN
    RAISE EXCEPTION 'Predicado CURRENT_DATE esperado do playback não encontrado.';
  END IF;
  EXECUTE v_after;
END;
$migration$;
