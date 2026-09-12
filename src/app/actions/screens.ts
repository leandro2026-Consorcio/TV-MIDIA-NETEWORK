'use server';

import { createClient } from '@/lib/supabase/server';

export async function getMyCompanyScreensAction(companyId: string) {
  if (!companyId) return { success: false, error: 'Selecione uma empresa.', screens: [] };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Usuário não autenticado.', screens: [] };

  const [{ data: profile }, { data: membership }] = await Promise.all([
    (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle(),
    (supabase.from('company_users') as any)
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  // A tela empresarial sempre exige um tenant explícito. Um master pode assumir
  // uma empresa; qualquer outro usuário precisa ter vínculo ativo com ela.
  if (!profile?.is_master_admin && !membership) {
    return { success: false, error: 'Empresa não autorizada para este usuário.', screens: [] };
  }

  const { data, error } = await (supabase.from('screens') as any)
    .select('*, companies(trade_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: 'Não foi possível carregar as TVs.', screens: [] };

  return {
    success: true,
    screens: (data || []).map((screen: any) => ({
      ...screen,
      company_name: screen.companies?.trade_name,
    })),
  };
}
