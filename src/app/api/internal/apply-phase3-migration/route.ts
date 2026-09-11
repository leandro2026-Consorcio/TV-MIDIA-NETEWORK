import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSION = '20260911000385';
const FILE = `${VERSION}_multichannel_bidirectional_replication.sql`;
const ONE_TIME_KEY = 'mpm-f3-20260911-49d8d115-6b32-43e2-92b9-fcbfd9e5f1af';

function authorized(value: string | null) {
  if (!value) return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(ONE_TIME_KEY);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request.headers.get('x-mpm-migration-key'))) return NextResponse.json({ success: false }, { status: 401 });
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connectionString) return NextResponse.json({ success: false, error: 'Postgres indisponível.' }, { status: 500 });
  const mode = request.nextUrl.searchParams.get('mode') === 'validate' ? 'validate' : 'apply';
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const applied = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version');
    const versions = new Set(applied.rows.map((row: any) => row.version));
    const localVersions = readFileSync(join(process.cwd(), 'supabase', 'migrations', FILE), 'utf8');
    const unexpectedPending = ['20260911000382', '20260911000383', '20260911000384'].filter(version => !versions.has(version));
    if (unexpectedPending.length) return NextResponse.json({ success: false, error: 'Migrations predecessoras ausentes.', unexpectedPending }, { status: 409 });
    if (versions.has(VERSION)) return NextResponse.json({ success: true, mode, alreadyApplied: true, version: VERSION });
    await client.query('BEGIN');
    await client.query(localVersions);
    const verification = await client.query(`SELECT
      to_regclass('public.multichannel_rules') IS NOT NULL AS rules,
      to_regclass('public.propagation_events') IS NOT NULL AS events,
      to_regclass('public.propagation_targets') IS NOT NULL AS targets,
      (SELECT count(*) FROM public.platform_settings WHERE key IN
        ('multichannel_replication_enabled','social_to_tv_replication_enabled','social_crosspost_enabled','multichannel_auto_mode_enabled')
        AND value='false'::jsonb)=4 AS flags_off`);
    if (mode === 'validate') await client.query('ROLLBACK');
    else {
      await client.query('INSERT INTO supabase_migrations.schema_migrations(version) VALUES($1)', [VERSION]);
      await client.query('COMMIT');
    }
    return NextResponse.json({ success: true, mode, version: VERSION, verification: verification.rows[0] });
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch {}
    return NextResponse.json({ success: false, mode, error: error.message }, { status: 500 });
  } finally {
    await client.end().catch(() => undefined);
  }
}
