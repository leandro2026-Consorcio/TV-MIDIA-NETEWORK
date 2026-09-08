'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { calculateCreatorDynamicPrice, ContentFormat } from '@/lib/mpm/creator-pricing';

export async function getCreatorDashboardDataAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const [{ data: creator }, { data: affiliate }] = await Promise.all([
      (supabase.from('creator_profiles') as any).select('*').eq('user_id', user.id).maybeSingle(),
      (supabase.from('affiliate_profiles') as any).select('*').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    ]);

    if (!creator && !affiliate) {
      return { success: false, error: 'Perfil de creator não encontrado.' };
    }

    const creatorId = creator?.id;
    const affiliateId = affiliate?.id;

    const [
      { data: channels },
      { data: rateCards },
      { data: offers },
      { data: publications },
      { data: scoreHistory },
      { data: metricsSnapshot },
      { data: subscriptions },
      { data: slots },
      { data: commissions },
      { data: entitlements },
      { data: relationship },
    ] = await Promise.all([
      creatorId
        ? (supabase.from('social_channels') as any).select('*, social_connections(*)').eq('owner_type', 'creator').eq('owner_id', creatorId)
        : Promise.resolve({ data: [] }),
      creatorId
        ? (supabase.from('creator_rate_cards') as any).select('*').eq('creator_id', creatorId)
        : Promise.resolve({ data: [] }),
      creatorId
        ? (supabase.from('creator_campaign_offers') as any).select('*, campaigns(*, companies(trade_name))').eq('creator_id', creatorId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      creatorId
        ? (supabase.from('social_publications') as any).select('*, campaigns(*, companies(trade_name))').eq('creator_id', creatorId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      creatorId
        ? (supabase.from('creator_score_history') as any).select('*').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
      creatorId
        ? (supabase.from('creator_metric_snapshots') as any).select('*').eq('creator_id', creatorId).order('captured_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      affiliateId
        ? (supabase.from('company_plan_subscriptions') as any).select('id,status,requested_screens,contracted_amount_cents,companies(trade_name),expansion_plans(name)').eq('origin_creator_affiliate_id', affiliateId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      affiliateId
        ? (supabase.from('subscription_screen_slots') as any).select('id,status,activated_at,screen_id,subscription_id,screens(name),company_plan_subscriptions(companies(trade_name))').eq('creator_affiliate_id', affiliateId)
        : Promise.resolve({ data: [] }),
      affiliateId
        ? (supabase.from('expansion_commission_entries') as any).select('*').eq('beneficiary_affiliate_id', affiliateId).eq('beneficiary_role', 'creator').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      affiliateId
        ? (supabase.from('inventory_entitlements') as any).select('*,entitlement_periods(*)').eq('beneficiary_type', 'affiliate').eq('beneficiary_id', affiliateId)
        : Promise.resolve({ data: [] }),
      affiliateId
        ? (supabase.from('affiliate_relationships') as any).select('leader_affiliate_id,affiliate_profiles!affiliate_relationships_leader_affiliate_id_fkey(display_name)').eq('creator_affiliate_id', affiliateId).eq('status', 'active').maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      success: true,
      data: {
        creator,
        affiliate,
        channels: channels || [],
        rateCards: rateCards || [],
        offers: offers || [],
        publications: publications || [],
        scoreHistory: scoreHistory || [],
        metricsSnapshot,
        subscriptions: subscriptions || [],
        slots: slots || [],
        commissions: commissions || [],
        entitlements: entitlements || [],
        relationship,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao carregar dados do creator.' };
  }
}

export async function updateCreatorProfileAction(data: {
  displayName?: string;
  slug?: string;
  bio?: string;
  city?: string;
  state?: string;
  niches?: string[];
  pricingMode?: 'dynamic' | 'manual' | 'minimum';
  isPublicProfile?: boolean;
  showFollowersPublicly?: boolean;
  showScoresPublicly?: boolean;
  showPricingPublicly?: boolean;
  allowDirectCampaigns?: boolean;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.displayName !== undefined) updatePayload.display_name = data.displayName;
    if (data.slug !== undefined) updatePayload.slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (data.bio !== undefined) updatePayload.bio = data.bio;
    if (data.city !== undefined) updatePayload.city = data.city;
    if (data.state !== undefined) updatePayload.state = data.state;
    if (data.niches !== undefined) updatePayload.niches = data.niches;
    if (data.pricingMode !== undefined) updatePayload.pricing_mode = data.pricingMode;
    if (data.isPublicProfile !== undefined) updatePayload.is_public_profile = data.isPublicProfile;
    if (data.showFollowersPublicly !== undefined) updatePayload.show_followers_publicly = data.showFollowersPublicly;
    if (data.showScoresPublicly !== undefined) updatePayload.show_scores_publicly = data.showScoresPublicly;
    if (data.showPricingPublicly !== undefined) updatePayload.show_pricing_publicly = data.showPricingPublicly;
    if (data.allowDirectCampaigns !== undefined) updatePayload.allow_direct_campaigns = data.allowDirectCampaigns;

    const { error } = await (supabase.from('creator_profiles') as any)
      .update(updatePayload)
      .eq('user_id', user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/creator');
    if (data.slug) revalidatePath(`/creators/${data.slug}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao atualizar perfil do creator.' };
  }
}

export async function setCreatorRateCardAction(creatorId: string, format: string, priceCredits: number, turnaroundHours = 72) {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase.rpc as any)('set_creator_rate_card', {
      p_creator_id: creatorId,
      p_social_channel_id: null,
      p_format: format,
      p_price_credits: priceCredits,
      p_turnaround_hours: turnaroundHours,
      p_is_active: true,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath('/creator');
    return { success: true, cardId: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao configurar rate card.' };
  }
}

export async function respondToCampaignOfferAction(offerId: string, status: 'accepted' | 'refused', reason?: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const { error } = await (supabase.from('creator_campaign_offers') as any)
      .update({
        status,
        response_reason: reason || null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/creator');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao responder proposta de campanha.' };
  }
}

export async function getCreatorDynamicPriceEstimateAction(creatorId: string, format: ContentFormat) {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase.rpc as any)('calculate_creator_dynamic_price', {
      p_creator_id: creatorId,
      p_format: format,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, estimate: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao calcular estimativa de preço.' };
  }
}
