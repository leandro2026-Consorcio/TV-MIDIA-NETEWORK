'use server';

import { createClient } from '@/lib/supabase/server';

export interface CreatorMarketplaceFilter {
  search?: string;
  city?: string;
  state?: string;
  niche?: string;
  format?: 'feed' | 'reel' | 'story' | 'package';
  minFollowers?: number;
  minCreatorScore?: number;
  minMediaValueScore?: number;
  verifiedOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export async function getMarketplaceCreatorsAction(filters: CreatorMarketplaceFilter = {}) {
  try {
    const supabase = createClient();
    let query = (supabase.from('creator_profiles') as any)
      .select(`
        id, display_name, slug, avatar_url, bio, city, state, niches,
        creator_score, media_value_score, tier, is_verified, pricing_mode,
        show_followers_publicly, show_scores_publicly, show_pricing_publicly,
        creator_rate_cards (id, format, price_credits, turnaround_hours, is_active),
        creator_metric_snapshots (followers, reach, views, engagement_rate, local_relevance, captured_at),
        social_channels (id, provider, channel_type, display_name, feed_publish_capable, reel_publish_capable, story_publish_capable, publication_mode, participation_enabled)
      `)
      .eq('is_public_profile', true)
      .eq('status', 'active');

    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }
    if (filters.state) {
      query = query.eq('state', filters.state);
    }
    if (filters.verifiedOnly) {
      query = query.eq('is_verified', true);
    }
    if (filters.minCreatorScore) {
      query = query.gte('creator_score', filters.minCreatorScore);
    }
    if (filters.minMediaValueScore) {
      query = query.gte('media_value_score', filters.minMediaValueScore);
    }

    const { data: creators, error } = await query;
    if (error) return { success: false, error: error.message, creators: [] };

    let results = (creators || []).map((c: any) => {
      const latestSnapshot = (c.creator_metric_snapshots || []).sort(
        (a: any, b: any) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      )[0];

      const activeRateCards = (c.creator_rate_cards || []).filter((rc: any) => rc.is_active);
      const minPrice = activeRateCards.length
        ? Math.min(...activeRateCards.map((rc: any) => Number(rc.price_credits)))
        : null;

      const activeChannels = (c.social_channels || []).filter((ch: any) => ch.participation_enabled);

      return {
        id: c.id,
        displayName: c.display_name,
        slug: c.slug,
        avatarUrl: c.avatar_url,
        bio: c.bio,
        city: c.city,
        state: c.state,
        niches: c.niches || [],
        tier: c.tier,
        isVerified: c.is_verified,
        pricingMode: c.pricing_mode,
        creatorScore: c.show_scores_publicly ? c.creator_score : null,
        mediaValueScore: c.show_scores_publicly ? c.media_value_score : null,
        followers: c.show_followers_publicly ? (latestSnapshot?.followers || 0) : null,
        views: c.show_followers_publicly ? (latestSnapshot?.views || 0) : null,
        engagementRate: c.show_followers_publicly ? (latestSnapshot?.engagement_rate || 0) : null,
        localRelevance: latestSnapshot?.local_relevance || 50,
        rateCards: c.show_pricing_publicly ? activeRateCards : [],
        minPriceCredits: c.show_pricing_publicly ? minPrice : null,
        channels: activeChannels,
      };
    });

    if (filters.niche) {
      const n = filters.niche.toLowerCase();
      results = results.filter((c: any) => (c.niches || []).some((tag: string) => tag.toLowerCase().includes(n)));
    }

    if (filters.format) {
      results = results.filter((c: any) =>
        c.channels.some((ch: any) => {
          if (filters.format === 'story') return ch.story_publish_capable;
          if (filters.format === 'reel') return ch.reel_publish_capable;
          return ch.feed_publish_capable;
        })
      );
    }

    if (filters.search) {
      const s = filters.search.toLowerCase();
      results = results.filter((c: any) =>
        c.displayName.toLowerCase().includes(s) ||
        (c.city && c.city.toLowerCase().includes(s)) ||
        (c.niches || []).some((tag: string) => tag.toLowerCase().includes(s))
      );
    }

    if (filters.minFollowers) {
      results = results.filter((c: any) => (c.followers || 0) >= (filters.minFollowers || 0));
    }

    if (filters.minPrice !== undefined) {
      results = results.filter((c: any) => c.minPriceCredits !== null && c.minPriceCredits >= (filters.minPrice || 0));
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter((c: any) => c.minPriceCredits !== null && c.minPriceCredits <= (filters.maxPrice || 0));
    }

    return { success: true, creators: results };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao consultar marketplace de creators.', creators: [] };
  }
}

export interface ScreensMarketplaceFilter {
  search?: string;
  city?: string;
  state?: string;
  venueCategory?: string;
  orientation?: 'horizontal' | 'vertical';
  maxPriceCredits?: number;
  onlineOnly?: boolean;
  viewerCompanyId?: string;
}

export async function getMarketplaceScreensAction(filters: ScreensMarketplaceFilter = {}) {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase.rpc as any)('get_marketplace_screens', {
      p_viewer_company_id: filters.viewerCompanyId || null,
      p_search: filters.search || null,
      p_city: filters.city || null,
      p_venue_category: filters.venueCategory || null,
      p_orientation: filters.orientation || null,
      p_online_only: filters.onlineOnly || false,
    });
    if (error) return { success: false, error: error.message, screens: [], cities: [], categories: [] };

    let results = data?.screens || [];
    if (filters.maxPriceCredits) {
      results = results.filter((s: any) => s.indicativePriceCredits <= (filters.maxPriceCredits || 0));
    }

    return { success: true, screens: results, cities: data?.cities || [], categories: data?.categories || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao consultar marketplace de telas.', screens: [], cities: [], categories: [] };
  }
}

export async function quoteCreatorMediaAction(input: {
  buyerCompanyId: string;
  creatorId: string;
  format: 'feed' | 'reel' | 'story' | 'package';
  quantity: number;
  startsAt: string;
  endsAt: string;
  idempotencyKey: string;
}) {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase.rpc as any)('quote_creator_media', {
      p_buyer_company_id: input.buyerCompanyId,
      p_creator_id: input.creatorId,
      p_format: input.format,
      p_quantity: input.quantity,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao cotar mídia com creator.' };
  }
}
