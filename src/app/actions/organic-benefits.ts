'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculatePromotionalContribution,
  generateCouponCode,
  generateQrToken
} from '@/lib/mpm/organic-benefits';
import crypto from 'node:crypto';

const hashCouponCode = (code: string) =>
  crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

export async function getCompanyBenefitsAction() {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).single();
  const isMaster = !!profile?.is_master_admin;

  let companyIds: string[] = [];
  if (isMaster) {
    const { data } = await (supabase.from('companies') as any).select('id');
    companyIds = (data || []).map((x: any) => x.id);
  } else {
    const { data } = await (supabase.from('company_users') as any)
      .select('company_id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .eq('is_active', true);
    companyIds = (data || []).map((x: any) => x.company_id);
  }

  if (!companyIds.length) {
    return {
      success: true as const,
      isMaster,
      companies: [],
      benefits: [],
      metrics: {
        totalOfferedValue: 0,
        totalStock: 0,
        availableStock: 0,
        reservedStock: 0,
        redeemedStock: 0,
        activeBenefitsCount: 0,
      },
    };
  }

  const [companiesRes, benefitsRes] = await Promise.all([
    (supabase.from('companies') as any).select('id, trade_name').in('id', companyIds).order('trade_name'),
    (supabase.from('organic_campaign_rewards') as any)
      .select('*, companies(id, trade_name)')
      .in('company_id', companyIds)
      .order('created_at', { ascending: false }),
  ]);

  const benefits = benefitsRes.data || [];
  const metrics = benefits.reduce(
    (acc: any, b: any) => {
      const val = Number(b.approved_promotional_value || (b.announced_unit_value * b.quantity_total) || 0);
      acc.totalOfferedValue += val;
      acc.totalStock += Number(b.quantity_total || 0);
      acc.availableStock += Number(b.quantity_available || 0);
      acc.reservedStock += Number(b.quantity_reserved || 0);
      acc.redeemedStock += Number(b.quantity_redeemed || 0);
      if (b.status === 'active') acc.activeBenefitsCount += 1;
      return acc;
    },
    {
      totalOfferedValue: 0,
      totalStock: 0,
      availableStock: 0,
      reservedStock: 0,
      redeemedStock: 0,
      activeBenefitsCount: 0,
    }
  );

  return {
    success: true as const,
    isMaster,
    companies: companiesRes.data || [],
    benefits,
    metrics,
  };
}

export async function saveCompanyBenefitAction(payload: {
  id?: string;
  companyId: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  announcedUnitValue: number;
  quantity: number;
  maxPerUser?: number;
  unitLocations?: string[];
  allowedWeekdays?: number[];
  allowedTimeStart?: string | null;
  allowedTimeEnd?: string | null;
  minConsumption?: number | null;
  couponValidityDays?: number;
  expiresAt: string;
  terms?: string;
}) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data, error } = await (supabase.rpc as any)('submit_or_update_organic_benefit', {
    p_id: payload.id || null,
    p_company_id: payload.companyId,
    p_title: payload.title.trim(),
    p_description: (payload.description || '').trim(),
    p_category: payload.category || 'Geral',
    p_image_url: payload.imageUrl || null,
    p_announced_unit_value: payload.announcedUnitValue,
    p_quantity: Math.max(1, Math.floor(payload.quantity)),
    p_max_per_user: Math.max(1, Math.floor(payload.maxPerUser || 1)),
    p_unit_locations: payload.unitLocations || [],
    p_allowed_weekdays: payload.allowedWeekdays || [0, 1, 2, 3, 4, 5, 6],
    p_allowed_time_start: payload.allowedTimeStart || null,
    p_allowed_time_end: payload.allowedTimeEnd || null,
    p_min_consumption: payload.minConsumption || null,
    p_coupon_validity_days: payload.couponValidityDays || 7,
    p_expires_at: new Date(payload.expiresAt).toISOString(),
    p_campaign_id: null,
    p_terms: payload.terms || null,
  });

  if (!error && data?.success) {
    return { success: true as const, data };
  }

  // Fallback resiliente para ambiente de transição antes de migração remota
  if (error && (error.code === '42883' || error.message?.includes('does not exist'))) {
    const admin: any = createAdminClient();
    const terms = calculatePromotionalContribution(payload.announcedUnitValue, payload.quantity);
    const insertPayload: any = {
      company_id: payload.companyId,
      title: payload.title.trim(),
      description: (payload.description || '').trim(),
      category: payload.category || 'Geral',
      image_url: payload.imageUrl || null,
      announced_unit_value: payload.announcedUnitValue,
      approved_unit_value: payload.announcedUnitValue,
      approved_promotional_value: terms.promotionalValue,
      credits_required: terms.suggestedPoints,
      credit_budget: terms.suggestedPoints * payload.quantity,
      quantity_total: payload.quantity,
      quantity_available: payload.quantity,
      max_per_user: payload.maxPerUser || 1,
      unit_locations: payload.unitLocations || [],
      allowed_weekdays: payload.allowedWeekdays || [0, 1, 2, 3, 4, 5, 6],
      allowed_time_start: payload.allowedTimeStart || null,
      allowed_time_end: payload.allowedTimeEnd || null,
      coupon_validity_days: payload.couponValidityDays || 7,
      expires_at: new Date(payload.expiresAt).toISOString(),
      status: 'active',
      is_suspicious_price: terms.isSuspicious,
      created_by: user.id,
    };

    let resultData;
    if (payload.id) {
      const { data: updated, error: updErr } = await (admin.from('organic_campaign_rewards') as any)
        .update(insertPayload)
        .eq('id', payload.id)
        .select()
        .single();
      if (updErr) return { success: false as const, error: updErr.message };
      resultData = updated;
    } else {
      const { data: created, error: insErr } = await (admin.from('organic_campaign_rewards') as any)
        .insert(insertPayload)
        .select()
        .single();
      if (insErr) {
        const basePayload = {
          company_id: payload.companyId,
          title: payload.title.trim(),
          description: (payload.description || '').trim(),
          credits_required: terms.suggestedPoints,
          credit_budget: terms.suggestedPoints * payload.quantity,
          quantity_total: payload.quantity,
          quantity_available: payload.quantity,
          expires_at: new Date(payload.expiresAt).toISOString(),
          status: 'active',
          created_by: user.id,
        };
        const { data: baseCreated, error: baseErr } = await (admin.from('organic_campaign_rewards') as any)
          .insert(basePayload)
          .select()
          .single();
        if (baseErr) return { success: false as const, error: baseErr.message };
        resultData = baseCreated;
      } else {
        resultData = created;
      }
    }

    return {
      success: true as const,
      data: {
        id: resultData.id,
        status: resultData.status,
        suggested_points: terms.suggestedPoints,
        promotional_value: terms.promotionalValue,
        is_suspicious: terms.isSuspicious,
      },
    };
  }

  return { success: false as const, error: error?.message || data?.error || 'Falha ao salvar benefício.' };
}

export async function getCompanyCouponsAction(filters?: {
  companyId?: string;
  status?: string;
  search?: string;
}) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).single();
  const isMaster = !!profile?.is_master_admin;

  let query = (supabase.from('organic_reward_redemptions') as any)
    .select('*, organic_campaign_rewards(id, title, category, announced_unit_value, approved_unit_value, allowed_weekdays, allowed_time_start, allowed_time_end), companies(trade_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.companyId) {
    query = query.eq('company_id', filters.companyId);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim();
    query = query.or(`coupon_code.ilike.%${term}%,participant_display_name.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) return { success: false as const, error: error.message };

  return { success: true as const, coupons: data || [], isMaster };
}

export async function validateCompanyCouponAction(
  codeOrToken: string,
  locationUnit?: string,
  validationMethod: 'qr' | 'code' | 'manual' = 'code',
  notes?: string
) {
  if (!codeOrToken || codeOrToken.trim().length < 4) {
    return { success: false as const, error: 'Código ou token inválido.' };
  }

  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data, error } = await (supabase.rpc as any)('validate_and_redeem_coupon', {
    p_code_or_token: codeOrToken.trim(),
    p_location_unit: locationUnit || null,
    p_validation_method: validationMethod,
    p_notes: notes || null,
  });

  if (!error && data?.success) {
    return { success: true as const, redemption: data };
  }

  // Fallback resiliente
  if (error && (error.code === '42883' || error.message?.includes('does not exist'))) {
    const admin: any = createAdminClient();
    const search = codeOrToken.trim().toUpperCase();

    const { data: redemptions } = await (admin.from('organic_reward_redemptions') as any)
      .select('*, organic_campaign_rewards(*)')
      .or(`coupon_code.eq.${search},qr_token.eq.${codeOrToken.trim()},redemption_code_hash.eq.${hashCouponCode(search)}`)
      .limit(1);

    const redemption = redemptions?.[0];
    if (!redemption) return { success: false as const, error: 'Cupom não encontrado.' };
    if (redemption.status === 'redeemed') return { success: false as const, error: 'Cupom já foi utilizado.' };
    if (redemption.status === 'expired' || new Date(redemption.expires_at).getTime() <= Date.now()) {
      return { success: false as const, error: 'Cupom expirado.' };
    }

    const reward = redemption.organic_campaign_rewards;
    await (admin.from('organic_reward_redemptions') as any)
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        validated_by: user.id,
        location_unit: locationUnit || null,
        validation_method: validationMethod,
        validation_notes: notes || null,
      })
      .eq('id', redemption.id);

    if (reward) {
      await (admin.from('organic_campaign_rewards') as any)
        .update({
          quantity_reserved: Math.max(0, (reward.quantity_reserved || 1) - 1),
          quantity_redeemed: (reward.quantity_redeemed || 0) + 1,
        })
        .eq('id', reward.id);
    }

    return {
      success: true as const,
      redemption: {
        redemption_id: redemption.id,
        coupon_code: redemption.coupon_code || codeOrToken,
        participant_name: redemption.participant_display_name || 'Participante MPM',
        title: reward?.title || 'Benefício',
        redeemed_at: new Date().toISOString(),
      },
    };
  }

  return { success: false as const, error: error?.message || data?.error || 'Não foi possível validar o cupom.' };
}

export async function cancelCompanyCouponAction(redemptionId: string, reason: string) {
  const supabase: any = createClient();
  const { data, error } = await (supabase.rpc as any)('cancel_organic_coupon', {
    p_redemption_id: redemptionId,
    p_reason: reason.trim(),
  });

  if (error || !data?.success) {
    return { success: false as const, error: error?.message || data?.error || 'Não foi possível cancelar o cupom.' };
  }

  return { success: true as const };
}

export async function getCompanyEntitlementsAction(companyId?: string) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  let entQuery = (supabase.from('organic_benefit_media_entitlements') as any)
    .select('*, organic_campaign_rewards(title, announced_unit_value, approved_unit_value), companies(trade_name)')
    .order('created_at', { ascending: false });

  let redQuery = (supabase.from('organic_reward_redemptions') as any).select('id, status, company_id');

  if (companyId) {
    entQuery = entQuery.eq('company_id', companyId);
    redQuery = redQuery.eq('company_id', companyId);
  }

  const [entRes, redRes] = await Promise.all([entQuery, redQuery]);

  const entitlements = entRes.data || [];
  const redemptions = redRes.data || [];

  const grantedTotal = entitlements.reduce((sum: number, e: any) => sum + Number(e.granted_insertions || 0), 0);
  const executedTotal = entitlements.reduce((sum: number, e: any) => sum + Number(e.executed_insertions || 0), 0);
  const totalPromotionalValue = entitlements.reduce((sum: number, e: any) => sum + Number(e.approved_promotional_value || 0), 0);

  const issuedCoupons = redemptions.length;
  const redeemedCoupons = redemptions.filter((r: any) => r.status === 'redeemed').length;
  const expiredCoupons = redemptions.filter((r: any) => r.status === 'expired').length;
  const conversionRate = issuedCoupons > 0 ? Number(((redeemedCoupons / issuedCoupons) * 100).toFixed(1)) : 0;

  return {
    success: true as const,
    entitlements,
    metrics: {
      totalPromotionalValue,
      grantedInsertions: grantedTotal,
      executedInsertions: executedTotal,
      issuedCoupons,
      redeemedCoupons,
      expiredCoupons,
      conversionRate,
    },
  };
}

export async function reserveOrganicCouponAction(rewardId: string) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data, error } = await (supabase.rpc as any)('reserve_organic_coupon', {
    p_reward_id: rewardId,
  });

  if (!error && data?.success) {
    return { success: true as const, redemption: data };
  }

  // Fallback resiliente
  if (error && (error.code === '42883' || error.message?.includes('does not exist'))) {
    const admin: any = createAdminClient();
    const { data: participant } = await (admin.from('organic_participants') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();
    if (!participant) return { success: false as const, error: 'Participante orgânico não cadastrado ou inativo.' };

    const { data: reward } = await (admin.from('organic_campaign_rewards') as any)
      .select('*')
      .eq('id', rewardId)
      .eq('status', 'active')
      .single();
    if (!reward || reward.quantity_available <= 0) {
      return { success: false as const, error: 'Benefício indisponível ou esgotado.' };
    }

    const points = Number(reward.credits_required || 1);
    if (Number(participant.available_balance || 0) < points) {
      return { success: false as const, error: 'Microcréditos insuficientes.' };
    }

    const couponCode = generateCouponCode();
    const qrToken = generateQrToken();
    const expiresAt = new Date(
      Math.min(
        new Date(reward.expires_at).getTime(),
        Date.now() + (reward.coupon_validity_days || 7) * 86400000
      )
    ).toISOString();

    await (admin.from('organic_participants') as any)
      .update({ available_balance: Math.max(0, Number(participant.available_balance) - points) })
      .eq('id', participant.id);

    await (admin.from('organic_campaign_rewards') as any)
      .update({
        quantity_available: Math.max(0, reward.quantity_available - 1),
        quantity_reserved: (reward.quantity_reserved || 0) + 1,
      })
      .eq('id', reward.id);

    const redPayload: any = {
      reward_id: reward.id,
      company_id: reward.company_id,
      participant_id: participant.id,
      credits_reserved: points,
      redemption_code_hash: hashCouponCode(couponCode),
      redemption_code_suffix: couponCode.slice(-4),
      coupon_code: couponCode,
      qr_token: qrToken,
      participant_display_name: participant.display_name,
      status: 'reserved',
      expires_at: expiresAt,
    };

    let createdRed;
    const { data: redData, error: redErr } = await (admin.from('organic_reward_redemptions') as any)
      .insert(redPayload)
      .select()
      .single();

    if (redErr) {
      const legacyPayload = {
        reward_id: reward.id,
        participant_id: participant.id,
        credits_reserved: points,
        redemption_code_hash: hashCouponCode(couponCode),
        redemption_code_suffix: couponCode.slice(-4),
        status: 'reserved',
        expires_at: expiresAt,
      };
      const { data: legData } = await (admin.from('organic_reward_redemptions') as any)
        .insert(legacyPayload)
        .select()
        .single();
      createdRed = legData;
    } else {
      createdRed = redData;
    }

    await (admin.from('organic_credit_ledger') as any).insert({
      participant_id: participant.id,
      reward_id: reward.id,
      type: 'reservation',
      amount: -points,
      balance_bucket: 'available',
      description: 'Reserva de cupom de benefício',
      metadata: { coupon_code: couponCode, redemption_id: createdRed?.id },
    });

    return {
      success: true as const,
      redemption: {
        redemption_id: createdRed?.id,
        coupon_code: couponCode,
        qr_token: qrToken,
        expires_at: expiresAt,
        title: reward.title,
        participant_name: participant.display_name,
      },
    };
  }

  return {
    success: false as const,
    error: error?.message || data?.error || 'Não foi possível resgatar o benefício.',
  };
}

export async function getParticipantCouponsAction() {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: participant } = await (supabase.from('organic_participants') as any)
    .select('id, display_name, available_balance')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!participant) return { success: true as const, coupons: [], participant: null };

  const { data, error } = await (supabase.from('organic_reward_redemptions') as any)
    .select('*, organic_campaign_rewards(id, title, description, category, image_url, announced_unit_value, approved_unit_value, allowed_weekdays, allowed_time_start, allowed_time_end, unit_locations, min_consumption), companies(trade_name, city, state)')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false });

  if (error) return { success: false as const, error: error.message };

  return {
    success: true as const,
    coupons: data || [],
    participant,
  };
}

export async function getMasterBenefitsAction() {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).single();
  if (!profile?.is_master_admin) return { success: false as const, error: 'Acesso restrito ao Master.' };

  const [benefitsRes, configRes] = await Promise.all([
    (supabase.from('organic_campaign_rewards') as any)
      .select('*, companies(id, trade_name)')
      .order('created_at', { ascending: false }),
    (supabase.from('organic_benefit_configurations') as any)
      .select('*')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    success: true as const,
    benefits: benefitsRes.data || [],
    config: configRes.data || null,
  };
}

export async function masterReviewBenefitAction(
  rewardId: string,
  approvedUnitValue: number,
  status: 'active' | 'rejected' | 'paused',
  reviewNotes?: string
) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data, error } = await (supabase.rpc as any)('approve_organic_benefit', {
    p_reward_id: rewardId,
    p_approved_unit_value: approvedUnitValue,
    p_status: status,
    p_review_notes: reviewNotes || null,
  });

  if (!error && data?.success) {
    return { success: true as const, data };
  }

  // Fallback resiliente
  if (error && (error.code === '42883' || error.message?.includes('does not exist'))) {
    const admin: any = createAdminClient();
    const { data: reward } = await (admin.from('organic_campaign_rewards') as any)
      .select('*')
      .eq('id', rewardId)
      .single();

    if (!reward) return { success: false as const, error: 'Benefício não encontrado.' };

    const terms = calculatePromotionalContribution(approvedUnitValue, reward.quantity_total);

    await (admin.from('organic_campaign_rewards') as any)
      .update({
        approved_unit_value: approvedUnitValue,
        approved_promotional_value: terms.promotionalValue,
        credits_required: terms.suggestedPoints,
        credit_budget: terms.suggestedPoints * reward.quantity_total,
        status,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq('id', rewardId);

    return {
      success: true as const,
      data: {
        reward_id: rewardId,
        status,
        approved_unit_value: approvedUnitValue,
        approved_promotional_value: terms.promotionalValue,
        credits_required: terms.suggestedPoints,
        granted_insertions: terms.grantedInsertions,
      },
    };
  }

  return { success: false as const, error: error?.message || data?.error || 'Falha ao processar revisão.' };
}

export async function getPublicCouponVerificationAction(token: string) {
  if (!token || token.trim().length < 4) {
    return { success: false as const, error: 'Token inválido.' };
  }

  const admin: any = createAdminClient();
  const { data, error } = await (admin.from('organic_reward_redemptions') as any)
    .select('id, coupon_code, qr_token, status, expires_at, participant_display_name, location_unit, redeemed_at, organic_campaign_rewards(id, title, description, category, allowed_weekdays, allowed_time_start, allowed_time_end, unit_locations, min_consumption), companies(id, trade_name, city, state)')
    .or(`qr_token.eq.${token.trim()},coupon_code.eq.${token.trim().toUpperCase()}`)
    .maybeSingle();

  if (error || !data) {
    return { success: false as const, error: 'Cupom não encontrado ou token inválido.' };
  }

  return { success: true as const, coupon: data };
}
