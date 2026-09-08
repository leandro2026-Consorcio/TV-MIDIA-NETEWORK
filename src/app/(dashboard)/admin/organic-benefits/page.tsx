import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMasterBenefitsAction } from '@/app/actions/organic-benefits';
import { AdminBenefitsClient } from './admin-benefits-client';

export default async function AdminBenefitsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const res = await getMasterBenefitsAction();
  if (!res.success) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
        {res.error || 'Acesso restrito ao Master Admin.'}
      </div>
    );
  }

  return <AdminBenefitsClient benefits={res.benefits} config={res.config} />;
}
