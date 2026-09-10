import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getProviderConfig,
  generateOAuthState,
  logSafeOAuthDiagnostics,
  SocialProvider,
} from '@/lib/social/meta';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const rawProvider = url.searchParams.get('provider') || 'instagram';
  const provider: SocialProvider = rawProvider === 'facebook' ? 'facebook' : 'instagram';
  const ownerType = url.searchParams.get('owner_type') || 'creator';
  const rawOwnerId = url.searchParams.get('owner_id');

  // Determina a rota de retorno padrão caso ocorra qualquer imprevisto
  const defaultReturnTo = ownerType === 'company'
    ? (rawOwnerId ? `/company/social?company_id=${rawOwnerId}` : '/company/social')
    : '/creator?tab=social';
  const returnTo = url.searchParams.get('return_to') || defaultReturnTo;

  const failureRedirect = (reason: string, msg?: string) => {
    const dest = new URL(returnTo, url.origin);
    dest.searchParams.set('social', 'error');
    dest.searchParams.set('reason', reason);
    if (msg) dest.searchParams.set('message', msg);
    return NextResponse.redirect(dest);
  };

  try {
    // 1. Autenticação MPM
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/login', url.origin));
    }

    // 2. Validação da flag de conexão social
    const { data: flagSetting } = await (supabase.from('platform_settings') as any)
      .select('value')
      .eq('key', 'social_connection_enabled')
      .maybeSingle();

    if (flagSetting && flagSetting.value === false) {
      return failureRedirect('disabled', 'A conexão social está temporariamente desativada para manutenção.');
    }

    // 3. Validação das configurações do Provider
    let config;
    try {
      config = getProviderConfig(provider);
    } catch (cfgErr: any) {
      console.error('[Social Start] Erro de configuração:', cfgErr.message);
      return failureRedirect('not_configured', cfgErr.message);
    }

    if (!config) {
      return failureRedirect('not_configured', 'Integração com esta rede social ainda não está configurada no ambiente.');
    }

    // 4. Validação e resolução de autoridade sobre o titular
    const admin = createAdminClient();
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('is_master_admin')
      .eq('id', user.id)
      .maybeSingle();

    let canonicalOwnerId = rawOwnerId;

    if (ownerType === 'creator') {
      // Resolve canonicamente o ID em creator_profiles (NUNCA usa affiliate_profiles.id)
      let creatorProfileId: string | null = null;

      if (rawOwnerId) {
        const { data: cp } = await (admin.from('creator_profiles') as any)
          .select('id')
          .eq('id', rawOwnerId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (cp) creatorProfileId = cp.id;
      }

      // Se não encontrou pelo ID passado, busca pelo user.id
      if (!creatorProfileId) {
        const { data: cpByUser } = await (admin.from('creator_profiles') as any)
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cpByUser) creatorProfileId = cpByUser.id;
      }

      // Se ainda não existir, auto-provisiona canonicamente
      if (!creatorProfileId) {
        const { data: provId, error: provErr } = await (admin.rpc as any)('ensure_canonical_creator_profile', {
          p_user_id: user.id,
        });
        if (!provErr && provId) creatorProfileId = provId;
      }

      if (!creatorProfileId && !profile?.is_master_admin) {
        return failureRedirect('unauthorized', 'Não foi possível validar seu perfil Creator.');
      }

      canonicalOwnerId = creatorProfileId || user.id;
    } else if (ownerType === 'company') {
      if (!rawOwnerId) {
        return failureRedirect('invalid_owner', 'Identificador da empresa não informado.');
      }

      const isMaster = Boolean(profile?.is_master_admin);
      if (!isMaster) {
        const { data: member } = await (supabase.from('company_users') as any)
          .select('id')
          .eq('company_id', rawOwnerId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .in('role', ['owner', 'admin'])
          .maybeSingle();

        if (!member) {
          return failureRedirect('unauthorized', 'Sem autoridade administrativa sobre a empresa.');
        }
      }
      canonicalOwnerId = rawOwnerId;
    } else {
      return failureRedirect('invalid_owner', 'Tipo de titular não suportado.');
    }

    // 5. Geração do State OAuth com segredo dedicado
    const state = generateOAuthState({
      userId: user.id,
      ownerType: ownerType as any,
      ownerId: canonicalOwnerId!,
      provider,
      returnTo,
    });

    // 6. Montagem da URL de redirecionamento oficial
    const dialogUrl = new URL(config.dialogUrl);
    dialogUrl.searchParams.set('client_id', config.appId);
    dialogUrl.searchParams.set('redirect_uri', config.redirectUri);
    dialogUrl.searchParams.set('response_type', 'code');
    dialogUrl.searchParams.set('state', state);

    if (provider === 'facebook' && config.configId) {
      // Facebook Login for Business exige o ID da configuração; ele substitui scope.
      dialogUrl.searchParams.set('config_id', config.configId);
      // Revalida consentimentos antigos para garantir as permissões da configuração atual.
      dialogUrl.searchParams.set('auth_type', 'rerequest');
    } else {
      dialogUrl.searchParams.set('scope', config.scopes.join(','));
    }

    if (provider === 'instagram') {
      dialogUrl.searchParams.set('enable_fb_login', '0');
      dialogUrl.searchParams.set('force_authentication', '1');
    }

    logSafeOAuthDiagnostics('authorization', config);

    return NextResponse.redirect(dialogUrl);
  } catch (err: any) {
    console.error('[Social Start] Erro inesperado:', err);
    return failureRedirect('unexpected', 'Não foi possível iniciar a conexão neste momento.');
  }
}
