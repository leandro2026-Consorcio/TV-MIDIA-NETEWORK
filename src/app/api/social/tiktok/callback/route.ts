import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSocialToken } from '@/lib/social-token-crypto';
import { verifyOAuthState } from '@/lib/social/meta';
import {
  detectTikTokCapabilities,
  getSafeTikTokDiagnostics,
  getTikTokConfig,
  scopesFromTikTok,
  TIKTOK_TOKEN_URL,
  TIKTOK_USER_INFO_URL,
  TIKTOK_VIDEO_LIST_URL,
} from '@/lib/social/tiktok';

export const dynamic = 'force-dynamic';

function enabled(value: unknown) {
  return value === true || value === 'true';
}

function destination(origin: string, returnTo: string, status: 'connected' | 'error', reason?: string) {
  const url = new URL(returnTo, origin);
  url.searchParams.set('social', status);
  if (reason) url.searchParams.set('reason', reason);
  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateRaw = request.nextUrl.searchParams.get('state');
  const oauthError = request.nextUrl.searchParams.get('error');
  let returnTo = '/creator?tab=social';

  try {
    if (!stateRaw) throw new Error('state_missing');
    const state = verifyOAuthState(stateRaw);
    returnTo = state.returnTo;
    if (state.provider !== 'tiktok') throw new Error('provider_mismatch');
    if (oauthError || !code) {
      return NextResponse.redirect(destination(request.nextUrl.origin, returnTo, 'error', 'cancelled'));
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== state.userId) {
      return NextResponse.redirect(destination(request.nextUrl.origin, returnTo, 'error', 'session'));
    }

    const config = getTikTokConfig();
    if (!config) {
      return NextResponse.redirect(destination(request.nextUrl.origin, returnTo, 'error', 'not_configured'));
    }

    const admin = createAdminClient();
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('is_master_admin').eq('id', user.id).maybeSingle();
    if (state.ownerType === 'creator') {
      const { data: owner } = await (admin.from('creator_profiles') as any)
        .select('id').eq('id', state.ownerId).eq('user_id', user.id).maybeSingle();
      if (!owner && !profile?.is_master_admin) throw new Error('owner_mismatch');
    } else if (state.ownerType === 'company') {
      const { data: member } = await (admin.from('company_users') as any)
        .select('id').eq('company_id', state.ownerId).eq('user_id', user.id)
        .eq('is_active', true).in('role', ['owner', 'admin']).maybeSingle();
      if (!member && !profile?.is_master_admin) throw new Error('owner_mismatch');
    } else {
      throw new Error('owner_type_invalid');
    }

    const tokenBody = new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });
    const tokenResponse = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: tokenBody,
      cache: 'no-store',
    });
    const token = await tokenResponse.json() as any;
    if (!tokenResponse.ok || !token.access_token || !token.refresh_token || !token.open_id) {
      const safeDescription = String(token?.error_description || '')
        .replaceAll(config.clientKey, '[REDACTED_CLIENT_KEY]')
        .replaceAll(config.clientSecret, '[REDACTED_CLIENT_SECRET]')
        .replaceAll(code, '[REDACTED_CODE]')
        .slice(0, 300);
      console.error('[TikTok OAuth] Token exchange rejeitado:', {
        status: tokenResponse.status,
        error: String(token?.error || 'unknown').slice(0, 80),
        errorDescription: safeDescription,
        logId: String(token?.log_id || '').slice(0, 100),
      });
      throw new Error('token_exchange');
    }

    const scopes = scopesFromTikTok(token.scope);
    if (!scopes.includes('user.info.basic')) throw new Error('permissions');

    const profileUrl = new URL(TIKTOK_USER_INFO_URL);
    profileUrl.searchParams.set('fields', 'open_id,union_id,avatar_url,display_name');
    const profileResponse = await fetch(profileUrl, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    });
    const profilePayload = await profileResponse.json() as any;
    const tiktokUser = profilePayload?.data?.user;
    const profileVerified = profileResponse.ok
      && profilePayload?.error?.code === 'ok'
      && tiktokUser?.open_id === token.open_id;
    if (!profileVerified) throw new Error('profile_fetch');

    const settingKeys = [
      'tiktok_display_enabled',
      'tiktok_upload_enabled',
      'tiktok_direct_post_enabled',
    ];
    const { data: settings } = await (admin.from('platform_settings') as any)
      .select('key,value').in('key', settingKeys);
    const flag = (key: string) => enabled((settings || []).find((item: any) => item.key === key)?.value);

    let videoListVerified = false;
    if (scopes.includes('video.list') && flag('tiktok_display_enabled')) {
      const videosUrl = new URL(TIKTOK_VIDEO_LIST_URL);
      videosUrl.searchParams.set('fields', 'id');
      const videosResponse = await fetch(videosUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_count: 1 }),
        cache: 'no-store',
      });
      const videosPayload = await videosResponse.json() as any;
      videoListVerified = videosResponse.ok && videosPayload?.error?.code === 'ok';
    }

    const capabilities = detectTikTokCapabilities({
      scopes,
      profileVerified,
      videoListVerified,
      displayEnabled: flag('tiktok_display_enabled'),
      uploadEnabled: flag('tiktok_upload_enabled'),
      directPostEnabled: flag('tiktok_direct_post_enabled'),
    });

    const expiresIn = Number(token.expires_in);
    const refreshExpiresIn = Number(token.refresh_expires_in);
    if (!Number.isFinite(expiresIn) || !Number.isFinite(refreshExpiresIn)) throw new Error('token_expiry');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();
    const refreshExpiresAt = new Date(now.getTime() + refreshExpiresIn * 1000).toISOString();
    const metadata = {
      union_id_present: Boolean(tiktokUser.union_id),
      profile_verified: profileVerified,
      video_list_verified: videoListVerified,
      review_status: 'pending_tiktok',
      content_posting_audit: 'pending_tiktok',
    };

    const { data: existingConnection } = await (admin.from('social_connections') as any)
      .select('id,owner_type,owner_id,metadata')
      .eq('provider', 'tiktok')
      .eq('provider_account_id', token.open_id)
      .maybeSingle();
    if (existingConnection
      && (existingConnection.owner_type !== state.ownerType || existingConnection.owner_id !== state.ownerId)) {
      throw new Error('account_already_connected');
    }

    const connectionMetadata = {
      ...(existingConnection?.metadata || {}),
      ...metadata,
      reconnect_count: existingConnection ? Number(existingConnection.metadata?.reconnect_count || 0) + 1 : 0,
      last_connected_at: now.toISOString(),
    };
    const { data: connection, error: connectionError } = await (admin.from('social_connections') as any)
      .upsert({
        owner_type: state.ownerType,
        owner_id: state.ownerId,
        provider: 'tiktok',
        auth_flow: 'tiktok_login',
        provider_account_id: token.open_id,
        encrypted_access_token: encryptSocialToken(token.access_token),
        encrypted_refresh_token: encryptSocialToken(token.refresh_token),
        token_key_version: 1,
        token_type: token.token_type || 'Bearer',
        scopes,
        status: 'active',
        connected_by: user.id,
        connected_at: now.toISOString(),
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        last_refreshed_at: null,
        metadata: connectionMetadata,
        updated_at: now.toISOString(),
      }, { onConflict: 'provider,provider_account_id' })
      .select('id').single();
    if (connectionError || !connection) throw connectionError || new Error('connection_persistence');

    const diagnosticMessage = capabilities.videoListCapable
      ? 'Perfil e vídeos públicos do TikTok disponíveis.'
      : 'Perfil TikTok conectado. Recursos de vídeo dependem de aprovação do TikTok.';
    const { error: channelError } = await (admin.from('social_channels') as any)
      .upsert({
        connection_id: connection.id,
        owner_type: state.ownerType,
        owner_id: state.ownerId,
        provider: 'tiktok',
        channel_type: 'tiktok_profile',
        auth_flow: 'tiktok_login',
        provider_channel_id: token.open_id,
        display_name: tiktokUser.display_name || 'TikTok',
        username: null,
        avatar_url: tiktokUser.avatar_url || null,
        participation_enabled: false,
        requires_approval: true,
        publication_mode: 'manual',
        allowed_formats: [],
        status: 'active',
        profile_read_capable: capabilities.profileReadCapable,
        video_list_capable: capabilities.videoListCapable,
        video_upload_capable: capabilities.videoUploadCapable,
        direct_post_capable: capabilities.directPostCapable,
        metrics_capable: capabilities.metricsCapable,
        feed_publish_capable: false,
        reel_publish_capable: false,
        story_publish_capable: false,
        insights_capable: false,
        diagnostic_status: capabilities.profileReadCapable ? 'connected' : 'partial_permission',
        diagnostic_message: diagnosticMessage,
        last_diagnosed_at: now.toISOString(),
        metadata,
        updated_at: now.toISOString(),
      }, { onConflict: 'provider,provider_channel_id' });
    if (channelError) throw channelError;

    if (process.env.TIKTOK_OAUTH_DIAGNOSTICS === '1') {
      console.info('[TikTok OAuth Diagnostics]', {
        stage: 'callback',
        ...getSafeTikTokDiagnostics(config),
        codeReceived: true,
        tokenExchangeSucceeded: true,
        accessTokenPresent: true,
        refreshTokenPresent: true,
        openIdMasked: `${String(token.open_id).slice(0, 3)}****${String(token.open_id).slice(-3)}`,
        scopes,
        profileVerified,
        videoListVerified,
        capabilities,
        ownerType: state.ownerType,
      });
    }

    return NextResponse.redirect(destination(request.nextUrl.origin, returnTo, 'connected'));
  } catch (error: any) {
    const reason = ['state_missing', 'provider_mismatch', 'owner_mismatch', 'owner_type_invalid', 'token_exchange', 'token_expiry', 'permissions', 'profile_fetch', 'account_already_connected']
      .includes(error?.message) ? error.message : 'unexpected';
    console.error('[TikTok OAuth] Callback falhou:', reason);
    return NextResponse.redirect(destination(request.nextUrl.origin, returnTo, 'error', reason));
  }
}
