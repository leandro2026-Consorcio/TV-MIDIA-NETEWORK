'use server';

import { createClient } from '@/lib/supabase/server';
import { RuleType } from '@/types';

/**
 * 1. Criar Regra de Política de Crédito (Master Admin apenas)
 */
export async function createCreditPolicyRuleAction(payload: {
  name: string;
  rule_type: RuleType;
  received_credit_type?: string;
  received_credits?: number;
  ceded_credit_type?: string;
  ceded_credits?: number;
  validity_days?: number | null;
  max_external_grade_percentage?: number;
  requires_manual_approval?: boolean;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode criar regras de política.' };
  }

  const { data: newRule, error } = await (supabase.from('credit_policy_rules') as any)
    .insert({
      name: payload.name,
      rule_type: payload.rule_type,
      received_credit_type: payload.received_credit_type || 'trial_credit',
      received_credits: payload.received_credits || 0,
      ceded_credit_type: payload.ceded_credit_type || 'network_inventory_credit',
      ceded_credits: payload.ceded_credits || 0,
      validity_days: payload.validity_days || null,
      max_external_grade_percentage: payload.max_external_grade_percentage ?? 10.0,
      requires_manual_approval: payload.requires_manual_approval ?? true,
      is_active: true,
    })
    .select()
    .single();

  if (error || !newRule) {
    return { success: false, error: error?.message || 'Erro ao criar regra de política.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    action: 'CREDIT_POLICY_RULE_CREATED',
    details: { rule_id: newRule.id, name: payload.name, rule_type: payload.rule_type },
  });

  return { success: true, rule: newRule };
}

/**
 * 2. Atualizar Regra de Política de Crédito (Master Admin apenas)
 */
export async function updateCreditPolicyRuleAction(
  ruleId: string,
  payload: {
    name?: string;
    received_credits?: number;
    ceded_credits?: number;
    validity_days?: number | null;
    max_external_grade_percentage?: number;
    requires_manual_approval?: boolean;
    is_active?: boolean;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode editar regras.' };
  }

  const { error } = await (supabase.from('credit_policy_rules') as any)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', ruleId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    action: 'CREDIT_POLICY_RULE_UPDATED',
    details: { rule_id: ruleId, changes: payload },
  });

  return { success: true };
}

/**
 * 3. Listar Regras de Política de Crédito
 */
export async function getCreditPolicyRulesAction() {
  const supabase = createClient();
  const { data, error } = await (supabase.from('credit_policy_rules') as any)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, rules: [] };
  }

  return { success: true, rules: data || [] };
}

/**
 * 4. Obter ou Inicializar Preferências da Empresa na Rede
 */
export async function getCompanyNetworkPreferencesAction(companyId: string) {
  const supabase = createClient();

  let { data: prefs } = await (supabase.from('company_network_preferences') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!prefs) {
    const { data: newPrefs, error } = await (supabase.from('company_network_preferences') as any)
      .insert({
        company_id: companyId,
        accepts_network_ads: true,
        max_external_grade_percentage: 10.0,
        requires_manual_approval: true,
        blocked_segments: [],
        blocked_companies: [],
      })
      .select()
      .single();

    if (!error && newPrefs) {
      prefs = newPrefs;
    }
  }

  return { success: true, preferences: prefs || null };
}

/**
 * 5. Atualizar Preferências da Empresa na Rede
 */
export async function updateCompanyNetworkPreferencesAction(
  companyId: string,
  payload: {
    accepts_network_ads?: boolean;
    max_external_grade_percentage?: number;
    requires_manual_approval?: boolean;
    blocked_segments?: string[];
    blocked_companies?: string[];
    notes?: string | null;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Verificar se o usuário é Admin da empresa ou Master Admin
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_master_admin) {
    const { data: link } = await (supabase.from('company_users') as any)
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!link || link.role !== 'admin') {
      return { success: false, error: 'Acesso negado: Apenas Admins da empresa ou Master Admin podem alterar preferências de rede.' };
    }
  }

  const { error } = await (supabase.from('company_network_preferences') as any)
    .upsert({
      company_id: companyId,
      ...payload,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'COMPANY_NETWORK_PREFERENCES_UPDATED',
    details: { changes: payload },
  });

  return { success: true };
}

/**
 * Buscar lista pública de empresas participantes da rede Mídia por Mídia
 * Retorna apenas dados públicos autorizados pela empresa.
 */
export async function getPublicNetworkCompaniesAction(filters?: {
  city?: string;
  state?: string;
  segmentId?: string;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, companies: [], error: 'Usuário não autenticado.' };

  try {
    const { data, error } = await (supabase.from('company_network_preferences') as any)
      .select(`
        company_id,
        accepts_network_ads,
        companies!inner(
          id,
          trade_name,
          city,
          state,
          company_segments(
            is_primary,
            segments(id, name)
          )
        )
      `)
      .eq('accepts_network_ads', true);

    if (error) throw error;

    let list = (data || []).map((row: any) => {
      const comp = row.companies;
      const primarySeg = comp?.company_segments?.find((cs: any) => cs.is_primary)?.segments || comp?.company_segments?.[0]?.segments;
      return {
        companyId: row.company_id,
        tradeName: comp?.trade_name || 'Empresa Participante',
        city: comp?.city || null,
        state: comp?.state || null,
        segmentId: primarySeg?.id || null,
        segmentName: primarySeg?.name || null,
        publicWhatsapp: null,
        publicDescription: null,
      };
    });

    if (filters?.city?.trim()) {
      const c = filters.city.trim().toLowerCase();
      list = list.filter((item: any) => item.city && item.city.toLowerCase().includes(c));
    }

    if (filters?.state?.trim()) {
      const s = filters.state.trim().toUpperCase();
      list = list.filter((item: any) => item.state && item.state.toUpperCase() === s);
    }

    if (filters?.segmentId?.trim()) {
      list = list.filter((item: any) => item.segmentId === filters.segmentId);
    }

    return { success: true, companies: list, error: null };
  } catch (err: any) {
    return { success: false, companies: [], error: err.message || 'Falha ao buscar empresas da rede.' };
  }
}

/**
 * 6. Aplicar Política de Trial a uma Empresa (Master Admin ou Automação)
 */
export async function applyTrialCreditPolicyAction(companyId: string, ruleType: RuleType = 'trial_standard') {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Buscar regra correspondente
  const { data: rule } = await (supabase.from('credit_policy_rules') as any)
    .select('*')
    .eq('rule_type', ruleType)
    .eq('is_active', true)
    .single();

  if (!rule) {
    return { success: false, error: `Regra de política ${ruleType} não encontrada.` };
  }

  // 1. Conceder Créditos de Consumo na Carteira
  if (rule.received_credits > 0) {
    let { data: wallet } = await (supabase.from('wallets') as any)
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!wallet) {
      const { data: nw } = await (supabase.from('wallets') as any)
        .insert({ company_id: companyId, balance: 0 })
        .select()
        .single();
      wallet = nw;
    }

    const prevBal = Number(wallet.balance);
    const newBal = prevBal + Number(rule.received_credits);

    await (supabase.from('wallets') as any)
      .update({ balance: newBal, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    await (supabase.from('wallet_transactions') as any).insert({
      wallet_id: wallet.id,
      company_id: companyId,
      previous_balance: prevBal,
      amount: rule.received_credits,
      new_balance: newBal,
      type: 'credit',
      source: 'system_bonus',
      credit_type: rule.received_credit_type || 'trial_credit',
      source_type: 'trial_grant',
      description: `Créditos promocionais de degustação do Trial (${rule.name})`,
      user_id: user.id,
    });
  }

  // 2. Cadastrar Inventário Cedido à Rede em network_inventory_ledger
  const validityDays = rule.validity_days || 60;
  const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: ledger, error: lErr } = await (supabase.from('network_inventory_ledger') as any)
    .insert({
      company_id: companyId,
      source_type: 'trial_policy',
      source_id: rule.id,
      credit_type: rule.ceded_credit_type || 'network_inventory_credit',
      credits_granted: rule.ceded_credits,
      credits_used: 0,
      credits_remaining: rule.ceded_credits,
      valid_from: new Date().toISOString(),
      expires_at: expiresAt,
      status: 'active',
      metadata: { rule_type: rule.rule_type, rule_name: rule.name },
    })
    .select()
    .single();

  if (lErr || !ledger) {
    return { success: false, error: lErr?.message || 'Erro ao registrar inventário cedido de trial.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'TRIAL_CREDIT_POLICY_APPLIED',
    details: {
      rule_id: rule.id,
      rule_name: rule.name,
      received_credits: rule.received_credits,
      ceded_inventory: rule.ceded_credits,
      expires_at: expiresAt,
    },
  });

  return { success: true, ledger };
}

/**
 * 7. Aplicar Cota Colaborativa Mensal de Cliente Pagante
 */
export async function applyMonthlyNetworkQuotaAction(companyId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: ledger, error } = await (supabase.from('network_inventory_ledger') as any)
    .insert({
      company_id: companyId,
      source_type: 'monthly_quota',
      credit_type: 'monthly_network_quota',
      credits_granted: 50,
      credits_used: 0,
      credits_remaining: 50,
      valid_from: new Date().toISOString(),
      expires_at: expiresAt,
      status: 'active',
      metadata: { description: 'Cota colaborativa mensal de cliente pagante (50 CR)' },
    })
    .select()
    .single();

  if (error || !ledger) {
    return { success: false, error: error?.message || 'Erro ao registrar cota colaborativa mensal.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'MONTHLY_NETWORK_QUOTA_APPLIED',
    details: { ceded_inventory: 50, expires_at: expiresAt },
  });

  return { success: true, ledger };
}

/**
 * 8. Obter Status do Inventário Cedido da Empresa
 */
export async function getNetworkInventoryStatusAction(companyId: string) {
  const supabase = createClient();

  const { data: ledgers, error } = await (supabase.from('network_inventory_ledger') as any)
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, ledgers: [], totals: { granted: 0, used: 0, remaining: 0 } };
  }

  const activeLedgers = (ledgers || []).filter((l: any) => l.status === 'active');
  const totals = activeLedgers.reduce(
    (acc: any, l: any) => {
      acc.granted += Number(l.credits_granted);
      acc.used += Number(l.credits_used);
      acc.remaining += Number(l.credits_remaining);
      return acc;
    },
    { granted: 0, used: 0, remaining: 0 }
  );

  return {
    success: true,
    ledgers: ledgers || [],
    totals,
  };
}

/**
 * 9. Obter Histórico de Uso do Inventário Cedido (Anúncios da Rede Recebidos na TV)
 */
export async function getNetworkInventoryUsageAction(companyId: string) {
  const supabase = createClient();

  const { data, error } = await (supabase.from('network_inventory_usage') as any)
    .select('*, media_assets(*), screens(*), advertiser:companies!network_inventory_usage_advertiser_company_id_fkey(*)')
    .eq('display_company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, usage: [] };
  }

  return { success: true, usage: data || [] };
}

/**
 * 10. Processar Consumo de Inventário Cedido por Exibição (Permuta Simples RPC)
 */
export async function useNetworkInventoryCreditAction(playbackLogId: string, inventoryLedgerId: string) {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as any)('use_network_inventory_credit', {
    p_playback_log_id: playbackLogId,
    p_inventory_ledger_id: inventoryLedgerId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}
