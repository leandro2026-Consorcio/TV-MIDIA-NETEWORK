import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSocialToken } from '@/lib/social-token-crypto';
import {
  verifyOAuthState,
  getProviderConfig,
  detectChannelCapabilities,
  logSafeOAuthDiagnostics,
  OAuthStatePayload,
} from '@/lib/social/meta';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const oauthErrorDesc = url.searchParams.get('error_description');

  let parsedState: OAuthStatePayload | null = null;
  try {
    if (stateRaw) {
      parsedState = verifyOAuthState(stateRaw);
    }
  } catch (err: any) {
    console.error('[Social Callback] Erro ao verificar state:', err.message);
  }

  // Define a rota de destino baseando-se no returnTo salvo no state assinado
  const fallbackReturnTo = parsedState?.ownerType === 'company' ? '/company/social' : '/creator?tab=social';
  const returnTo = parsedState?.returnTo || fallbackReturnTo;
  const destination = new URL(returnTo, url.origin);

  // Se o usuário cancelou na tela da Meta
  if (oauthError) {
    destination.searchParams.set('social', 'error');
    destination.searchParams.set('reason', 'cancelled');
    destination.searchParams.set('message', oauthErrorDesc || 'Conexão cancelada pelo usuário no provedor.');
    return NextResponse.redirect(destination);
  }

  if (!code || !parsedState) {
    destination.searchParams.set('social', 'error');
    destination.searchParams.set('reason', 'invalid_request');
    destination.searchParams.set('message', 'Parâmetros de autorização inválidos ou expirados.');
    return NextResponse.redirect(destination);
  }

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== parsedState.userId) {
      destination.searchParams.set('social', 'error');
      destination.searchParams.set('reason', 'session_mismatch');
      destination.searchParams.set('message', 'Sessão de usuário divergente. Refaça a conexão enquanto logado.');
      return NextResponse.redirect(destination);
    }

    const config = getProviderConfig(parsedState.provider);
    if (!config) {
      throw new Error('Configuração do provedor não localizada no servidor.');
    }

    const admin = createAdminClient();

    // Consulta flags de métricas do platform_settings
    const { data: metricsSetting } = await (admin.from('platform_settings') as any)
      .select('value')
      .eq('key', 'social_metrics_enabled')
      .maybeSingle();
    const metricsGlobalEnabled = metricsSetting?.value === true;

    if (parsedState.provider === 'instagram') {
      // =======================================================================
      // FLUXO A: INSTAGRAM API WITH INSTAGRAM LOGIN (SEM PÁGINA FACEBOOK)
      // =======================================================================
      const tokenForm = new URLSearchParams();
      logSafeOAuthDiagnostics('exchange', config);
      tokenForm.set('client_id', config.appId);
      tokenForm.set('client_secret', config.appSecret);
      tokenForm.set('grant_type', 'authorization_code');
      tokenForm.set('redirect_uri', config.redirectUri);
      tokenForm.set('code', code);

      const shortRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenForm.toString(),
        cache: 'no-store',
      });

      if (!shortRes.ok) {
        const errJson = await shortRes.json().catch(() => ({}));
        console.error('[Instagram Token Exchange Error]', errJson);
        throw new Error(errJson.error_message || 'Falha ao trocar código de autorização do Instagram.');
      }

      const shortData = await shortRes.json() as { access_token: string; user_id: string; permissions?: string[] };
      const shortToken = shortData.access_token;
      const grantedScopes = Array.isArray(shortData.permissions) && shortData.permissions.length > 0
        ? shortData.permissions
        : config.scopes;

      // Troca por Long-Lived Token (60 dias)
      let longToken = shortToken;
      let expiresInSeconds = 60 * 86400; // 60 dias default

      try {
        const longUrl = new URL('https://graph.instagram.com/access_token');
        longUrl.searchParams.set('grant_type', 'ig_exchange_token');
        longUrl.searchParams.set('client_secret', config.appSecret);
        longUrl.searchParams.set('access_token', shortToken);

        const longRes = await fetch(longUrl.toString(), { cache: 'no-store' });
        if (longRes.ok) {
          const longData = await longRes.json() as { access_token: string; expires_in?: number };
          if (longData.access_token) {
            longToken = longData.access_token;
            if (longData.expires_in) expiresInSeconds = longData.expires_in;
          }
        }
      } catch (longErr: any) {
        console.warn('[Instagram Long-lived Exchange Warning]', longErr.message);
      }

      // Consulta dados diretos da conta profissional do Instagram
      const meUrl = new URL('https://graph.instagram.com/me');
      meUrl.searchParams.set('fields', 'id,username,name,account_type,profile_picture_url');
      meUrl.searchParams.set('access_token', longToken);

      const meRes = await fetch(meUrl.toString(), { cache: 'no-store' });
      let igAccount = {
        id: shortData.user_id || `ig_${Date.now()}`,
        username: 'instagram_user',
        name: 'Instagram Profissional',
        account_type: 'BUSINESS',
        profile_picture_url: '',
      };

      if (meRes.ok) {
        const meJson = await meRes.json();
        igAccount = { ...igAccount, ...meJson };
      }

      // Detecta capacidades
      const igCaps = detectChannelCapabilities(
        'instagram_professional',
        grantedScopes,
        { account_type: igAccount.account_type },
        metricsGlobalEnabled
      );

      const encryptedToken = encryptSocialToken(longToken);
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

      // Upsert em social_connections
      const { data: connection, error: connErr } = await (admin.from('social_connections') as any)
        .upsert({
          owner_type: parsedState.ownerType,
          owner_id: parsedState.ownerId,
          provider: 'instagram',
          auth_flow: 'instagram_login',
          provider_account_id: String(igAccount.id),
          encrypted_access_token: encryptedToken,
          token_key_version: 1,
          scopes: grantedScopes,
          status: 'active',
          connected_by: user.id,
          connected_at: new Date().toISOString(),
          expires_at: expiresAt,
          last_refreshed_at: new Date().toISOString(),
          metadata: {
            account_type: igAccount.account_type,
            name: igAccount.name,
            username: igAccount.username,
          },
        }, { onConflict: 'provider,provider_account_id' })
        .select('id')
        .single();

      if (connErr || !connection) {
        throw connErr || new Error('Falha ao persistir conexão do Instagram.');
      }

      // Upsert em social_channels
      const { error: channelErr } = await (admin.from('social_channels') as any).upsert({
        connection_id: connection.id,
        owner_type: parsedState.ownerType,
        owner_id: parsedState.ownerId,
        provider: 'instagram',
        channel_type: 'instagram_professional',
        auth_flow: 'instagram_login',
        provider_channel_id: String(igAccount.id),
        display_name: igAccount.username ? `@${igAccount.username}` : (igAccount.name || 'Instagram Profissional'),
        username: igAccount.username,
        avatar_url: igAccount.profile_picture_url,
        feed_publish_capable: igCaps.feedPublishCapable,
        reel_publish_capable: igCaps.reelPublishCapable,
        story_publish_capable: igCaps.storyPublishCapable,
        insights_capable: igCaps.insightsCapable,
        metrics_capable: igCaps.metricsCapable,
        diagnostic_status: igCaps.diagnosticStatus,
        diagnostic_message: igCaps.diagnosticMessage,
        last_diagnosed_at: new Date().toISOString(),
        participation_enabled: true,
        status: 'active',
      }, { onConflict: 'provider,provider_channel_id' });

      if (channelErr) {
        throw channelErr;
      }

    } else {
      // =======================================================================
      // FLUXO B: FACEBOOK LOGIN FOR BUSINESS (PÁGINAS)
      // =======================================================================
      const tokenUrl = new URL(config.tokenUrl);
      tokenUrl.searchParams.set('client_id', config.appId);
      tokenUrl.searchParams.set('client_secret', config.appSecret);
      tokenUrl.searchParams.set('redirect_uri', config.redirectUri);
      tokenUrl.searchParams.set('code', code);

      const tokenRes = await fetch(tokenUrl.toString(), { cache: 'no-store' });
      if (!tokenRes.ok) {
        const errJson = await tokenRes.json().catch(() => ({}));
        console.error('[Facebook Token Exchange Error]', errJson);
        throw new Error(errJson.error?.message || 'Falha ao trocar código de autorização do Facebook.');
      }

      const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };
      let userToken = tokenData.access_token;
      let userExpiresIn = tokenData.expires_in || 3600;

      // Estende user token para long-lived
      try {
        const extendUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
        extendUrl.searchParams.set('grant_type', 'fb_exchange_token');
        extendUrl.searchParams.set('client_id', config.appId);
        extendUrl.searchParams.set('client_secret', config.appSecret);
        extendUrl.searchParams.set('fb_exchange_token', userToken);

        const extendRes = await fetch(extendUrl.toString(), { cache: 'no-store' });
        if (extendRes.ok) {
          const extendData = await extendRes.json() as { access_token: string; expires_in?: number };
          if (extendData.access_token) {
            userToken = extendData.access_token;
            if (extendData.expires_in) userExpiresIn = extendData.expires_in;
          }
        }
      } catch (extErr: any) {
        console.warn('[Facebook Token Extension Warning]', extErr.message);
      }

      // Consulta Páginas administradas
      const accountsUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/me/accounts`);
      accountsUrl.searchParams.set('fields', 'id,name,access_token,tasks,category,instagram_business_account{id,username,name,profile_picture_url}');
      accountsUrl.searchParams.set('access_token', userToken);

      const accountsRes = await fetch(accountsUrl.toString(), { cache: 'no-store' });
      if (!accountsRes.ok) {
        const accErr = await accountsRes.json().catch(() => ({}));
        throw new Error(accErr.error?.message || 'Falha ao listar Páginas do Facebook administradas.');
      }

      const accountsData = await accountsRes.json() as {
        data?: Array<{
          id: string;
          name: string;
          access_token: string;
          instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string };
        }>;
      };

      const pages = accountsData.data || [];
      if (pages.length === 0) {
        destination.searchParams.set('social', 'warning');
        destination.searchParams.set('message', 'Nenhuma Página do Facebook sob sua administração foi localizada.');
        return NextResponse.redirect(destination);
      }

      const grantedScopes = config.scopes;

      for (const page of pages) {
        const pageEncryptedToken = encryptSocialToken(page.access_token);
        const fbCaps = detectChannelCapabilities('facebook_page', grantedScopes, {}, metricsGlobalEnabled);

        const { data: connection, error: connErr } = await (admin.from('social_connections') as any)
          .upsert({
            owner_type: parsedState.ownerType,
            owner_id: parsedState.ownerId,
            provider: 'facebook',
            auth_flow: 'facebook_login',
            provider_account_id: page.id,
            encrypted_access_token: pageEncryptedToken,
            token_key_version: 1,
            scopes: grantedScopes,
            status: 'active',
            connected_by: user.id,
            connected_at: new Date().toISOString(),
            expires_at: null, // Page tokens permanentes
            last_refreshed_at: new Date().toISOString(),
            metadata: { name: page.name },
          }, { onConflict: 'provider,provider_account_id' })
          .select('id')
          .single();

        if (connErr || !connection) {
          throw connErr || new Error('Falha ao persistir conexão da Página.');
        }

        const { error: channelErr } = await (admin.from('social_channels') as any).upsert({
          connection_id: connection.id,
          owner_type: parsedState.ownerType,
          owner_id: parsedState.ownerId,
          provider: 'facebook',
          channel_type: 'facebook_page',
          auth_flow: 'facebook_login',
          provider_channel_id: page.id,
          display_name: page.name,
          username: page.name,
          feed_publish_capable: fbCaps.feedPublishCapable,
          reel_publish_capable: fbCaps.reelPublishCapable,
          story_publish_capable: fbCaps.storyPublishCapable,
          insights_capable: fbCaps.insightsCapable,
          metrics_capable: fbCaps.metricsCapable,
          diagnostic_status: fbCaps.diagnosticStatus,
          diagnostic_message: fbCaps.diagnosticMessage,
          last_diagnosed_at: new Date().toISOString(),
          participation_enabled: true,
          status: 'active',
        }, { onConflict: 'provider,provider_channel_id' });

        if (channelErr) {
          throw channelErr;
        }
      }
    }

    // Sucesso garantido: redireciona para a tela de origem
    destination.searchParams.set('social', 'connected');
    return NextResponse.redirect(destination);
  } catch (err: any) {
    console.error('[Social Callback Error]', err);
    destination.searchParams.set('social', 'error');
    destination.searchParams.set('message', err instanceof Error ? err.message : 'Falha na conexão com a rede social.');
    return NextResponse.redirect(destination);
  }
}
