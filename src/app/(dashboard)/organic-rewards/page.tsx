import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getParticipantCouponsAction } from '@/app/actions/organic-benefits';
import { OrganicRewardsClient } from './organic-rewards-client';

export default async function OrganicRewardsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [couponsRes, rewardsRes] = await Promise.all([
    getParticipantCouponsAction(),
    (supabase.from('organic_campaign_rewards') as any)
      .select('*, companies(id, trade_name, city, state)')
      .eq('status', 'active')
      .gt('quantity_available', 0)
      .gt('expires_at', new Date().toISOString())
      .order('credits_required'),
  ]);

  return (
    <OrganicRewardsClient
      participant={couponsRes.participant}
      rewards={rewardsRes.data || []}
      coupons={couponsRes.coupons || []}
    />
  );
}
