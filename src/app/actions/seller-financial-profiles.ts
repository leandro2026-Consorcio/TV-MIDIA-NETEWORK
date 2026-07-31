'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Função auxiliar de segurança: Valida estritamente se o usuário logado é Master Admin no Supabase
 */
async function checkMasterAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isMaster: false, userId: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  return { isMaster: !!profile?.is_master_admin, userId: user.id };
}

/**
 * Função auxiliar de segurança: Valida se o usuário é Admin ativo da empresa solicitada ou Master Admin
 */
async function checkCompanyAdmin(supabase: any, companyId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isCompanyAdmin: false, isMaster: false, userId: null };

  const { isMaster } = await checkMasterAdmin(supabase);
  if (isMaster) return { isCompanyAdmin: true, isMaster: true, userId: user.id };

  const { data: cu } = await supabase
    .from('company_users')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  const isCompanyAdmin = cu?.role === 'admin';
  return { isCompanyAdmin, isMaster: false, userId: user.id };
}

/**
 * 1. Obter Perfil Financeiro da Empresa Exibidora
 */
export async function getSellerFinancialProfileAction(companyId: string) {
  const supabase = createClient();
  const { userId } = await checkCompanyAdmin(supabase, companyId);

  if (!userId) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: profile, error } = await (supabase.from('seller_financial_profiles') as any)
    .select('*, company:companies!seller_financial_profiles_company_id_fkey(*)')
    .eq('company_id', companyId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return { success: false, error: error.message };
  }

  return { success: true, profile: profile || null };
}

/**
 * 2. Salvar Rascunho do Perfil Financeiro (Admin da Empresa ou Master Admin)
 */
export async function saveSellerFinancialProfileAction(companyId: string, data: {
  document_type: 'cnpj' | 'cpf';
  document_number: string;
  legal_name: string;
  trade_name?: string;
  responsible_name: string;
  responsible_email: string;
  responsible_phone: string;
  bank_code: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_account_digit: string;
  bank_account_type: 'checking' | 'savings';
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pix_key?: string;
}) {
  const supabase = createClient();
  const { isCompanyAdmin, userId } = await checkCompanyAdmin(supabase, companyId);

  if (!isCompanyAdmin || !userId) {
    return { success: false, error: 'Apenas Administradores da empresa podem preencher dados financeiros.' };
  }

  // Buscar perfil existente para verificar unicidade de company_id
  const { data: existing } = await (supabase.from('seller_financial_profiles') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  const payload = {
    company_id: companyId,
    document_type: data.document_type,
    document_number: data.document_number.replace(/\D/g, ''),
    legal_name: data.legal_name,
    trade_name: data.trade_name || null,
    responsible_name: data.responsible_name,
    responsible_email: data.responsible_email,
    responsible_phone: data.responsible_phone,
    bank_code: data.bank_code,
    bank_name: data.bank_name,
    bank_agency: data.bank_agency,
    bank_account: data.bank_account,
    bank_account_digit: data.bank_account_digit,
    bank_account_type: data.bank_account_type,
    pix_key_type: data.pix_key_type || null,
    pix_key: data.pix_key || null,
    updated_at: new Date().toISOString(),
  };

  let savedProfile: any = null;

  if (existing) {
    // Se o perfil já estava aprovado e sofreu alteração sensível, o trigger fn_reset_seller_financial_profile_status resetará para pending_review
    const { data: updated, error } = await (supabase.from('seller_financial_profiles') as any)
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    savedProfile = updated;
  } else {
    const { data: inserted, error } = await (supabase.from('seller_financial_profiles') as any)
      .insert({
        ...payload,
        verification_status: 'draft',
        asaas_status: 'not_created',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    savedProfile = inserted;
  }

  // Gravar histórico de alteração em seller_financial_profile_logs
  await (supabase.from('seller_financial_profile_logs') as any).insert({
    seller_financial_profile_id: savedProfile.id,
    company_id: companyId,
    changed_by: userId,
    action: existing ? 'PROFILE_UPDATED' : 'PROFILE_CREATED',
    before_data: existing || null,
    after_data: savedProfile,
  });

  // Audit Log sem expor senhas ou segredos
  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    company_id: companyId,
    action: 'SELLER_FINANCIAL_PROFILE_SAVED',
    details: { profile_id: savedProfile.id, status: savedProfile.verification_status },
  });

  return { success: true, profile: savedProfile };
}

/**
 * 3. Submeter Perfil Financeiro para Revisão do Master Admin
 */
export async function submitSellerFinancialProfileForReviewAction(companyId: string) {
  const supabase = createClient();
  const { isCompanyAdmin, userId } = await checkCompanyAdmin(supabase, companyId);

  if (!isCompanyAdmin || !userId) {
    return { success: false, error: 'Apenas Administradores da empresa podem submeter o cadastro.' };
  }

  const { data: profile } = await (supabase.from('seller_financial_profiles') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!profile) {
    return { success: false, error: 'Preencha o cadastro financeiro antes de enviar para revisão.' };
  }

  if (profile.verification_status === 'suspended') {
    return { success: false, error: 'Este cadastro financeiro está suspenso. Entre em contato com o suporte.' };
  }

  // Validar preenchimento dos campos obrigatórios
  if (
    !profile.document_number ||
    !profile.legal_name ||
    !profile.responsible_name ||
    !profile.responsible_email ||
    !profile.responsible_phone ||
    !profile.bank_code ||
    !profile.bank_agency ||
    !profile.bank_account ||
    !profile.bank_account_digit ||
    !profile.pix_key
  ) {
    return { success: false, error: 'Preencha todos os campos obrigatórios (Dados Fiscais, Responsável, Conta Bancária e Chave Pix).' };
  }

  const { error } = await (supabase.from('seller_financial_profiles') as any)
    .update({
      verification_status: 'pending_review',
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (error) return { success: false, error: error.message };

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    company_id: companyId,
    action: 'SELLER_FINANCIAL_PROFILE_SUBMITTED_FOR_REVIEW',
    details: { profile_id: profile.id },
  });

  return { success: true };
}

/**
 * 4. Listar Todos os Perfis Financeiros (Exclusivo Master Admin)
 */
export async function getSellerFinancialProfilesForAdminAction(filters?: {
  verificationStatus?: string;
}) {
  const supabase = createClient();
  const { isMaster } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  let query = (supabase.from('seller_financial_profiles') as any)
    .select('*, company:companies!seller_financial_profiles_company_id_fkey(*)')
    .order('updated_at', { ascending: false });

  if (filters?.verificationStatus && filters.verificationStatus !== 'all') {
    query = query.eq('verification_status', filters.verificationStatus);
  }

  const { data: profiles, error } = await query;

  if (error) return { success: false, error: error.message };
  return { success: true, profiles: profiles || [] };
}

/**
 * 5. Aprovar Cadastro Financeiro da Exibidora (Exclusivo Master Admin com Validação de Mínimos)
 */
export async function approveSellerFinancialProfileAction(companyId: string) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster || !userId) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  const { data: profile } = await (supabase.from('seller_financial_profiles') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!profile) {
    return { success: false, error: 'Perfil financeiro não encontrado.' };
  }

  if (profile.verification_status === 'suspended') {
    return { success: false, error: 'Impossível aprovar um cadastro suspenso sem antes revisar o motivo.' };
  }

  // Validação Estrita dos 15 Campos Mínimos Obrigatórios Antes de Aprovar
  if (
    !profile.document_number ||
    !profile.legal_name ||
    !profile.responsible_name ||
    !profile.responsible_email ||
    !profile.responsible_phone ||
    !profile.bank_code ||
    !profile.bank_name ||
    !profile.bank_agency ||
    !profile.bank_account ||
    !profile.bank_account_digit ||
    !profile.bank_account_type ||
    !profile.pix_key
  ) {
    return { 
      success: false, 
      error: 'Impossível aprovar: O cadastro não possui todos os campos fiscais, bancários e de Chave Pix devidamente preenchidos.' 
    };
  }

  const { error } = await (supabase.from('seller_financial_profiles') as any)
    .update({
      verification_status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (error) return { success: false, error: error.message };

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    company_id: companyId,
    action: 'SELLER_FINANCIAL_PROFILE_APPROVED',
    details: { profile_id: profile.id, approved_by: userId },
  });

  return { success: true };
}

/**
 * 6. Rejeitar Cadastro Financeiro com Motivo Obrigatório (Exclusivo Master Admin)
 */
export async function rejectSellerFinancialProfileAction(companyId: string, reason: string) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster || !userId) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: 'É obrigatório informar o motivo da rejeição do cadastro financeiro.' };
  }

  const { data: profile } = await (supabase.from('seller_financial_profiles') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!profile) {
    return { success: false, error: 'Perfil financeiro não encontrado.' };
  }

  const { error } = await (supabase.from('seller_financial_profiles') as any)
    .update({
      verification_status: 'rejected',
      rejected_by: userId,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (error) return { success: false, error: error.message };

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    company_id: companyId,
    action: 'SELLER_FINANCIAL_PROFILE_REJECTED',
    details: { profile_id: profile.id, reason: reason.trim() },
  });

  return { success: true };
}

/**
 * 7. Suspender Cadastro Financeiro da Exibidora (Exclusivo Master Admin)
 */
export async function suspendSellerFinancialProfileAction(companyId: string, reason: string) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster || !userId) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: 'É obrigatório informar o motivo da suspensão do cadastro financeiro.' };
  }

  const { data: profile } = await (supabase.from('seller_financial_profiles') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!profile) {
    return { success: false, error: 'Perfil financeiro não encontrado.' };
  }

  const { error } = await (supabase.from('seller_financial_profiles') as any)
    .update({
      verification_status: 'suspended',
      rejection_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (error) return { success: false, error: error.message };

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    company_id: companyId,
    action: 'SELLER_FINANCIAL_PROFILE_SUSPENDED',
    details: { profile_id: profile.id, reason: reason.trim() },
  });

  return { success: true };
}

/**
 * 8. Vincular / Criar Identificador de Subconta Asaas (Preparação Sem Movimentação de Recursos)
 */
export async function createOrLinkAsaasSubAccountAction(companyId: string) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster || !userId) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  const { data: profile } = await (supabase.from('seller_financial_profiles') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!profile || profile.verification_status !== 'approved') {
    return { success: false, error: 'Apenas perfis financeiros devidamente APROVADOS podem vincular subconta Asaas.' };
  }

  // Identificador cadastral de preparação sem movimentação financeira ou transferências de fundos
  const mockSubAccountId = `subacc_${companyId.replace(/-/g, '').slice(0, 16)}`;
  const mockWalletId = `wallet_${companyId.replace(/-/g, '').slice(0, 16)}`;

  const { error } = await (supabase.from('seller_financial_profiles') as any)
    .update({
      asaas_account_id: mockSubAccountId,
      asaas_wallet_id: mockWalletId,
      asaas_status: 'created',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (error) return { success: false, error: error.message };

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    company_id: companyId,
    action: 'ASAAS_SUBACCOUNT_LINKED_PREPARATION',
    details: { profile_id: profile.id, asaas_account_id: mockSubAccountId, asaas_wallet_id: mockWalletId },
  });

  return { success: true, asaasAccountId: mockSubAccountId, asaasWalletId: mockWalletId };
}
