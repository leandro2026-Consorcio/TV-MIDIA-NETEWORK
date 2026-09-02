import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIGRATION_SQL = `
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'subscription_plan_prices_cents',
  '{"1-tv":2990,"2-tvs":4990,"3-tvs":6990,"4-tvs":8990,"5-tvs":9990,"additional-tv":1499}'::jsonb,
  'Preços em centavos dos planos mensais exibidos no site público.'
)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "PlatformSettings - Public read" ON public.platform_settings;
CREATE POLICY "PlatformSettings - Public read"
  ON public.platform_settings FOR SELECT TO anon, authenticated
  USING (key IN (
    'public_trial_signup_enabled',
    'public_trial_days',
    'trial_invites_count',
    'auto_approve_trial_internal_media',
    'public_signup_disabled_message',
    'subscription_plan_prices_cents'
  ));

CREATE OR REPLACE FUNCTION public.prevent_self_master_admin_elevation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF OLD.is_master_admin IS DISTINCT FROM NEW.is_master_admin
     AND auth.role() <> 'service_role'
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas Master Admins existentes podem alterar o status is_master_admin.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_master_admin_by_email(p_email TEXT, p_enabled BOOLEAN DEFAULT TRUE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Operação permitida somente ao serviço administrativo.';
  END IF;

  UPDATE public.profiles
  SET is_master_admin = p_enabled, updated_at = NOW()
  WHERE lower(email) = lower(btrim(p_email))
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado para o e-mail informado.';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (v_user_id, 'MASTER_ADMIN_ACCESS_CHANGED', jsonb_build_object('enabled', p_enabled));

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_master_admin_by_email(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_master_admin_by_email(TEXT, BOOLEAN) TO service_role;
`;

const EXPECTED_TOKEN_HASH = 'b114dc4d84158ea5fc7c9ff810f4160914cbf7f3accdf3ecdb71a29c4d66f5d1';

function tokenMatches(provided: string | null) {
  if (!provided) return false;
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = Buffer.from(EXPECTED_TOKEN_HASH, 'hex');
  return timingSafeEqual(providedHash, expectedHash);
}

export async function POST(request: NextRequest) {
  if (!tokenMatches(request.headers.get('x-migration-token'))) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connectionString) {
    return NextResponse.json({ success: false, error: 'Conexão de banco indisponível.' }, { status: 500 });
  }

  const sql = postgres(connectionString, { max: 1, prepare: false, ssl: 'require' });
  try {
    await sql.begin(async (transaction) => {
      await transaction.unsafe(MIGRATION_SQL);
    });

    const [validation] = await sql<[{ pricing_setting_exists: boolean; master_function_exists: boolean; master_admin_count: number }]>`
      SELECT
        EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'subscription_plan_prices_cents') AS pricing_setting_exists,
        to_regprocedure('public.set_master_admin_by_email(text,boolean)') IS NOT NULL AS master_function_exists,
        (SELECT count(*)::int FROM public.profiles WHERE is_master_admin = TRUE) AS master_admin_count
    `;

    return NextResponse.json({ success: true, validation });
  } catch (error) {
    console.error('Falha ao aplicar migração administrativa:', error);
    return NextResponse.json({ success: false, error: 'Falha ao aplicar migração.' }, { status: 500 });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
