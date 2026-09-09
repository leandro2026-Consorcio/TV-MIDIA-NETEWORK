'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const hash = (value: string) => crypto.createHash('sha256').update(value.trim()).digest('hex');

const CASHIER_COOKIE_NAME = 'mpm_cashier_session';

/**
 * Autenticação do operador do caixa com Código do Estabelecimento + PIN
 */
export async function cashierLoginAction(payload: {
  establishmentCode: string;
  pin: string;
  deviceName?: string;
  rememberDevice?: boolean;
}) {
  const code = (payload.establishmentCode || '').trim().toUpperCase();
  const pin = (payload.pin || '').trim();

  if (!code || code.length < 3) {
    return { success: false as const, error: 'Código do estabelecimento inválido.' };
  }
  if (!pin || pin.length < 4 || pin.length > 8) {
    return { success: false as const, error: 'PIN deve conter entre 4 e 8 dígitos.' };
  }

  const admin: any = createAdminClient();
  const pinHash = hash(pin);

  // Busca dados de acesso da empresa
  const { data: access, error: accessErr } = await (admin.from('company_cashier_access') as any)
    .select('*, companies(id, trade_name, city, neighborhood, address)')
    .eq('establishment_code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (accessErr || !access) {
    return { success: false as const, error: 'Estabelecimento não encontrado ou inativo.' };
  }

  if (access.pin_hash !== pinHash) {
    return { success: false as const, error: 'PIN incorreto.' };
  }

  // Gera token de sessão e registra dispositivo autorizado
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hash(rawToken);
  const maxAgeDays = payload.rememberDevice ? 30 : 1;
  const expiresAt = new Date(Date.now() + maxAgeDays * 86400 * 1000).toISOString();

  const { error: devErr } = await (admin.from('company_cashier_devices') as any).insert({
    company_id: access.company_id,
    device_fingerprint_hash: hash(payload.deviceName || 'Navegador Caixa'),
    device_name: payload.deviceName || 'Terminal do Caixa',
    session_token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (devErr) {
    return { success: false as const, error: 'Falha ao autorizar dispositivo.' };
  }

  // Grava cookie de sessão
  try {
    const cookieStore = await cookies();
    cookieStore.set(CASHIER_COOKIE_NAME, `${access.company_id}:${rawToken}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeDays * 86400,
    });
  } catch (err) {
    console.warn('[cashierLoginAction] Cookie setting skipped or handled client-side:', err);
  }

  return {
    success: true as const,
    sessionToken: `${access.company_id}:${rawToken}`,
    company: {
      id: access.company_id,
      tradeName: access.companies?.trade_name || 'Estabelecimento',
      city: access.companies?.city || '',
      neighborhood: access.companies?.neighborhood || '',
      address: access.companies?.address || '',
    },
  };
}

/**
 * Validação da sessão ativa do caixa
 */
async function resolveCashierSession(explicitToken?: string) {
  let tokenStr = explicitToken;
  if (!tokenStr) {
    try {
      const cookieStore = await cookies();
      tokenStr = cookieStore.get(CASHIER_COOKIE_NAME)?.value;
    } catch {}
  }

  if (!tokenStr || !tokenStr.includes(':')) {
    return null;
  }

  const [companyId, rawToken] = tokenStr.split(':');
  if (!companyId || !rawToken) return null;

  const admin: any = createAdminClient();
  const tokenHash = hash(rawToken);

  const { data: device } = await (admin.from('company_cashier_devices') as any)
    .select('*, companies(id, trade_name, city, neighborhood, address)')
    .eq('company_id', companyId)
    .eq('session_token_hash', tokenHash)
    .eq('is_revoked', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!device) return null;

  // Atualiza timestamp de última atividade
  await (admin.from('company_cashier_devices') as any)
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', device.id);

  return {
    companyId,
    company: device.companies,
    deviceId: device.id,
  };
}

/**
 * Consulta cupom no Caixa sem expor dados sensíveis do cliente (sem CPF, telefone, etc.)
 */
export async function cashierLookupCouponAction(payload: {
  codeOrToken: string;
  sessionToken?: string;
}) {
  const session = await resolveCashierSession(payload.sessionToken);
  if (!session) {
    return { success: false as const, error: 'Sessão do caixa expirada ou inválida. Faça login novamente.' };
  }

  const search = (payload.codeOrToken || '').trim().toUpperCase();
  if (search.length < 4) {
    return { success: false as const, error: 'Informe o código do cupom ou escaneie o QR Code.' };
  }

  const admin: any = createAdminClient();
  const searchHash = crypto.createHash('sha256').update(search).digest('hex');

  // Busca o cupom
  const { data: redemption, error } = await (admin.from('organic_reward_redemptions') as any)
    .select('*, organic_campaign_rewards(*)')
    .or(`coupon_code.eq.${search},qr_token.eq.${payload.codeOrToken.trim()},redemption_code_hash.eq.${searchHash}`)
    .maybeSingle();

  if (error || !redemption) {
    return { success: false as const, error: 'Cupom não encontrado.' };
  }

  const reward = redemption.organic_campaign_rewards;
  if (!reward) {
    return { success: false as const, error: 'Benefício associado não encontrado.' };
  }

  // Verifica se o cupom pertence ao estabelecimento logado
  if (reward.company_id !== session.companyId && redemption.company_id !== session.companyId) {
    return { success: false as const, error: 'Este cupom pertence a outro estabelecimento.' };
  }

  // Validação de estado
  if (redemption.status === 'redeemed') {
    const dataHora = redemption.redeemed_at ? new Date(redemption.redeemed_at).toLocaleString('pt-BR') : '';
    return {
      success: false as const,
      error: `Cupom já foi utilizado${dataHora ? ' em ' + dataHora : ''}.`,
      isAlreadyRedeemed: true,
    };
  }

  if (redemption.status === 'expired' || new Date(redemption.expires_at).getTime() <= Date.now()) {
    return { success: false as const, error: 'Cupom expirado.' };
  }

  if (redemption.status === 'cancelled') {
    return { success: false as const, error: 'Cupom cancelado.' };
  }

  // Validação de dias da semana
  const now = new Date();
  const dow = now.getDay();
  if (Array.isArray(reward.allowed_weekdays) && reward.allowed_weekdays.length > 0) {
    if (!reward.allowed_weekdays.includes(dow)) {
      return { success: false as const, error: 'Cupom não é válido para utilização no dia de hoje.' };
    }
  }

  // Validação de horário
  if (reward.allowed_time_start && reward.allowed_time_end) {
    const currentHM = now.toTimeString().slice(0, 5); // "HH:MM"
    const startHM = reward.allowed_time_start.slice(0, 5);
    const endHM = reward.allowed_time_end.slice(0, 5);
    if (currentHM < startHM || currentHM > endHM) {
      return {
        success: false as const,
        error: `Cupom ainda não pode ser utilizado neste horário (válido entre ${startHM} e ${endHM}).`,
      };
    }
  }

  // Sanitização de dados: apenas o primeiro nome do cliente e dados do benefício
  const firstName = (redemption.participant_display_name || 'Cliente').split(' ')[0];

  return {
    success: true as const,
    coupon: {
      id: redemption.id,
      code: redemption.coupon_code || redemption.redemption_code_suffix,
      clientFirstName: firstName,
      benefitTitle: reward.title,
      allowedHours: reward.allowed_time_start && reward.allowed_time_end ? `${reward.allowed_time_start.slice(0, 5)}–${reward.allowed_time_end.slice(0, 5)}` : 'Livre',
      allowedUnit: (reward.unit_locations && reward.unit_locations.length > 0) ? reward.unit_locations.join(', ') : 'Qualquer unidade',
      expiresAt: redemption.expires_at,
      minConsumption: reward.min_consumption,
      terms: reward.terms,
    },
  };
}

/**
 * Validação atômica e baixa do cupom no Caixa, gerando Visita Confirmada
 */
export async function cashierRedeemCouponAction(payload: {
  couponIdOrCode: string;
  locationUnit?: string;
  validationMethod?: 'qr' | 'code' | 'manual';
  notes?: string;
  sessionToken?: string;
}) {
  const session = await resolveCashierSession(payload.sessionToken);
  if (!session) {
    return { success: false as const, error: 'Sessão do caixa expirada. Faça login novamente.' };
  }

  const admin: any = createAdminClient();

  // Executa RPC validate_and_redeem_coupon passando cashier_company_id
  const { data, error } = await (admin.rpc as any)('validate_and_redeem_coupon', {
    p_code_or_token: payload.couponIdOrCode,
    p_location_unit: payload.locationUnit || null,
    p_validation_method: payload.validationMethod || 'code',
    p_notes: payload.notes || null,
    p_cashier_company_id: session.companyId,
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  if (!data?.success) {
    return { success: false as const, error: data?.error || 'Não foi possível validar o cupom.' };
  }

  return {
    success: true as const,
    message: 'Visita confirmada com sucesso.',
    visitsConfirmed: data.visits_confirmed,
    targetVisits: data.target_visits,
    goalReached: !!data.goal_reached,
    rewardTitle: data.reward_title,
    participantName: data.participant_name,
  };
}

/**
 * Logout do operador de caixa
 */
export async function cashierLogoutAction(sessionToken?: string) {
  const session = await resolveCashierSession(sessionToken);
  if (session?.deviceId) {
    const admin: any = createAdminClient();
    await (admin.from('company_cashier_devices') as any)
      .update({ is_revoked: true })
      .eq('id', session.deviceId);
  }
  try {
    const cookieStore = await cookies();
    cookieStore.delete(CASHIER_COOKIE_NAME);
  } catch {}
  return { success: true as const };
}

/**
 * Busca configurações de caixa para o painel da Empresa
 */
export async function getCompanyCashierSettingsAction(companyId: string) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).single();
  const isMaster = !!profile?.is_master_admin;

  if (!isMaster) {
    const { data: userRole } = await (supabase.from('company_users') as any)
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!userRole) return { success: false as const, error: 'Acesso negado à empresa.' };
  }

  const admin: any = createAdminClient();

  // Busca ou provisiona credenciais de caixa
  let { data: access } = await (admin.from('company_cashier_access') as any)
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (!access) {
    // Provisiona código de estabelecimento único
    const { data: company } = await (admin.from('companies') as any).select('trade_name').eq('id', companyId).single();
    const cleanPrefix = (company?.trade_name || 'MPM').replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'MPM';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const estCode = `${cleanPrefix}${randomDigits}`;
    const defaultPin = '1234';
    const pinHash = hash(defaultPin);
    const qrToken = crypto.randomUUID();

    const { data: newAccess } = await (admin.from('company_cashier_access') as any).insert({
      company_id: companyId,
      establishment_code: estCode,
      pin_hash: pinHash,
      qr_access_token: qrToken,
      is_active: true,
    }).select().single();

    access = newAccess;
  }

  // Busca dispositivos autorizados
  const { data: devices } = await (admin.from('company_cashier_devices') as any)
    .select('*')
    .eq('company_id', companyId)
    .eq('is_revoked', false)
    .order('last_used_at', { ascending: false })
    .limit(10);

  // Busca histórico recente de validações
  const { data: recentValidations } = await (admin.from('organic_reward_redemptions') as any)
    .select('id, coupon_code, redeemed_at, participant_display_name, validation_method, location_unit, organic_campaign_rewards(title)')
    .eq('company_id', companyId)
    .eq('status', 'redeemed')
    .order('redeemed_at', { ascending: false })
    .limit(10);

  return {
    success: true as const,
    access: {
      establishmentCode: access?.establishment_code,
      qrAccessToken: access?.qr_access_token,
      hasPin: !!access?.pin_hash,
      isActive: access?.is_active,
    },
    devices: devices || [],
    recentValidations: recentValidations || [],
  };
}

/**
 * Atualiza ou rotaciona o PIN do Caixa
 */
export async function updateCompanyCashierPinAction(companyId: string, newPin: string) {
  const pin = (newPin || '').trim();
  if (pin.length < 4 || pin.length > 8) {
    return { success: false as const, error: 'O PIN deve ter entre 4 e 8 dígitos.' };
  }

  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const admin: any = createAdminClient();
  const pinHash = hash(pin);

  const { error } = await (admin.from('company_cashier_access') as any)
    .update({ pin_hash: pinHash, updated_at: new Date().toISOString() })
    .eq('company_id', companyId);

  if (error) return { success: false as const, error: error.message };

  return { success: true as const, message: 'PIN do Caixa atualizado com sucesso.' };
}

/**
 * Revoga dispositivo do caixa
 */
export async function revokeCashierDeviceAction(deviceId: string) {
  const admin: any = createAdminClient();
  const { error } = await (admin.from('company_cashier_devices') as any)
    .update({ is_revoked: true })
    .eq('id', deviceId);

  return error ? { success: false as const, error: error.message } : { success: true as const };
}
