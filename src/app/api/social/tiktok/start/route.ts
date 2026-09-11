import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOAuthState } from '@/lib/social/meta';
import {
  getSafeTikTokDiagnostics,
  getTikTokConfig,
  getTikTokRequestedScopes,
  TIKTOK_AUTHORIZE_URL,
} from '@/lib/social/tiktok';

export const dynamic = 'force-dynamic';

function boolSetting(value: unknown) {
  return value === true || value === 'true';
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const ownerType = url.searchParams.get('owner_type') || 'creator';
  const rawOwnerId = url.searchParams.get('owner_id');
  const defaultReturnTo = ownerType === 'company'
    ? (rawOwnerId ? `/company/social?company_id=${rawOwnerId}` : '/company/social')
    : '/creator?tab=social';
  const requestedReturnTo = url.searchParams.get('return_to');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : defaultReturnTo;

  const failure = (reason: string, message: string) => {
    const destination = new URL(returnTo, url.origin);
    destination.searchParams.set('social', 'error');
    destination.searchParams.set('reason', reason);
    destination.searchParams.set('message', message);
    return NextResponse.redirect(destination);
  };

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL('/login', url.origin));

    const admin = createAdminClient();
    const [{ data: settings }, { data: profile }] = await Promise.all([
      (admin.from('platform_settings') as any).select('key,value').in('key', [
        'tiktok_connection_enabled',
        'tiktok_display_enabled',
        'tiktok_upload_enabled',
        'tiktok_direct_post_enabled',
      ]),
      (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle(),
    ]);
    const flag = (key: string) => boolSetting((settings || []).find((item: any) => item.key === key)?.value);
    if (!flag('tiktok_connection_enabled')) {
      return failure('disabled', 'A conexão TikTok ainda está em configuração ou análise.');
    }

    const config = getTikTokConfig();
    if (!config) return failure('not_configured', 'Credenciais TikTok ausentes no ambiente de produção.');
    const requestedScopes = getTikTokRequestedScopes({
      displayEnabled: flag('tiktok_display_enabled'),
      uploadEnabled: flag('tiktok_upload_enabled'),
      directPostEnabled: flag('tiktok_direct_post_enabled'),
    });

    let ownerId = rawOwnerId;
    if (ownerType === 'creator') {
      let creatorId: string | null = null;
      if (rawOwnerId) {
        const { data } = await (admin.from('creator_profiles') as any)
          .select('id').eq('id', rawOwnerId).eq('user_id', user.id).maybeSingle();
        creatorId = data?.id || null;
      }
      if (!creatorId) {
        const { data } = await (admin.from('creator_profiles') as any)
          .select('id').eq('user_id', user.id).maybeSingle();
        creatorId = data?.id || null;
      }
      if (!creatorId) {
        const { data } = await (admin.rpc as any)('ensure_canonical_creator_profile', { p_user_id: user.id });
        creatorId = data || null;
      }
      if (!creatorId && !profile?.is_master_admin) return failure('unauthorized', 'Perfil Creator não validado.');
      ownerId = creatorId || user.id;
    } else if (ownerType === 'company') {
      if (!rawOwnerId) return failure('invalid_owner', 'Empresa não informada.');
      if (!profile?.is_master_admin) {
        const { data: member } = await (supabase.from('company_users') as any)
          .select('id').eq('company_id', rawOwnerId).eq('user_id', user.id)
          .eq('is_active', true).in('role', ['owner', 'admin']).maybeSingle();
        if (!member) return failure('unauthorized', 'Sem autoridade administrativa sobre a empresa.');
      }
    } else {
      return failure('invalid_owner', 'Tipo de titular não suportado.');
    }

    const state = generateOAuthState({
      userId: user.id,
      ownerType: ownerType as 'creator' | 'company',
      ownerId: ownerId!,
      provider: 'tiktok',
      returnTo,
    });

    const authorize = new URL(TIKTOK_AUTHORIZE_URL);
    authorize.searchParams.set('client_key', config.clientKey);
    authorize.searchParams.set('scope', requestedScopes.join(','));
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', config.redirectUri);
    authorize.searchParams.set('state', state);

    if (process.env.TIKTOK_OAUTH_DIAGNOSTICS === '1') {
      console.info('[TikTok OAuth Diagnostics]', {
        stage: 'authorization',
        ...getSafeTikTokDiagnostics(config),
        scopes: requestedScopes,
      });
    }

    return NextResponse.redirect(authorize);
  } catch (error: any) {
    console.error('[TikTok OAuth] Falha ao iniciar:', error?.message || 'erro inesperado');
    return failure('unexpected', 'Não foi possível iniciar a conexão TikTok.');
  }
}
