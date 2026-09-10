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

function maskMetaId(value?: string | null) {
  if (!value) return null;
  if (value.length <= 6) return '****';
  return `${value.slice(0, 3)}****${value.slice(-3)}`;
}

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
      let tokenExtended = false;

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
            tokenExtended = true;
            if (extendData.expires_in) userExpiresIn = extendData.expires_in;
          }
        }
      } catch (extErr: any) {
        console.warn('[Facebook Token Extension Warning]', extErr.message);
      }

      // Lê as permissões efetivamente concedidas; não presume que todo escopo pedido foi aceito.
      let grantedScopes: string[] = [];
      try {
        const permissionsUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/me/permissions`);
        permissionsUrl.searchParams.set('access_token', userToken);
        const permissionsRes = await fetch(permissionsUrl.toString(), { cache: 'no-store' });
        if (permissionsRes.ok) {
          const permissionsData = await permissionsRes.json() as {
            data?: Array<{ permission?: string; status?: string }>;
          };
          grantedScopes = (permissionsData.data || [])
            .filter((item) => item.status === 'granted' && Boolean(item.permission))
            .map((item) => item.permission!);
        }
      } catch (permissionsErr: any) {
        console.warn('[Facebook Permissions Warning]', permissionsErr.message);
      }

      type FacebookGranularScope = { scope?: string; target_ids?: string[] };
      type FacebookTokenDebug = {
        is_valid?: boolean;
        app_id?: string;
        user_id?: string;
        expires_at?: number;
        data_access_expires_at?: number;
        scopes?: string[];
        granular_scopes?: FacebookGranularScope[];
      };

      // Introspecção server-side do User Access Token. O app access token nunca sai do servidor.
      const debugUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/debug_token`);
      debugUrl.searchParams.set('input_token', userToken);
      debugUrl.searchParams.set('access_token', `${config.appId}|${config.appSecret}`);
      const debugRes = await fetch(debugUrl.toString(), { cache: 'no-store' });
      const debugPayload = await debugRes.json().catch(() => ({})) as {
        data?: FacebookTokenDebug;
        error?: { code?: number; message?: string };
      };
      const tokenDebug = debugPayload.data;
      if (!debugRes.ok || !tokenDebug?.is_valid || tokenDebug.app_id !== config.appId) {
        throw new Error(debugPayload.error?.message || 'Token do Facebook inválido ou emitido para outro app.');
      }

      const granularScopes = tokenDebug.granular_scopes || [];
      const requiredPageScopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
      const targetScopeMap = new Map<string, Set<string>>();
      for (const granular of granularScopes) {
        if (!granular.scope || !requiredPageScopes.includes(granular.scope)) continue;
        for (const targetId of granular.target_ids || []) {
          if (!targetScopeMap.has(targetId)) targetScopeMap.set(targetId, new Set());
          targetScopeMap.get(targetId)!.add(granular.scope);
        }
      }

      // Um escopo sem target_ids é tratado como concessão global; quando a Meta fornece
      // target_ids, o Page ID precisa estar explicitamente associado a esse escopo.
      const targetIds = Array.from(targetScopeMap.keys()).filter((targetId) =>
        requiredPageScopes.every((scope) => {
          const scopedEntries = granularScopes.filter((item) => item.scope === scope);
          if (scopedEntries.length === 0) return grantedScopes.includes(scope);
          const scopedTargets = scopedEntries.flatMap((item) => item.target_ids || []);
          return scopedTargets.length === 0
            ? grantedScopes.includes(scope)
            : scopedTargets.includes(targetId);
        })
      );

      // Consulta principal: Páginas administradas pelo long-lived User Access Token.
      const accountsUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/me/accounts`);
      accountsUrl.searchParams.set('fields', 'id,name,access_token,tasks,category');
      accountsUrl.searchParams.set('access_token', userToken);

      const accountsRes = await fetch(accountsUrl.toString(), { cache: 'no-store' });
      type FacebookPage = {
        id: string;
        name: string;
        access_token: string;
        category?: string;
        tasks?: string[];
        tasksAvailable?: boolean;
        pageTokenValidated?: boolean;
      };
      const accountsData = await accountsRes.json().catch(() => ({})) as {
        data?: FacebookPage[];
        paging?: unknown;
        error?: { code?: number; message?: string };
      };

      let pages = accountsRes.ok ? (accountsData.data || []) : [];
      let discoverySource: 'me_accounts' | 'granular_scopes_target_ids' = 'me_accounts';

      // Na Graph v26, algumas Páginas da Nova Experiência são omitidas em /me/accounts
      // mesmo com pages_show_list concedido. Os alvos granulares do token são a fonte
      // oficial dos ativos selecionados no consentimento do Facebook Login for Business.
      if (pages.length === 0) {
        try {
          const targetedPages = await Promise.all(targetIds.map(async (pageId) => {
            const pageUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(pageId)}`);
            pageUrl.searchParams.set('fields', 'id,name,access_token,tasks,category');
            pageUrl.searchParams.set('access_token', userToken);
            let pageRes = await fetch(pageUrl.toString(), { cache: 'no-store' });
            let pagePayload = await pageRes.json().catch(() => ({})) as Partial<FacebookPage> & {
              error?: { code?: number; message?: string };
            };
            let tasksAvailable = pageRes.ok && Array.isArray(pagePayload.tasks);

            // A Graph v26 pode não expor `tasks` no nó direto da Page. Mantém a tentativa
            // auditável e refaz somente sem esse campo, sem ampliar permissões.
            if (!pageRes.ok && pagePayload.error?.code === 100) {
              pageUrl.searchParams.set('fields', 'id,name,access_token,category');
              pageRes = await fetch(pageUrl.toString(), { cache: 'no-store' });
              pagePayload = await pageRes.json().catch(() => ({})) as Partial<FacebookPage> & {
                error?: { code?: number; message?: string };
              };
              tasksAvailable = false;
            }

            if (!pageRes.ok || !pagePayload.id || pagePayload.id !== pageId || !pagePayload.name || !pagePayload.access_token) {
              return null;
            }

            // Valida o Page Access Token devolvido pela Meta antes de persistir.
            const validationUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(pageId)}`);
            validationUrl.searchParams.set('fields', 'id,name');
            validationUrl.searchParams.set('access_token', pagePayload.access_token);
            const validationRes = await fetch(validationUrl.toString(), { cache: 'no-store' });
            const validationData = await validationRes.json().catch(() => ({})) as { id?: string; name?: string };
            const pageTokenValidated = validationRes.ok
              && validationData.id === pageId
              && validationData.name === pagePayload.name;
            if (!pageTokenValidated) return null;

            return {
              ...pagePayload,
              tasks: Array.isArray(pagePayload.tasks) ? pagePayload.tasks : [],
              tasksAvailable,
              pageTokenValidated,
            } as FacebookPage;
          }));

          pages = targetedPages.filter((page): page is FacebookPage => page !== null);
          if (pages.length > 0) discoverySource = 'granular_scopes_target_ids';
        } catch (targetErr: any) {
          console.warn('[Facebook Granular Targets Warning]', targetErr.message);
        }
      }

      // A validação com o Page Access Token é obrigatória nas duas estratégias.
      // Isso evita persistir apenas porque uma Page apareceu na listagem do usuário.
      if (pages.length > 0) {
        const validatedPages = await Promise.all(pages.map(async (page) => {
          if (page.pageTokenValidated) return page;
          const validationUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(page.id)}`);
          validationUrl.searchParams.set('fields', 'id,name');
          validationUrl.searchParams.set('access_token', page.access_token);
          const validationRes = await fetch(validationUrl.toString(), { cache: 'no-store' });
          const validationData = await validationRes.json().catch(() => ({})) as { id?: string; name?: string };
          if (!validationRes.ok || validationData.id !== page.id || validationData.name !== page.name) return null;
          return {
            ...page,
            tasks: Array.isArray(page.tasks) ? page.tasks : [],
            tasksAvailable: Array.isArray(page.tasks),
            pageTokenValidated: true,
          };
        }));
        pages = validatedPages.filter((page): page is FacebookPage => page !== null);
      }

      if (process.env.META_OAUTH_DIAGNOSTICS === '1') {
        console.info('[Meta OAuth Diagnostics]', {
          provider: 'facebook',
          stage: 'accounts',
          tokenExchangeSucceeded: Boolean(tokenData.access_token),
          tokenExtended,
          expiresInPresent: Number.isFinite(userExpiresIn) && userExpiresIn > 0,
          grantedScopes,
          tokenIntrospection: {
            isValid: tokenDebug.is_valid === true,
            appIdMatches: tokenDebug.app_id === config.appId,
            userIdMasked: maskMetaId(tokenDebug.user_id),
            expiresAtPresent: Number.isFinite(tokenDebug.expires_at) && Number(tokenDebug.expires_at) > 0,
            dataAccessExpiresAtPresent: Number.isFinite(tokenDebug.data_access_expires_at)
              && Number(tokenDebug.data_access_expires_at) > 0,
            scopes: tokenDebug.scopes || [],
            granularScopes: granularScopes.map((item) => ({
              scope: item.scope,
              targetIdsMasked: (item.target_ids || []).map(maskMetaId),
            })),
          },
          meAccounts: {
            httpStatus: accountsRes.status,
            dataLength: accountsRes.ok ? (accountsData.data || []).length : 0,
            hasPaging: Boolean(accountsData.paging),
            errorCode: accountsData.error?.code || null,
          },
          discoverySource,
          pagesCount: pages.length,
          pages: pages.map((page) => ({
            idMasked: maskMetaId(page.id),
            name: page.name,
            pageAccessTokenPresent: Boolean(page.access_token),
            pageTokenValidated: page.pageTokenValidated === true,
            tasksAvailable: page.tasksAvailable ?? Array.isArray(page.tasks),
            tasks: page.tasks || [],
          })),
        });
      }
      if (pages.length === 0) {
        destination.searchParams.set('social', 'warning');
        destination.searchParams.set('message', 'Nenhuma Página do Facebook sob sua administração foi localizada.');
        return NextResponse.redirect(destination);
      }

      for (const page of pages) {
        const pageTasks = page.tasks || [];
        const tasksPermitPublishing = page.tasksAvailable === true
          ? pageTasks.includes('CREATE_CONTENT')
          : true;
        const capabilityScopes = tasksPermitPublishing
          ? grantedScopes
          : grantedScopes.filter((scope) => scope !== 'pages_manage_posts');
        const pageEncryptedToken = encryptSocialToken(page.access_token);
        const fbCaps = detectChannelCapabilities('facebook_page', capabilityScopes, {}, metricsGlobalEnabled);

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
            // A Graph não devolve expiração separada para o Page token. Sua validade
            // continua condicionada ao usuário, ao app e às permissões concedidas.
            expires_at: null,
            last_refreshed_at: new Date().toISOString(),
            metadata: {
              name: page.name,
              discovery_strategy: discoverySource,
              page_token_validated: page.pageTokenValidated === true,
              tasks_available: page.tasksAvailable ?? Array.isArray(page.tasks),
              tasks: pageTasks,
            },
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
          metadata: {
            discovery_strategy: discoverySource,
            connection_capable: true,
            page_read_capable: capabilityScopes.includes('pages_read_engagement'),
            feed_publish_capable: fbCaps.feedPublishCapable,
            metrics_capable: fbCaps.metricsCapable,
            page_token_validated: page.pageTokenValidated === true,
            tasks_available: page.tasksAvailable ?? Array.isArray(page.tasks),
            tasks: pageTasks,
          },
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
