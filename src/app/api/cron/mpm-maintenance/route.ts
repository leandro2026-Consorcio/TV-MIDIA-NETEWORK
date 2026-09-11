import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasValidCronAuthorization } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!hasValidCronAuthorization(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }
  const runKey = new Date().toISOString().slice(0, 13);
  const admin: any = createAdminClient();
  const { data, error } = await admin.rpc('run_mpm_ecosystem_jobs', { p_run_key: runKey });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const { data: multichannel, error: multichannelError } = await admin.rpc('process_multichannel_scheduler', { p_run_key: runKey });
  if (multichannelError && multichannelError.code !== 'PGRST202') {
    return NextResponse.json({ success: false, error: multichannelError.message, ecosystemCounters: data }, { status: 500 });
  }
  return NextResponse.json({ success: true, runKey, counters: data, multichannel: multichannel || null });
}
