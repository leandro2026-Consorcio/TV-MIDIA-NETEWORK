import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const scheduled = request.headers.get('user-agent')?.startsWith('vercel-cron/') === true;
  const authorized = !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
  if (!scheduled && !authorized) return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  const runKey = new Date().toISOString().slice(0, 13);
  const admin: any = createAdminClient();
  const { data, error } = await admin.rpc('run_mpm_ecosystem_jobs', { p_run_key: runKey });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, runKey, counters: data });
}
