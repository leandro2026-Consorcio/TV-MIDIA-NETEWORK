import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import pg from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {};

  // 1. Test via Admin Client (PostgREST)
  const admin = createAdminClient();
  try {
    const { data: testRpc, error: rpcErr } = await (admin.rpc as any)('submit_or_update_organic_benefit', {
      p_id: null,
      p_company_id: '00000000-0000-0000-0000-000000000000',
      p_title: 'Teste Audit',
      p_description: 'Desc',
      p_category: 'Gastronomia',
      p_image_url: null,
      p_announced_unit_value: 79.9,
      p_quantity: 10,
      p_max_per_user: 1,
      p_unit_locations: ['Rua Berena, 3333'],
      p_allowed_weekdays: [1],
      p_allowed_time_start: '18:00',
      p_allowed_time_end: '22:00',
      p_min_consumption: null,
      p_coupon_validity_days: 7,
      p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      p_campaign_id: null,
      p_terms: null,
    });
    results.postgrestRpcResult = { data: testRpc, error: rpcErr };
  } catch (err: any) {
    results.postgrestRpcResult = { exception: err.message };
  }

  // 2. Direct PostgreSQL inspection if POSTGRES_URL is available
  const connStr = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (connStr) {
    let cleanConnStr = connStr;
    try {
      const parsedUrl = new URL(connStr);
      parsedUrl.searchParams.delete('sslmode');
      cleanConnStr = parsedUrl.toString();
    } catch {}

    const client = new pg.Client({
      connectionString: cleanConnStr,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      results.postgresConnected = true;

      // Inspect pg_proc
      const procRes = await client.query(`
        SELECT p.proname,
               pg_get_function_identity_arguments(p.oid) as args,
               pg_get_function_result(p.oid) as result_type,
               p.prosecdef as is_security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname ILIKE '%organic%'
      `);
      results.procs = procRes.rows;

      // Inspect routine privileges
      const privsRes = await client.query(`
        SELECT routine_name, grantee, privilege_type
        FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name ILIKE '%organic%'
      `);
      results.privileges = privsRes.rows;

      // Inspect tables
      const tablesRes = await client.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename ILIKE '%organic%'
      `);
      results.tables = tablesRes.rows.map((r) => r.tablename);

      // Inspect latest migrations
      try {
        const migsRes = await client.query(`
          SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 15
        `);
        results.migrations = migsRes.rows.map((r) => r.version);
      } catch (mErr: any) {
        results.migrationsError = mErr.message;
      }

      // Reload PostgREST schema cache
      await client.query("NOTIFY pgrst, 'reload schema';");
      results.notifiedPgrst = true;

      await client.end();
    } catch (dbErr: any) {
      results.postgresError = dbErr.message;
    }
  } else {
    results.postgresConnected = false;
    results.reason = 'No POSTGRES_URL found in environment';
  }

  return NextResponse.json(results);
}
