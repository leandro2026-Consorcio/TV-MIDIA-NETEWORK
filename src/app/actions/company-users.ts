'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type CompanyAccessRole = 'admin' | 'marketing';

export async function listCompanyAccessAction(companyId: string) {
  const supabase = createClient();
  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    (supabase.rpc as any)('list_company_user_access', { p_company_id: companyId }),
    (supabase.rpc as any)('list_company_user_invites', { p_company_id: companyId }),
  ]);
  const error = membersError || invitesError;
  if (error) return { success: false as const, error: error.message, members: [], invites: [] };
  return { success: true as const, members: members || [], invites: invites || [] };
}

export async function inviteCompanyUserAction(companyId: string, email: string, role: CompanyAccessRole) {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('invite_company_user', {
    p_company_id: companyId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });
  if (error) return { success: false as const, error: error.message };
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const baseUrl = configuredUrl
    ? configuredUrl
    : vercelUrl ? `https://${vercelUrl}` : 'https://midiapormidia.com.br';
  const inviteUrl = `${baseUrl.replace(/\/$/, '')}/company-invite/${data.token}`;
  const redirectTo = `${baseUrl.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(`/company-invite/${data.token}`)}`;
  const admin = createAdminClient();
  const delivery = data.user_exists
    ? await admin.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: redirectTo } })
    : await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), { redirectTo });
  if (!data.user_exists && !delivery.error && 'user' in delivery.data && delivery.data.user) {
    await (admin.from as any)('company_user_invites')
      .update({ provisioned_user_id: delivery.data.user.id, updated_at: new Date().toISOString() })
      .eq('id', data.id);
  }
  return {
    success: true as const,
    inviteUrl,
    expiresAt: data.expires_at as string,
    userExists: Boolean(data.user_exists),
    emailDelivered: !delivery.error,
    deliveryWarning: delivery.error ? 'Convite criado, mas o e-mail não pôde ser entregue. Copie e envie o link seguro.' : null,
  };
}

export async function changeCompanyUserRoleAction(companyId: string, userId: string, role: CompanyAccessRole) {
  const supabase = createClient();
  const { error } = await (supabase.rpc as any)('change_company_user_role', {
    p_company_id: companyId,
    p_target_user_id: userId,
    p_role: role,
  });
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export async function removeCompanyUserAction(companyId: string, userId: string) {
  const supabase = createClient();
  const { error } = await (supabase.rpc as any)('remove_company_user', {
    p_company_id: companyId,
    p_target_user_id: userId,
  });
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export async function resetCompanyUserPasswordAction(companyId: string, userId: string) {
  const supabase = createClient();
  const { data: allowed, error: allowedError } = await (supabase.rpc as any)('is_company_admin', { p_company_id: companyId });
  if (allowedError || !allowed) return { success: false as const, error: 'Apenas ADMIN da empresa ou MASTER pode resetar senhas.' };
  const { data: profile, error: profileError } = await (supabase.from('profiles') as any).select('email').eq('id', userId).maybeSingle();
  if (profileError || !profile?.email) return { success: false as const, error: 'Usuário não encontrado.' };
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const baseUrl = configuredUrl || (vercelUrl ? `https://${vercelUrl}` : 'https://midiapormidia.com.br');
  const admin = createAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(profile.email, { redirectTo: `${baseUrl.replace(/\/$/, '')}/auth/callback?next=/reset-password` });
  return error ? { success: false as const, error: 'Não foi possível enviar o e-mail de redefinição.' } : { success: true as const };
}

export async function getPublicCompanyInviteAction(token: string) {
  if (!/^[a-f0-9]{48}$/i.test(token)) return { success: false as const, error: 'Convite inválido.' };
  const admin = createAdminClient();
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const { data, error } = await (admin.from as any)('company_user_invites')
    .select('email, role, status, expires_at, companies(trade_name)')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !data) return { success: false as const, error: 'Convite inválido.' };
  if (data.status !== 'pending' || new Date(data.expires_at).getTime() <= Date.now()) {
    return { success: false as const, error: 'Este convite expirou ou já foi utilizado.' };
  }
  return {
    success: true as const,
    email: data.email as string,
    role: data.role as CompanyAccessRole,
    companyName: data.companies?.trade_name || 'Empresa MPM',
    expiresAt: data.expires_at as string,
  };
}

export async function createInvitedUserAction(token: string, fullName: string, password: string) {
  const invite = await getPublicCompanyInviteAction(token);
  if (!invite.success) return invite;
  if (fullName.trim().length < 2) return { success: false as const, error: 'Informe seu nome.' };
  if (password.length < 8) return { success: false as const, error: 'Use uma senha pessoal com pelo menos 8 caracteres.' };

  const admin = createAdminClient();
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const { data: inviteRow } = await (admin.from as any)('company_user_invites')
    .select('id, provisioned_user_id, status, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  const { data: existingProfile } = await (admin.from('profiles') as any)
    .select('id').eq('email', invite.email.toLowerCase()).maybeSingle();
  if (existingProfile) {
    if (inviteRow?.status === 'pending' && inviteRow.provisioned_user_id === existingProfile.id) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existingProfile.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim(), signup_origin: 'company_user_invite', initial_password: false },
      });
      if (updateError) return { success: false as const, error: 'Não foi possível definir sua senha pessoal.' };
      await (admin.from('profiles') as any).update({
        full_name: fullName.trim(), updated_at: new Date().toISOString(),
      }).eq('id', existingProfile.id);
      return { success: true as const, email: invite.email };
    }
    return { success: false as const, error: 'Esta conta já existe. Entre com sua senha para aceitar o convite.', existing: true };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim(), signup_origin: 'company_user_invite', initial_password: false },
  });
  if (error || !data.user) return { success: false as const, error: error?.message || 'Não foi possível criar a conta.' };
  await (admin.from('profiles') as any).upsert({
    id: data.user.id,
    email: invite.email.toLowerCase(),
    full_name: fullName.trim(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  return { success: true as const, email: invite.email };
}

export async function acceptCompanyUserInviteAction(token: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('accept_company_user_invite', { p_token: token });
  return error
    ? { success: false as const, error: error.message }
    : { success: true as const, companyId: data.company_id as string, role: data.role as CompanyAccessRole };
}
