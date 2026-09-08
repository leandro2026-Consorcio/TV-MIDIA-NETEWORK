import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getCompanyBenefitsAction,
  getCompanyCouponsAction,
  getCompanyEntitlementsAction
} from '@/app/actions/organic-benefits';
import { BenefitsDashboardClient } from './benefits-dashboard-client';

interface BenefitsPageProps {
  searchParams?: { tab?: string };
}

export default async function BenefitsPage({ searchParams }: BenefitsPageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [benefitsRes, couponsRes, entitlementsRes] = await Promise.all([
    getCompanyBenefitsAction(),
    getCompanyCouponsAction({ status: 'all' }),
    getCompanyEntitlementsAction(),
  ]);

  if (!benefitsRes.success) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
        {benefitsRes.error || 'Acesso restrito.'}
      </div>
    );
  }

  const tabParam = searchParams?.tab;
  let initialTab: 'meus' | 'cadastrar' | 'cupons' | 'divulgacao' = 'meus';
  if (tabParam === 'cadastrar' || tabParam === 'novo') initialTab = 'cadastrar';
  else if (tabParam === 'cupons' || tabParam === 'resgates') initialTab = 'cupons';
  else if (tabParam === 'divulgacao' || tabParam === 'media') initialTab = 'divulgacao';

  return (
    <BenefitsDashboardClient
      initialTab={initialTab}
      isMaster={benefitsRes.isMaster}
      companies={benefitsRes.companies}
      benefits={benefitsRes.benefits}
      coupons={couponsRes.success ? couponsRes.coupons : []}
      entitlements={entitlementsRes.success ? entitlementsRes.entitlements : []}
      metrics={benefitsRes.metrics}
      mediaMetrics={entitlementsRes.success ? entitlementsRes.metrics : {}}
    />
  );
}
