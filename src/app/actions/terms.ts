'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * 1. Criar e Versionar Novo Termo de Uso (Master Admin)
 */
export async function createPlatformTermAction(
  termType: string,
  title: string,
  content: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Verificar Master Admin
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  // Buscar última versão do term_type para auto-incrementar
  const { data: existingTerms } = await (supabase.from('platform_terms') as any)
    .select('version')
    .eq('term_type', termType)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = existingTerms && existingTerms.length > 0 ? existingTerms[0].version + 1 : 1;

  const { data: newTerm, error } = await (supabase.from('platform_terms') as any)
    .insert({
      term_type: termType,
      version: nextVersion,
      title,
      content,
      is_active: true,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Registrar em Audit Logs
  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    action: 'PLATFORM_TERM_CREATED',
    details: { term_id: newTerm.id, term_type: termType, version: nextVersion },
  });

  return { success: true, term: newTerm };
}

/**
 * 2. Publicar / Ativar ou Desativar Termo de Uso (Master Admin)
 */
export async function publishPlatformTermAction(termId: string, isActive: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { error } = await (supabase.from('platform_terms') as any)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', termId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 3. Obter Termos Ativos Vigentes
 */
export async function getActiveTermsAction() {
  const supabase = createClient();

  const { data: terms, error } = await (supabase.from('platform_terms') as any)
    .select('*')
    .eq('is_active', true)
    .order('term_type', { ascending: true });

  if (error) {
    return { success: false, terms: [] };
  }

  return { success: true, terms: terms || [] };
}

/**
 * 4. Obter Histórico de Aceites da Empresa
 */
export async function getCompanyTermAcceptancesAction(companyId: string) {
  const supabase = createClient();

  const { data: acceptances, error } = await (supabase.from('company_term_acceptances') as any)
    .select('*, term:platform_terms(*), profile:profiles(*)')
    .eq('company_id', companyId)
    .order('accepted_at', { ascending: false });

  if (error) {
    return { success: false, acceptances: [] };
  }

  return { success: true, acceptances: acceptances || [] };
}

/**
 * 5. Registrar Aceite de Termo pela Empresa (RPC accept_platform_term)
 */
export async function acceptPlatformTermAction(
  companyId: string,
  termId: string,
  context: string = 'onboarding',
  ipAddress?: string,
  userAgent?: string
) {
  const supabase = createClient();

  const { data: result, error } = await (supabase.rpc as any)('accept_platform_term', {
    p_company_id: companyId,
    p_term_id: termId,
    p_acceptance_context: context,
    p_ip_address: ipAddress || null,
    p_user_agent: userAgent || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (result && !result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, result };
}

/**
 * 6. Verificação de Termos Obrigatórios Pendentes da Empresa (RPC check_company_required_terms)
 */
export async function checkCompanyRequiredTermsAction(companyId: string) {
  const supabase = createClient();

  const { data: result, error } = await (supabase.rpc as any)('check_company_required_terms', {
    p_company_id: companyId,
  });

  if (error) {
    return { success: false, compliant: true, pendingTerms: [] };
  }

  return {
    success: true,
    compliant: result?.compliant || false,
    pendingTermsCount: result?.pending_terms_count || 0,
    pendingTerms: result?.pending_terms || [],
  };
}

/**
 * 7. Obter Relatório de Conformidade de Todas as Empresas (Master Admin)
 */
export async function getCompaniesComplianceStatusAction() {
  const supabase = createClient();

  const { data: companies } = await (supabase.from('companies') as any)
    .select('id, trade_name, corporate_name, city, state')
    .order('trade_name', { ascending: true });

  const { data: activeTerms } = await (supabase.from('platform_terms') as any)
    .select('id')
    .eq('is_active', true);

  const totalActiveTermsCount = activeTerms?.length || 0;

  const complianceList = [];

  for (const comp of companies || []) {
    const { data: acceptances } = await (supabase.from('company_term_acceptances') as any)
      .select('term_id')
      .eq('company_id', comp.id);

    const acceptedCount = acceptances?.length || 0;
    const isFullyCompliant = acceptedCount >= totalActiveTermsCount;

    complianceList.push({
      ...comp,
      acceptedCount,
      totalActiveTermsCount,
      isFullyCompliant,
    });
  }

  return {
    success: true,
    totalActiveTermsCount,
    complianceList,
  };
}
