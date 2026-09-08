import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreatorDashboardClient } from './creator-dashboard-client';

export const dynamic = 'force-dynamic';

export default async function CreatorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: creator }, { data: affiliate }] = await Promise.all([
    (supabase.from('creator_profiles') as any).select('*').eq('user_id', user.id).maybeSingle(),
    (supabase.from('affiliate_profiles') as any).select('*').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ]);

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
    { data: pricingRule },
    { data: masterSetting },
  ] = await Promise.all([
    creatorId
      ? (supabase.from('social_channels') as any).select('*, social_connections(*)').eq('owner_type', 'creator').eq('owner_id', creatorId).order('created_at', { ascending: false })
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
    (supabase.from('creator_pricing_rules') as any).select('*').eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle(),
    (supabase.from('platform_settings') as any).select('value').eq('key', 'social_auto_publish_master_enabled').maybeSingle(),
  ]);

  return (
    <CreatorDashboardClient
      user={user}
      creator={creator}
      affiliate={affiliate}
      channels={channels || []}
      rateCards={rateCards || []}
      offers={offers || []}
      publications={publications || []}
      scoreHistory={scoreHistory || []}
      metricsSnapshot={metricsSnapshot}
      subscriptions={subscriptions || []}
      slots={slots || []}
      commissions={commissions || []}
      entitlements={entitlements || []}
      relationship={relationship}
      pricingRule={pricingRule}
      masterAutoPublishEnabled={masterSetting?.value === true || masterSetting?.value === 'true'}
    />
  );
}
