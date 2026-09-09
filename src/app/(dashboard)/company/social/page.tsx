import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CompanySocialClient } from './company-social-client';

export const dynamic = 'force-dynamic';

export default async function CompanySocialPage({
  searchParams,
}: {
  searchParams: { company_id?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .maybeSingle();

  // 1. Resolve a empresa ativa
  let companyId = searchParams.company_id;
  let company: any = null;

  if (companyId) {
    const { data: c } = await (supabase.from('companies') as any)
      .select('*')
      .eq('id', companyId)
      .maybeSingle();
    company = c;
  }

  if (!company) {
    if (profile?.is_master_admin) {
      const { data: firstComp } = await (supabase.from('companies') as any)
        .select('*')
        .order('trade_name')
        .limit(1)
        .maybeSingle();
      company = firstComp;
      companyId = firstComp?.id;
    } else {
      const { data: membership } = await (supabase.from('company_users') as any)
        .select('company_id, companies(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      company = membership?.companies;
      companyId = membership?.company_id;
    }
  }

  if (!companyId) {
    redirect('/dashboard');
  }

  // 2. Carrega canais e conexões da empresa
  const [
    { data: channels },
    { data: socialConnSetting },
    { data: socialMetricsSetting },
  ] = await Promise.all([
    (supabase.from('social_channels') as any)
      .select('*, social_connections(*)')
      .eq('owner_type', 'company')
      .eq('owner_id', companyId)
      .order('created_at', { ascending: false }),
    (supabase.from('platform_settings') as any).select('value').eq('key', 'social_connection_enabled').maybeSingle(),
    (supabase.from('platform_settings') as any).select('value').eq('key', 'social_metrics_enabled').maybeSingle(),
  ]);

  return (
    <CompanySocialClient
      user={user}
      company={company}
      channels={channels || []}
      socialConnectionEnabled={socialConnSetting ? Boolean(socialConnSetting.value) : true}
      socialMetricsEnabled={Boolean(socialMetricsSetting?.value)}
    />
  );
}
