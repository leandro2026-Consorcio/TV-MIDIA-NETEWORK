import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const admin = createAdminClient();
  const { data: feature } = await (admin.from('platform_settings') as any).select('value').eq('key', 'creator_referral_leads_enabled').maybeSingle();
  if (!(feature?.value === true || feature?.value === 'true')) return NextResponse.json({ error: 'Indicações desabilitadas.' }, { status: 503 });
  const { data } = await (admin.from as any)('campaign_referrals').select('id,status,attribution_expires_at').eq('public_code', code).maybeSingle();
  if (!data || data.status !== 'active' || new Date(data.attribution_expires_at) <= new Date()) return NextResponse.json({ error: 'Indicação inválida.' }, { status: 404 });
  const svg = await QRCode.toString(`${request.nextUrl.origin}/r/${code}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'private, max-age=300' } });
}
