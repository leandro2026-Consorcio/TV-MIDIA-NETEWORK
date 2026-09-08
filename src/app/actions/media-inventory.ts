'use server';

import { createClient } from '@/lib/supabase/server';
import { calculateInventoryCapacity, validateInventoryBuckets } from '@/lib/inventory/capacity';
import { getPublicNetworkCompaniesAction } from '@/app/actions/network';

const FEATURE_KEYS = ['media_inventory_v2', 'inventory_capacity_v2', 'inventory_allocations_v2'] as const;

async function authenticatedContext() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isMaster: false };
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin').eq('id', user.id).single();
  return { supabase, user, isMaster: Boolean(profile?.is_master_admin) };
}

export async function getScreenInventoryAction(screenId: string) {
  const { supabase, user, isMaster } = await authenticatedContext();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: screen, error: screenError } = await (supabase.from('screens') as any)
    .select('id,company_id,name,orientation,device_type,status').eq('id', screenId).single();
  if (screenError || !screen) return { success: false as const, error: 'Tela não encontrada ou acesso negado.' };

  const { data: settings } = await (supabase.from('platform_settings') as any)
    .select('key,value').in('key', [...FEATURE_KEYS, 'inventory_preferred_limit', 'inventory_growth_enabled']);
  const flags = Object.fromEntries((settings || []).map((item: any) => [item.key, item.value]));

  const { data: inventory } = await (supabase.from('media_inventory') as any)
    .select('*').eq('source_type', 'company_screen').eq('source_id', screenId).maybeSingle();
  if (!inventory) {
    return { success: true as const, screen, inventory: null, period: null, buckets: [], preferred: [], flags, isMaster, companies: [] };
  }

  const { data: period } = await (supabase.from('inventory_capacity_periods') as any)
    .select('*').eq('media_inventory_id', inventory.id).order('period_start', { ascending: false }).limit(1).maybeSingle();
  const { data: buckets } = period
    ? await (supabase.from('inventory_bucket_policies') as any).select('*').eq('capacity_period_id', period.id).order('bucket_type')
    : { data: [] } as any;
  const { data: preferred } = await (supabase.from('inventory_preferred_participants') as any)
    .select('*').eq('inventory_id', inventory.id).order('priority');
  const network = await getPublicNetworkCompaniesAction();

  return {
    success: true as const,
    screen,
    inventory,
    period: period || null,
    buckets: buckets || [],
    preferred: preferred || [],
    flags,
    isMaster,
    companies: network.success ? network.companies : [],
  };
}

export async function setScreenInventoryParticipationAction(inventoryId: string, enabled: boolean) {
  const { supabase, user } = await authenticatedContext();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { error } = await (supabase.rpc as any)('set_media_inventory_commercial_enabled', {
    p_inventory_id: inventoryId,
    p_enabled: enabled,
  });
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export interface ConfigureInventoryInput {
  inventoryId: string;
  periodStart: string;
  periodEnd: string;
  manualCapacity: number;
  ownUse: number;
  preferred: number;
  partnership: number;
  mpmGrowth: number;
  automaticPool: number;
  releaseUnused: boolean;
  releaseAfterDay?: number | null;
  releaseLeadDays?: number | null;
  growthReason?: string | null;
}

export async function configureInventoryPeriodAction(input: ConfigureInventoryInput) {
  const { supabase, user } = await authenticatedContext();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  try {
    const calculation = calculateInventoryCapacity({
      manualCapacity: input.manualCapacity,
      activeDays: 0,
      activeMinutesPerDay: 0,
      averageSlotDurationSeconds: 10,
      operationalMarginPercent: 0,
      downtimeMinutes: 0,
    });
    validateInventoryBuckets(calculation.theoreticalCapacity, [
      { type: 'own_use', capacity: input.ownUse },
      { type: 'preferred', capacity: input.preferred },
      { type: 'partnership', capacity: input.partnership },
      { type: 'mpm_growth', capacity: input.mpmGrowth },
      { type: 'automatic_pool', capacity: input.automaticPool },
    ]);

    const { data, error } = await (supabase.rpc as any)('configure_inventory_period', {
      p_inventory_id: input.inventoryId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_theoretical_capacity: calculation.theoreticalCapacity,
      p_calculation_source: calculation.source,
      p_calculation_inputs: calculation.inputs,
      p_own_use: Math.floor(input.ownUse),
      p_preferred: Math.floor(input.preferred),
      p_partnership: Math.floor(input.partnership),
      p_mpm_growth: Math.floor(input.mpmGrowth),
      p_automatic_pool: Math.floor(input.automaticPool),
      p_release_unused: input.releaseUnused,
      p_release_after_day: input.releaseAfterDay ?? null,
      p_release_lead_days: input.releaseLeadDays ?? null,
      p_growth_reason: input.growthReason || null,
    });
    if (error) {
      if (/overbooking|excede|capacidade/i.test(error.message)) {
        await (supabase.from('audit_logs') as any).insert({
          user_id: user.id,
          action: 'INVENTORY_OVERBOOKING_REJECTED',
          details: { inventory_id: input.inventoryId, error: error.message },
        });
      }
      return { success: false as const, error: error.message };
    }
    return { success: true as const, periodId: data as string };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Configuração inválida.' };
  }
}

export async function addInventoryPreferredParticipantAction(input: {
  inventoryId: string;
  preferredCompanyId: string;
  priority: number;
  maxInsertions: number;
  startsAt: string;
  endsAt: string;
}) {
  const { supabase, user } = await authenticatedContext();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { error } = await (supabase.rpc as any)('set_inventory_preferred_participant', {
    p_inventory_id: input.inventoryId,
    p_preferred_company_id: input.preferredCompanyId,
    p_priority: Math.floor(input.priority),
    p_max_insertions: Math.floor(input.maxInsertions),
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
  });
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export async function updateInventoryFeatureFlagsAction(flags: Record<(typeof FEATURE_KEYS)[number], boolean>) {
  const { supabase, user, isMaster } = await authenticatedContext();
  if (!user || !isMaster) return { success: false as const, error: 'Acesso exclusivo do Master Admin.' };
  for (const key of FEATURE_KEYS) {
    const { error } = await (supabase.from('platform_settings') as any)
      .update({ value: flags[key], updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) return { success: false as const, error: error.message };
  }
  return { success: true as const };
}
