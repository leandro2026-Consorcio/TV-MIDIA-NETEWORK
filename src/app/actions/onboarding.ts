'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface PublicSignupSettings {
  enabled: boolean;
  trialDays: number;
  invitesCount: number;
  autoApproveTrialInternalMedia: boolean;
  disabledMessage: string;
}

export interface CompanySignupInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  tradeName: string;
  corporateName?: string;
  cnpj?: string;
  city: string;
  state: string;
  segmentId: string;
  acceptedTerms: boolean;
  inviteCode?: string;
}

const DEFAULT_SETTINGS: PublicSignupSettings = {
  enabled: false,
  trialDays: 60,
  invitesCount: 3,
  autoApproveTrialInternalMedia: true,
  disabledMessage: 'Novos cadastros estão temporariamente indisponíveis. Fale com nosso atendimento.',
};

function cleanText(value: unknown, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

function readSetting(rows: any[], key: string, fallback: unknown) {
  const row = rows.find((item) => item.key === key);
  return row?.value ?? fallback;
}

export async function getPublicSignupSettingsAction() {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin.from('platform_settings') as any)
      .select('key, value')
      .in('key', [
        'public_trial_signup_enabled',
        'public_trial_days',
        'trial_invites_count',
        'auto_approve_trial_internal_media',
        'public_signup_disabled_message',
      ]);

    if (error) throw error;
    const rows = data || [];
    return {
      success: true as const,
      settings: {
        enabled: Boolean(readSetting(rows, 'public_trial_signup_enabled', false)),
        trialDays: Number(readSetting(rows, 'public_trial_days', 60)),
        invitesCount: Number(readSetting(rows, 'trial_invites_count', 3)),
        autoApproveTrialInternalMedia: Boolean(readSetting(rows, 'auto_approve_trial_internal_media', true)),
        disabledMessage: String(readSetting(rows, 'public_signup_disabled_message', DEFAULT_SETTINGS.disabledMessage)),
      } satisfies PublicSignupSettings,
    };
  } catch {
    return { success: false as const, settings: DEFAULT_SETTINGS, error: 'Não foi possível consultar a disponibilidade do cadastro.' };
  }
}

export async function getPublicSegmentsAction() {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin.from('segments') as any)
      .select('id, name')
      .order('name');
    if (error) throw error;
    return { success: true as const, segments: data || [] };
  } catch {
    return { success: false as const, segments: [], error: 'Não foi possível carregar os segmentos.' };
  }
}

export async function getPublicInviteAction(code: string) {
  const cleanCode = cleanText(code, 40).toUpperCase();
  if (!cleanCode) return { success: false as const, error: 'Convite inválido.' };

  try {
    const admin = createAdminClient();
    const { data: invite } = await (admin.from('referral_invites') as any)
      .select('id, invite_code, status, expires_at, trial_days_granted, inviter_company_id, companies!referral_invites_inviter_company_id_fkey(trade_name)')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (!invite || !['available', 'created', 'sent'].includes(invite.status)) {
      return { success: false as const, error: 'Este convite é inválido ou já foi utilizado.' };
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      await (admin.from('referral_invites') as any)
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invite.id);
      return { success: false as const, error: 'Este convite expirou.' };
    }

    return {
      success: true as const,
      invite: {
        code: invite.invite_code,
        trialDays: invite.trial_days_granted || 60,
        inviterName: invite.companies?.trade_name || 'Empresa parceira',
      },
    };
  } catch {
    return { success: false as const, error: 'Não foi possível validar este convite.' };
  }
}

export async function registerCompanyWithTrialAction(input: CompanySignupInput) {
  const payload = {
    fullName: cleanText(input.fullName),
    email: cleanText(input.email, 254).toLowerCase(),
    password: String(input.password || ''),
    phone: cleanText(input.phone, 30),
    tradeName: cleanText(input.tradeName),
    corporateName: cleanText(input.corporateName),
    cnpj: cleanText(input.cnpj, 24),
    city: cleanText(input.city, 100),
    state: cleanText(input.state, 2).toUpperCase(),
    segmentId: cleanText(input.segmentId, 50),
    inviteCode: cleanText(input.inviteCode, 40).toUpperCase(),
  };

  if (!input.acceptedTerms) return { success: false as const, error: 'É necessário aceitar os termos de uso.' };
  if (!payload.fullName || !payload.email || !payload.phone || !payload.tradeName || !payload.city || !payload.segmentId) {
    return { success: false as const, error: 'Preencha todos os campos obrigatórios.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { success: false as const, error: 'Informe um e-mail válido.' };
  }
  if (payload.password.length < 6) return { success: false as const, error: 'A senha deve ter pelo menos 6 caracteres.' };
  if (!/^[A-Z]{2}$/.test(payload.state)) return { success: false as const, error: 'Informe a UF com duas letras.' };

  const settingsResult = await getPublicSignupSettingsAction();
  if (!settingsResult.settings.enabled) {
    try {
      const admin = createAdminClient();
      await (admin.from('audit_logs') as any).insert({
        action: 'PUBLIC_SIGNUP_BLOCKED_BY_SETTING',
        details: { email: payload.email, origin: 'phase6c' },
      });
    } catch {}
    return { success: false as const, error: settingsResult.settings.disabledMessage, disabled: true };
  }

  if (payload.inviteCode) {
    const inviteResult = await getPublicInviteAction(payload.inviteCode);
    if (!inviteResult.success) return inviteResult;
  }

  const admin = createAdminClient();
  const sessionClient = createClient();
  const { data: { user: sessionUser } } = await sessionClient.auth.getUser();
  let userId = sessionUser?.id;
  let createdAuthUser = false;

  if (sessionUser && sessionUser.email?.toLowerCase() !== payload.email) {
    return { success: false as const, error: 'O e-mail informado deve ser o mesmo da conta conectada.' };
  }

  if (sessionUser) {
    const { data: existingLink } = await (admin.from('company_users') as any)
      .select('company_id')
      .eq('user_id', sessionUser.id)
      .limit(1)
      .maybeSingle();
    if (existingLink) {
      await (admin.from('audit_logs') as any).insert({
        user_id: sessionUser.id,
        company_id: existingLink.company_id,
        action: 'PUBLIC_ONBOARDING_SECOND_COMPANY_BLOCKED',
        details: { origin: 'phase6c_action' },
      });
      return { success: false as const, error: 'Sua conta já possui uma empresa. Acesse o dashboard.', alreadyOnboarded: true };
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      phone_confirm: false,
      user_metadata: { full_name: payload.fullName, phone: payload.phone, signup_origin: 'public_trial' },
    });
    if (error || !data.user) {
      return { success: false as const, error: error?.message || 'Não foi possível criar sua conta.' };
    }
    userId = data.user.id;
    createdAuthUser = true;
  }

  const { data, error } = await (admin.rpc as any)('complete_public_company_onboarding', {
    p_user_id: userId,
    p_full_name: payload.fullName,
    p_phone: payload.phone,
    p_trade_name: payload.tradeName,
    p_corporate_name: payload.corporateName,
    p_cnpj: payload.cnpj,
    p_city: payload.city,
    p_state: payload.state,
    p_segment_id: payload.segmentId,
    p_invite_code: payload.inviteCode || null,
  });

  if (error) {
    let rollbackError: string | null = null;
    if (createdAuthUser && userId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      rollbackError = deleteError?.message || null;
      if (rollbackError) {
        await (admin.from('audit_logs') as any).insert({
          user_id: userId,
          action: 'PUBLIC_AUTH_ROLLBACK_FAILED',
          details: { reason: rollbackError, onboarding_error: error.message },
        });
      }
    }
    const knownErrors: Record<string, string> = {
      USER_ALREADY_HAS_COMPANY: 'Sua conta já possui uma empresa.',
      INVALID_INVITE: 'Este convite é inválido ou já foi utilizado.',
      EXPIRED_INVITE: 'Este convite expirou.',
      PUBLIC_SIGNUP_DISABLED: settingsResult.settings.disabledMessage,
    };
    const key = Object.keys(knownErrors).find((item) => error.message?.includes(item));
    return {
      success: false as const,
      error: rollbackError
        ? 'O cadastro não foi concluído e a limpeza automática da conta requer revisão administrativa.'
        : key ? knownErrors[key] : error.message || 'Não foi possível concluir o cadastro.',
    };
  }

  return {
    success: true as const,
    companyId: data.company_id as string,
    trialDays: Number(data.trial_days),
    invitesCreated: Number(data.invites_created),
    shouldSignIn: createdAuthUser,
  };
}

export async function getOnboardingContextAction() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();
  const { data: link } = await (supabase.from('company_users') as any)
    .select('company_id, role, companies(trade_name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!link) return { success: true as const, hasCompany: false, isMaster: !!profile?.is_master_admin };

  const companyId = link.company_id;
  const [{ data: trial }, { data: invites }, screenResult, mediaResult, playlistResult] = await Promise.all([
    (supabase.from('company_trials') as any).select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    (supabase.from('referral_invites') as any).select('*').eq('inviter_company_id', companyId).order('created_at'),
    (supabase.from('screens') as any).select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    (supabase.from('media_assets') as any).select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    (supabase.from('playlists') as any).select('*', { count: 'exact', head: true }).eq('company_id', companyId),
  ]);

  let daysRemaining = 0;
  let effectiveStatus = trial?.status || 'none';
  if (trial?.status === 'active') {
    const end = new Date(`${trial.trial_end_date}T23:59:59`);
    daysRemaining = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
    if (daysRemaining === 0 && end.getTime() < Date.now()) effectiveStatus = 'expired';
  }

  return {
    success: true as const,
    hasCompany: true,
    isMaster: !!profile?.is_master_admin,
    companyId,
    companyName: link.companies?.trade_name || 'Minha empresa',
    role: link.role,
    trial: trial ? { ...trial, status: effectiveStatus, daysRemaining } : null,
    invites: invites || [],
    checklist: {
      screen: (screenResult.count || 0) > 0,
      media: (mediaResult.count || 0) > 0,
      playlist: (playlistResult.count || 0) > 0,
    },
  };
}

export async function updatePlatformTrialSettingsAction(settings: PublicSignupSettings) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin').eq('id', user.id).single();
  if (!profile?.is_master_admin) return { success: false as const, error: 'Acesso exclusivo do Master Admin.' };

  const trialDays = Math.max(1, Math.min(365, Number(settings.trialDays) || 60));
  const invitesCount = Math.max(1, Math.min(10, Number(settings.invitesCount) || 3));
  const rows = [
    ['public_trial_signup_enabled', Boolean(settings.enabled)],
    ['public_trial_days', trialDays],
    ['trial_invites_count', invitesCount],
    ['auto_approve_trial_internal_media', Boolean(settings.autoApproveTrialInternalMedia)],
    ['public_signup_disabled_message', cleanText(settings.disabledMessage, 500) || DEFAULT_SETTINGS.disabledMessage],
  ].map(([key, value]) => ({ key, value, updated_by: user.id, updated_at: new Date().toISOString() }));

  const admin = createAdminClient();
  const { error } = await (admin.from('platform_settings') as any).upsert(rows, { onConflict: 'key' });
  if (error) return { success: false as const, error: error.message };
  await (admin.from('audit_logs') as any).insert({
    user_id: user.id,
    action: 'PLATFORM_TRIAL_SETTINGS_UPDATED',
    details: { enabled: settings.enabled, trial_days: trialDays, invites_count: invitesCount },
  });
  return { success: true as const };
}
