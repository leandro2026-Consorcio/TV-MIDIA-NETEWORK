import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const graphVersion = process.env.META_GRAPH_VERSION;
  const redirectUri = process.env.META_REDIRECT_URI;
  const encryptionKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!appId || !appSecret || !graphVersion || !redirectUri || !encryptionKey) {
    return NextResponse.json({ error: 'Integração Meta ainda não configurada.' }, { status: 503 });
  }
  const ownerType = request.nextUrl.searchParams.get('owner_type') || 'company';
  const ownerId = request.nextUrl.searchParams.get('owner_id');
  if (!ownerId || !['company', 'organic_participant', 'creator'].includes(ownerType)) {
    return NextResponse.json({ error: 'Titular inválido.' }, { status: 400 });
  }
  const [{ data: profile }, { data: ownership }] = await Promise.all([
    (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle(),
    ownerType === 'company'
      ? (supabase.from('company_users') as any).select('id').eq('company_id', ownerId).eq('user_id', user.id).eq('is_active', true).in('role', ['owner', 'admin']).maybeSingle()
      : ownerType === 'organic_participant'
        ? (supabase.from('organic_participants') as any).select('id').eq('id', ownerId).eq('user_id', user.id).maybeSingle()
        : (supabase.from('creator_profiles') as any).select('id').eq('id', ownerId).eq('user_id', user.id).maybeSingle(),
  ]);
  if (!profile?.is_master_admin && !ownership) return NextResponse.json({ error: 'Sem autoridade sobre o titular.' }, { status: 403 });
  const nonce = randomBytes(18).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ nonce, userId: user.id, ownerType, ownerId, exp: Date.now() + 10 * 60_000 })).toString('base64url');
  const signature = createHmac('sha256', appSecret).update(payload).digest('base64url');
  const state = `${payload}.${signature}`;
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish');
  return NextResponse.redirect(url);
}
