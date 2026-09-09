import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSocialDiagnosticsAction } from '@/app/actions/social';
import { SocialDiagnosticsClient } from './social-diagnostics-client';

export const dynamic = 'force-dynamic';

export default async function SocialDiagnosticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_master_admin) {
    redirect('/dashboard');
  }

  const res = await getSocialDiagnosticsAction();
  const diagnostics = res.success ? res.diagnostics : [];

  return <SocialDiagnosticsClient initialDiagnostics={diagnostics || []} />;
}
