import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSocialToken } from '@/lib/social-token-crypto';

export const dynamic = 'force-dynamic';

type State = { userId: string; ownerType: 'company' | 'organic_participant' | 'creator'; ownerId: string; exp: number };

export async function GET(request: NextRequest) {
  const destination = new URL('/ecosystem?social=error', request.url);
  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateRaw = request.nextUrl.searchParams.get('state');
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const version = process.env.META_GRAPH_VERSION;
    const redirectUri = process.env.META_REDIRECT_URI;
    if (!code || !stateRaw || !appId || !appSecret || !version || !redirectUri) throw new Error('Callback Meta incompleto.');
    const [payload, signature] = stateRaw.split('.');
    const expected = createHmac('sha256', appSecret).update(payload).digest('base64url');
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('State OAuth inválido.');
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as State;
    if (state.exp < Date.now()) throw new Error('State OAuth expirado.');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== state.userId) throw new Error('Sessão OAuth inválida.');
    const [{ data: profile }, { data: ownership }] = await Promise.all([
      (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle(),
      state.ownerType === 'company'
        ? (supabase.from('company_users') as any).select('id').eq('company_id', state.ownerId).eq('user_id', user.id).eq('is_active', true).in('role', ['owner', 'admin']).maybeSingle()
        : state.ownerType === 'organic_participant'
          ? (supabase.from('organic_participants') as any).select('id').eq('id', state.ownerId).eq('user_id', user.id).maybeSingle()
          : (supabase.from('creator_profiles') as any).select('id').eq('id', state.ownerId).eq('user_id', user.id).maybeSingle(),
    ]);
    if (!profile?.is_master_admin && !ownership) throw new Error('Sem autoridade sobre o titular OAuth.');

    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId); tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri); tokenUrl.searchParams.set('code', code);
    const tokenResponse = await fetch(tokenUrl, { cache: 'no-store' });
    if (!tokenResponse.ok) throw new Error('Falha ao trocar código OAuth.');
    const tokenData = await tokenResponse.json() as { access_token: string; expires_in?: number };
    const pagesResponse = await fetch(`https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(tokenData.access_token)}`, { cache: 'no-store' });
    if (!pagesResponse.ok) throw new Error('Falha ao listar canais Meta elegíveis.');
    const pages = (await pagesResponse.json() as { data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }> }).data || [];
    const admin = createAdminClient();
    for (const page of pages) {
      const { data: existing } = await (admin.from('social_connections') as any).select('owner_type,owner_id')
        .eq('provider', 'facebook').eq('provider_account_id', page.id).maybeSingle();
      if (existing && (existing.owner_type !== state.ownerType || existing.owner_id !== state.ownerId)) {
        throw new Error('Canal Meta já pertence a outro titular.');
      }
      const { data: connection, error } = await (admin.from('social_connections') as any).upsert({
        owner_type: state.ownerType, owner_id: state.ownerId, provider: 'facebook', provider_account_id: page.id,
        encrypted_access_token: encryptSocialToken(page.access_token), token_key_version: 1,
        scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'], status: 'active', connected_by: user.id,
        connected_at: new Date().toISOString(), expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
      }, { onConflict: 'provider,provider_account_id' }).select('id').single();
      if (error || !connection) throw error || new Error('Falha ao persistir conexão Meta.');
      await (admin.from('social_channels') as any).upsert({ connection_id: connection.id, owner_type: state.ownerType, owner_id: state.ownerId,
        provider: 'facebook', channel_type: 'facebook_page', provider_channel_id: page.id, display_name: page.name, status: 'draft' }, { onConflict: 'provider,provider_channel_id' });
      if (page.instagram_business_account?.id) {
        await (admin.from('social_channels') as any).upsert({ connection_id: connection.id, owner_type: state.ownerType, owner_id: state.ownerId,
          provider: 'instagram', channel_type: 'instagram_professional', provider_channel_id: page.instagram_business_account.id,
          display_name: `${page.name} — Instagram`, status: 'draft' }, { onConflict: 'provider,provider_channel_id' });
      }
    }
    destination.searchParams.set('social', 'connected');
  } catch (error) {
    destination.searchParams.set('message', error instanceof Error ? error.message : 'Erro na integração Meta.');
  }
  return NextResponse.redirect(destination);
}
