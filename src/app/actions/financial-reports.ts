'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * 1. Obter Resumo Financeiro Consolidado para Master Admin
 */
export async function getMasterFinancialSummaryAction(filters?: {
  sellerCompanyId?: string;
  financialStatus?: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Verificar se é Master Admin
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  let query = (supabase.from('seller_financial_ledger') as any)
    .select('*, seller:companies!seller_financial_ledger_seller_company_id_fkey(*), buyer:companies!seller_financial_ledger_buyer_company_id_fkey(*), order:ad_offer_orders(*), campaign:campaigns(*)')
    .order('created_at', { ascending: false });

  if (filters?.sellerCompanyId) {
    query = query.eq('seller_company_id', filters.sellerCompanyId);
  }

  if (filters?.financialStatus) {
    query = query.eq('financial_status', filters.financialStatus);
  }

  const { data: ledgers, error } = await query;

  if (error) {
    return { success: false, error: error.message, ledgers: [] };
  }

  const allLedgers = ledgers || [];

  // Calcular TOTAIS
  const totalGrossCents = allLedgers.reduce((acc: number, l: any) => acc + (l.gross_amount_cents || 0), 0);
  const totalPlatformFeeCents = allLedgers.reduce((acc: number, l: any) => acc + (l.platform_fee_cents || 0), 0);
  const totalSellerNetCents = allLedgers.reduce((acc: number, l: any) => acc + (l.seller_net_cents || 0), 0);
  const totalPendingCents = allLedgers.reduce((acc: number, l: any) => acc + (l.amount_pending_cents || 0), 0);
  const totalAvailableCents = allLedgers.reduce((acc: number, l: any) => acc + (l.amount_available_cents || 0), 0);
  const totalUsedDiscountCents = allLedgers.reduce((acc: number, l: any) => acc + (l.amount_used_for_discount_cents || 0), 0);

  // Buscar Histórico Geral de Abatimentos
  const { data: discounts } = await (supabase.from('monthly_fee_discounts') as any)
    .select('*, seller:companies(*), profile:profiles(*)')
    .order('applied_at', { ascending: false });

  return {
    success: true,
    summary: {
      totalGrossCents,
      totalPlatformFeeCents,
      totalSellerNetCents,
      totalPendingCents,
      totalAvailableCents,
      totalUsedDiscountCents,
      totalOrdersCount: allLedgers.length,
    },
    ledgers: allLedgers,
    discounts: discounts || [],
  };
}

/**
 * 2. Obter Extrato Financeiro da Empresa Exibidora (/seller-statement)
 */
export async function getSellerStatementAction(sellerCompanyId: string) {
  const supabase = createClient();

  const { data: ledgers, error } = await (supabase.from('seller_financial_ledger') as any)
    .select('*, buyer:companies!seller_financial_ledger_buyer_company_id_fkey(*), order:ad_offer_orders(*), campaign:campaigns(*)')
    .eq('seller_company_id', sellerCompanyId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, ledgers: [] };
  }

  const allLedgers = ledgers || [];

  const totalGrossCents = allLedgers.reduce((acc: number, l: any) => acc + (l.gross_amount_cents || 0), 0);
  const totalPlatformFeeCents = allLedgers.reduce((acc: number, l: any) => acc + (l.platform_fee_cents || 0), 0);
  const totalSellerNetCents = allLedgers.reduce((acc: number, l: any) => acc + (l.seller_net_cents || 0), 0);
  const totalPendingCents = allLedgers.reduce((acc: number, l: any) => acc + (l.amount_pending_cents || 0), 0);
  const totalAvailableCents = allLedgers.reduce((acc: number, l: any) => acc + (l.amount_available_cents || 0), 0);
  const totalUsedDiscountCents = allLedgers.reduce((acc: number, l: any) => acc + (l.amount_used_for_discount_cents || 0), 0);

  // Buscar Histórico de Abatimentos da Empresa
  const { data: discounts } = await (supabase.from('monthly_fee_discounts') as any)
    .select('*')
    .eq('seller_company_id', sellerCompanyId)
    .order('applied_at', { ascending: false });

  return {
    success: true,
    summary: {
      totalGrossCents,
      totalPlatformFeeCents,
      totalSellerNetCents,
      totalPendingCents,
      totalAvailableCents,
      totalUsedDiscountCents,
    },
    ledgers: allLedgers,
    discounts: discounts || [],
  };
}

/**
 * 3. Aplicar Abatimento Manual de Mensalidade (Master Admin)
 */
export async function applySellerMonthlyDiscountAction(
  ledgerId: string,
  amountCents: number,
  reason: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: result, error } = await (supabase.rpc as any)('apply_seller_monthly_discount', {
    p_ledger_id: ledgerId,
    p_amount_cents: amountCents,
    p_reason: reason,
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
 * 4. Obter Histórico de Abatimentos por Exibidor
 */
export async function getMonthlyFeeDiscountsAction(sellerCompanyId: string) {
  const supabase = createClient();

  const { data: discounts, error } = await (supabase.from('monthly_fee_discounts') as any)
    .select('*')
    .eq('seller_company_id', sellerCompanyId)
    .order('applied_at', { ascending: false });

  if (error) {
    return { success: false, discounts: [] };
  }

  return { success: true, discounts: discounts || [] };
}
