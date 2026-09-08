import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeaderTeamClient } from './leader-team-client';

export default async function LeaderPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: leader } = await (supabase.from('affiliate_profiles') as any)
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!leader) return <EmptyLeader />;

  const [{ data: relations }, { data: commissions }, { data: candidates }] = await Promise.all([
    (supabase.from('affiliate_relationships') as any)
      .select('creator_affiliate_id,status,starts_at,affiliate_profiles!affiliate_relationships_creator_affiliate_id_fkey(display_name,attribution_code)')
      .eq('leader_affiliate_id', leader.id)
      .eq('status', 'active'),
    (supabase.from('expansion_commission_entries') as any)
      .select('amount_cents,status,entry_kind,created_at')
      .eq('beneficiary_affiliate_id', leader.id)
      .eq('beneficiary_role', 'leader')
      .order('created_at', { ascending: false }),
    (supabase.from('affiliate_profiles') as any)
      .select('id,display_name,attribution_code')
      .eq('status', 'active')
      .neq('id', leader.id)
      .limit(100),
  ]);

  const ids = (relations || []).map((r: any) => r.creator_affiliate_id);

  const [{ data: slots }, { data: subscriptions }] = await Promise.all([
    ids.length
      ? (supabase.from('subscription_screen_slots') as any)
          .select('id,status,creator_affiliate_id,company_plan_subscriptions(companies(trade_name))')
          .in('creator_affiliate_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? (supabase.from('company_plan_subscriptions') as any)
          .select('id,status,origin_creator_affiliate_id,companies(trade_name),requested_screens')
          .in('origin_creator_affiliate_id', ids)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <LeaderTeamClient
      leader={leader}
      relations={relations || []}
      commissions={commissions || []}
      candidates={candidates || []}
      slots={slots || []}
      subscriptions={subscriptions || []}
    />
  );
}

function EmptyLeader() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
      <h1 className="text-2xl font-black text-white">Líder MPM</h1>
      <p className="mt-2 text-sm text-slate-400">Seu perfil de liderança ainda não foi ativado.</p>
    </div>
  );
}
