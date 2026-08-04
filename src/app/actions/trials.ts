'use server';

import { createClient } from '@/lib/supabase/server';
import { getPlatformCivilDate, getTrialDaysRemaining } from '@/lib/trial-days';
import crypto from 'crypto';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VIP-${code}`;
}

/**
 * 1. Criar Trial de 60 Dias para uma Empresa
 */
export async function createTrialForCompanyAction(companyId: string, days = 60) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + days);

  const { data: newTrial, error } = await (supabase.from('company_trials') as any)
    .insert({
      company_id: companyId,
      trial_start_date: startDate.toISOString().split('T')[0],
      trial_end_date: endDate.toISOString().split('T')[0],
      trial_days: days,
      status: 'active',
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !newTrial) {
    return { success: false, error: error?.message || 'Erro ao criar trial da empresa.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'TRIAL_CREATED',
    details: { trial_id: newTrial.id, days },
  });

  return { success: true, trial: newTrial };
}

/**
 * 2. Converter Trial (Fechamento de Plano Comercial)
 */
export async function convertTrialAction(companyId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const now = new Date().toISOString();

  // Buscar trial ativo
  const { data: activeTrial } = await (supabase.from('company_trials') as any)
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single();

  if (activeTrial) {
    await (supabase.from('company_trials') as any)
      .update({ status: 'converted', converted_at: now, updated_at: now })
      .eq('id', activeTrial.id);
  } else {
    // Se não tinha trial ativo, cria registro convertido
    await (supabase.from('company_trials') as any).insert({
      company_id: companyId,
      status: 'converted',
      converted_at: now,
      created_by: user.id,
    });
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'TRIAL_CONVERTED',
    details: { company_id: companyId },
  });

  return { success: true };
}

/**
 * 3. Cancelar Trial da Empresa
 */
export async function cancelTrialAction(companyId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const now = new Date().toISOString();

  const { error } = await (supabase.from('company_trials') as any)
    .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'TRIAL_CANCELLED',
    details: { company_id: companyId },
  });

  return { success: true };
}

/**
 * 4. Obter Status do Trial e Convites VIP da Empresa
 */
export async function getCompanyTrialStatusAction(companyId: string) {
  const supabase = createClient();

  // Buscar trial mais recente da empresa
  const { data: trials } = await (supabase.from('company_trials') as any)
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1);

  const trial = trials && trials.length > 0 ? trials[0] : null;

  let daysRemaining = 0;
  let isExpired = false;

  if (trial && trial.status === 'active') {
    daysRemaining = getTrialDaysRemaining(trial.trial_end_date, trial.trial_days);
    const today = getPlatformCivilDate();

    if (trial.trial_end_date < today) {
      isExpired = true;
      // Auto-expirar trial
      await (supabase.from('company_trials') as any)
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', trial.id);
      trial.status = 'expired';
    }
  }

  // Contar convites VIP emitidos/utilizados (created, sent, accepted, converted)
  const { count: activeInvitesCount } = await (supabase.from('referral_invites') as any)
    .select('*', { count: 'exact', head: true })
    .eq('inviter_company_id', companyId)
    .in('status', ['created', 'sent', 'accepted', 'converted']);

  const invitesUsed = activeInvitesCount || 0;
  const invitesAvailable = Math.max(0, 3 - invitesUsed);

  return {
    success: true,
    trial,
    daysRemaining,
    isExpired,
    invitesUsed,
    invitesAvailable,
    isConverted: trial?.status === 'converted',
  };
}

/**
 * 5. Criar Convite VIP (Limite de 3 por Empresa Convertida)
 */
export async function createReferralInviteAction(
  inviterCompanyId: string,
  payload: {
    invited_company_name: string;
    invited_contact_name?: string | null;
    invited_email?: string | null;
    invited_phone?: string | null;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Verificar se o trial da empresa está convertido ou se o usuário é Master Admin
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  const isMaster = !!profile?.is_master_admin;

  if (!isMaster) {
    const { data: trial } = await (supabase.from('company_trials') as any)
      .select('status')
      .eq('company_id', inviterCompanyId)
      .eq('status', 'converted')
      .single();

    if (!trial) {
      return {
        success: false,
        error: 'Apenas empresas com trial convertido ou plano ativado podem emitir convites VIP.',
      };
    }
  }

  // Gerar Código Único VIP-XXXXXX
  let code = generateInviteCode();
  let codeExists = true;
  let attempts = 0;

  while (codeExists && attempts < 5) {
    const { data: existing } = await (supabase.from('referral_invites') as any)
      .select('id')
      .eq('invite_code', code)
      .single();

    if (!existing) {
      codeExists = false;
    } else {
      code = generateInviteCode();
      attempts++;
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // Validade de 30 dias

  // O Trigger trg_check_referral_invite_limit no Postgres garantirá a rejeição do 4º convite
  const { data: newInvite, error } = await (supabase.from('referral_invites') as any)
    .insert({
      inviter_company_id: inviterCompanyId,
      invited_company_name: payload.invited_company_name,
      invited_contact_name: payload.invited_contact_name || null,
      invited_email: payload.invited_email || null,
      invited_phone: payload.invited_phone || null,
      invite_code: code,
      trial_days: 60,
      status: 'created',
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !newInvite) {
    return { success: false, error: error?.message || 'Erro ao criar convite VIP.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: inviterCompanyId,
    action: 'REFERRAL_INVITE_CREATED',
    details: { invite_id: newInvite.id, code, invited_company: payload.invited_company_name },
  });

  return { success: true, invite: newInvite };
}

/**
 * 6. Cancelar Convite VIP Emitido
 */
export async function cancelReferralInviteAction(inviteId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: invite } = await (supabase.from('referral_invites') as any)
    .select('inviter_company_id, status')
    .eq('id', inviteId)
    .single();

  if (!invite) {
    return { success: false, error: 'Convite não encontrado.' };
  }

  if (invite.status === 'accepted' || invite.status === 'converted') {
    return { success: false, error: 'Convites já aceitos ou convertidos não podem ser cancelados.' };
  }

  const { error } = await (supabase.from('referral_invites') as any)
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: invite.inviter_company_id,
    action: 'REFERRAL_INVITE_CANCELLED',
    details: { invite_id: inviteId },
  });

  return { success: true };
}

/**
 * 7. Obter Detalhes do Convite por Código (Rota Pública /invite/[code])
 */
export async function getReferralInviteByCodeAction(inviteCode: string) {
  if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length < 5) {
    return { success: false, error: 'Código de convite inválido ou malformado.' };
  }

  const supabase = createClient();
  const cleanCode = inviteCode.trim().toUpperCase();

  const { data: invite, error } = await (supabase.from('referral_invites') as any)
    .select('id, invite_code, invited_company_name, invited_contact_name, trial_days, status, expires_at, inviter_company_id, companies!referral_invites_inviter_company_id_fkey(trade_name)')
    .eq('invite_code', cleanCode)
    .single();

  if (error || !invite) {
    return { success: false, error: 'Convite não encontrado ou inválido.' };
  }

  // Validar Expiração
  const now = new Date();
  const expiresAt = new Date(invite.expires_at);

  if (now > expiresAt && (invite.status === 'created' || invite.status === 'sent')) {
    await (supabase.from('referral_invites') as any)
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('id', invite.id);
    return { success: false, error: 'Este convite VIP expirou (validade de 30 dias excedida).' };
  }

  if (invite.status === 'cancelled') {
    return { success: false, error: 'Este convite VIP foi cancelado pela empresa emissora.' };
  }

  if (invite.status === 'accepted' || invite.status === 'converted') {
    return { success: false, error: 'Este convite VIP já foi utilizado anteriormente.' };
  }

  return {
    success: true,
    invite: {
      id: invite.id,
      invite_code: invite.invite_code,
      invited_company_name: invite.invited_company_name,
      invited_contact_name: invite.invited_contact_name,
      trial_days: invite.trial_days,
      expires_at: invite.expires_at,
      inviter_trade_name: invite.companies?.trade_name || 'Empresa Parceira',
    },
  };
}

/**
 * 8. Aceitar Convite VIP (Rota Pública /invite/[code])
 */
export async function acceptReferralInviteAction(
  inviteCode: string,
  payload: {
    company_name: string;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
  }
) {
  const supabase = createClient();
  const cleanCode = inviteCode.trim().toUpperCase();

  const { data: invite } = await (supabase.from('referral_invites') as any)
    .select('*')
    .eq('invite_code', cleanCode)
    .single();

  if (!invite) {
    return { success: false, error: 'Convite não encontrado.' };
  }

  // 1. Validar se não foi cancelado, aceito ou convertido
  if (invite.status === 'cancelled') {
    return { success: false, error: 'Este convite VIP foi cancelado pela empresa emissora.' };
  }

  if (invite.status === 'accepted' || invite.status === 'converted') {
    return { success: false, error: 'Este convite VIP já foi utilizado anteriormente.' };
  }

  if (invite.status !== 'created' && invite.status !== 'sent') {
    return { success: false, error: 'Este convite já foi processado ou expirou.' };
  }

  // 2. Validar expiração por data (expires_at)
  const now = new Date();
  const expiresAt = new Date(invite.expires_at);

  if (now > expiresAt) {
    await (supabase.from('referral_invites') as any)
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('id', invite.id);
    return { success: false, error: 'Este convite VIP expirou (validade de 30 dias excedida).' };
  }

  // 3. Validação Anti-Duplicidade (e-mail ou telefone já aceito)
  if (payload.email) {
    const { data: existingEmail } = await (supabase.from('referral_invites') as any)
      .select('id')
      .eq('invited_email', payload.email)
      .in('status', ['accepted', 'converted'])
      .limit(1);

    if (existingEmail && existingEmail.length > 0) {
      return { success: false, error: 'Já existe um convite VIP aceito ou convertido para este e-mail.' };
    }
  }

  if (payload.phone) {
    const { data: existingPhone } = await (supabase.from('referral_invites') as any)
      .select('id')
      .eq('invited_phone', payload.phone)
      .in('status', ['accepted', 'converted'])
      .limit(1);

    if (existingPhone && existingPhone.length > 0) {
      return { success: false, error: 'Já existe um convite VIP aceito ou convertido para este telefone.' };
    }
  }

  const nowIso = now.toISOString();

  // Marcar Convite como Aceito e preencher accepted_at
  const { error } = await (supabase.from('referral_invites') as any)
    .update({
      status: 'accepted',
      accepted_at: nowIso,
      updated_at: nowIso,
      invited_company_name: payload.company_name,
      invited_contact_name: payload.contact_name || invite.invited_contact_name,
      invited_email: payload.email || invite.invited_email,
      invited_phone: payload.phone || invite.invited_phone,
    })
    .eq('id', invite.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    company_id: invite.inviter_company_id,
    action: 'REFERRAL_INVITE_ACCEPTED',
    details: { invite_id: invite.id, code: cleanCode, accepted_company: payload.company_name },
  });

  return {
    success: true,
    message: 'Convite VIP aceito com sucesso! Você ganhou 60 dias de degustação gratuita na Rede Indoor Local.',
  };
}

/**
 * 9. Obter Lista de Convites Emitidos pela Empresa
 */
export async function getReferralInvitesAction(companyId: string) {
  const supabase = createClient();

  const { data: invites } = await (supabase.from('referral_invites') as any)
    .select('*')
    .eq('inviter_company_id', companyId)
    .order('created_at', { ascending: false });

  return { success: true, invites: invites || [] };
}
