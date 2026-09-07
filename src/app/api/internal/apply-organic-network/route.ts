import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const EXPECTED_TOKEN_HASH = 'b114dc4d84158ea5fc7c9ff810f4160914cbf7f3accdf3ecdb71a29c4d66f5d1';
const FILES = [
  '20260907000050_screen_device_types.sql',
  '20260907000060_monitor_credit_ratio.sql',
  '20260907000070_organic_network.sql',
];

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-migration-token') || '';
  const received = crypto.createHash('sha256').update(token).digest('hex');
  if (!token || received !== EXPECTED_TOKEN_HASH) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const databaseUrl = process.env.POSTGRES_URL_NON_POOLING;
  if (!databaseUrl) return NextResponse.json({ error: 'database_not_configured' }, { status: 503 });
  const sql = postgres(databaseUrl, { ssl: 'require', max: 1, prepare: false });
  try {
    for (const file of FILES) {
      const source = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', file), 'utf8');
      await sql.unsafe(source);
    }
    const [validation] = await sql.unsafe(`select
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='screens' and column_name='device_type') as device_type,
      exists(select 1 from information_schema.tables where table_schema='public' and table_name='organic_participants') as participants,
      exists(select 1 from information_schema.tables where table_schema='public' and table_name='organic_campaign_rewards') as rewards,
      exists(select 1 from information_schema.routines where routine_schema='public' and routine_name='record_organic_playback') as playback_rpc`);
    return NextResponse.json({ success: true, validation });
  } catch (error) {
    console.error('Falha ao aplicar Rede Orgânica:', error instanceof Error ? error.message : 'erro desconhecido');
    return NextResponse.json({ success: false, error: 'migration_failed' }, { status: 500 });
  } finally { await sql.end(); }
}
