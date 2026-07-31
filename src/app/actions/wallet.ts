'use server';

import { createClient } from '@/lib/supabase/server';
import { CreditType, SourceType } from '@/types';

/**
 * 1. Criar Pacote de Créditos (Master Admin apenas)
 */
export async function createCreditPackageAction(payload: {
  name: string;
  description?: string | null;
  credits_amount: number;
  price_cents: number;
  credit_type?: CreditType;
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
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode criar pacotes de crédito.' };
  }

  const { data: newPkg, error } = await (supabase.from('credit_packages') as any)
    .insert({
      name: payload.name,
      description: payload.description || null,
      credits_amount: payload.credits_amount,
      price_cents: payload.price_cents || 0,
      credit_type: payload.credit_type || 'paid_credit',
      is_active: true,
    })
    .select()
    .single();

  if (error || !newPkg) {
    return { success: false, error: error?.message || 'Erro ao criar pacote de crédito.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    action: 'CREDIT_PACKAGE_CREATED',
    details: { package_id: newPkg.id, name: payload.name, credits: payload.credits_amount },
  });

  return { success: true, package: newPkg };
}

/**
 * 2. Atualizar Pacote de Créditos (Master Admin apenas)
 */
export async function updateCreditPackageAction(
  packageId: string,
  payload: {
    name?: string;
    description?: string | null;
    credits_amount?: number;
    price_cents?: number;
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
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode editar pacotes.' };
  }

  const { error } = await (supabase.from('credit_packages') as any)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', packageId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    action: 'CREDIT_PACKAGE_UPDATED',
    details: { package_id: packageId, changes: payload },
  });

  return { success: true };
}

/**
 * 3. Listar Pacotes de Crédito
 */
export async function getCreditPackagesAction() {
  const supabase = createClient();
  const { data, error } = await (supabase.from('credit_packages') as any)
    .select('*')
    .order('credits_amount', { ascending: true });

  if (error) {
    return { success: false, error: error.message, packages: [] };
  }

  return { success: true, packages: data || [] };
}

/**
 * 4. Adicionar Créditos Manualmente a uma Empresa (Master Admin apenas)
 */
export async function addCreditsManuallyAction(
  companyId: string,
  amount: number,
  creditType: CreditType = 'bonus_credit',
  sourceType: SourceType = 'manual_adjustment',
  description: string = 'Ajuste manual de créditos',
  expiresAt?: string | null
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
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode adicionar créditos manualmente.' };
  }

  // Obter ou criar carteira da empresa
  let { data: wallet } = await (supabase.from('wallets') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!wallet) {
    const { data: newWallet, error: wErr } = await (supabase.from('wallets') as any)
      .insert({ company_id: companyId, balance: 0 })
      .select()
      .single();

    if (wErr || !newWallet) {
      return { success: false, error: 'Erro ao criar carteira para a empresa.' };
    }
    wallet = newWallet;
  }

  const previousBalance = Number(wallet.balance);
  const newBalance = previousBalance + Number(amount);

  // Atualizar saldo da carteira
  const { error: uErr } = await (supabase.from('wallets') as any)
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);

  if (uErr) {
    return { success: false, error: uErr.message };
  }

  // Registrar em wallet_transactions com tipo de crédito
  const { data: tx, error: tErr } = await (supabase.from('wallet_transactions') as any)
    .insert({
      wallet_id: wallet.id,
      company_id: companyId,
      previous_balance: previousBalance,
      amount,
      new_balance: newBalance,
      type: 'credit',
      source: 'manual_grant',
      credit_type: creditType,
      source_type: sourceType,
      description,
      expires_at: expiresAt || null,
      user_id: user.id,
    })
    .select()
    .single();

  if (tErr) {
    return { success: false, error: tErr.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'MANUAL_CREDIT_GRANTED',
    details: { amount, credit_type: creditType, source_type: sourceType, new_balance: newBalance },
  });

  return { success: true, transaction: tx, new_balance: newBalance };
}

/**
 * 5. Obter Saldo da Carteira e Extrato de Transações
 */
export async function getWalletBalanceAction(companyId: string) {
  const supabase = createClient();

  const { data: wallet } = await (supabase.from('wallets') as any)
    .select('*')
    .eq('company_id', companyId)
    .single();

  const balance = wallet ? Number(wallet.balance) : 0;

  const { data: transactions } = await (supabase.from('wallet_transactions') as any)
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  return {
    success: true,
    balance,
    transactions: transactions || [],
  };
}

/**
 * 6. Debitar Crédito por Exibição Única (Proof of Play)
 */
export async function chargePlaybackCreditAction(playbackLogId: string, campaignId?: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('charge_playback_credit', {
    p_playback_log_id: playbackLogId,
    p_campaign_id: campaignId || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * 7. Processar Débitos em Lote de uma Campanha (Processamento Manual)
 */
export async function processCampaignCreditChargesAction(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  // Buscar mídias da campanha
  const { data: cMedia } = await (supabase.from('campaign_media') as any)
    .select('media_asset_id')
    .eq('campaign_id', campaignId);
  const mediaIds = (cMedia || []).map((m: any) => m.media_asset_id);

  // Buscar telas da campanha
  const { data: cScreens } = await (supabase.from('campaign_screens') as any)
    .select('screen_id')
    .eq('campaign_id', campaignId);
  const screenIds = (cScreens || []).map((s: any) => s.screen_id);

  if (mediaIds.length === 0 || screenIds.length === 0) {
    return {
      success: true,
      summary: {
        totalLogs: 0,
        chargedCount: 0,
        deduplicatedCount: 0,
        failedCount: 0,
        totalCreditsCharged: 0,
      },
    };
  }

  // Buscar logs 'completed' da campanha
  const { data: logs } = await (supabase.from('playback_logs') as any)
    .select('id')
    .eq('company_id', campaign.company_id)
    .eq('status', 'completed')
    .in('media_asset_id', mediaIds)
    .in('screen_id', screenIds);

  const completedLogs = logs || [];

  let chargedCount = 0;
  let deduplicatedCount = 0;
  let failedCount = 0;
  let totalCreditsCharged = 0;

  for (const log of completedLogs) {
    const res = await (supabase.rpc as any)('charge_playback_credit', {
      p_playback_log_id: log.id,
      p_campaign_id: campaignId,
    });

    if (res?.data?.charged) {
      chargedCount++;
      totalCreditsCharged += Number(res.data.credits_charged || 0);
    } else if (res?.data?.deduplicated) {
      deduplicatedCount++;
    } else {
      failedCount++;
    }
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: campaign.company_id,
    action: 'CAMPAIGN_CREDITS_PROCESSED',
    details: {
      campaign_id: campaignId,
      total_logs: completedLogs.length,
      charged_count: chargedCount,
      total_credits: totalCreditsCharged,
    },
  });

  return {
    success: true,
    summary: {
      totalLogs: completedLogs.length,
      chargedCount,
      deduplicatedCount,
      failedCount,
      totalCreditsCharged,
    },
  };
}
