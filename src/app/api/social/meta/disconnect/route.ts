import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const connectionId = body.connectionId;
    if (!connectionId) return NextResponse.json({ error: 'connectionId obrigatório.' }, { status: 400 });

    const admin = createAdminClient();
    const { data: conn } = await (admin.from('social_connections') as any)
      .select('id,owner_type,owner_id,provider')
      .eq('id', connectionId)
      .maybeSingle();

    if (!conn) return NextResponse.json({ error: 'Conexão não encontrada.' }, { status: 404 });

    // Verificar autoridade do usuário
    const [{ data: profile }, { data: ownership }] = await Promise.all([
      (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle(),
      conn.owner_type === 'company'
        ? (supabase.from('company_users') as any).select('id').eq('company_id', conn.owner_id).eq('user_id', user.id).eq('is_active', true).in('role', ['owner', 'admin']).maybeSingle()
        : conn.owner_type === 'organic_participant'
          ? (supabase.from('organic_participants') as any).select('id').eq('id', conn.owner_id).eq('user_id', user.id).maybeSingle()
          : (supabase.from('creator_profiles') as any).select('id').eq('id', conn.owner_id).eq('user_id', user.id).maybeSingle(),
    ]);

    if (!profile?.is_master_admin && !ownership) {
      return NextResponse.json({ error: 'Sem autoridade para revogar esta conexão.' }, { status: 403 });
    }

    // Revoga a conexão e limpa tokens
    await (admin.from('social_connections') as any)
      .update({
        status: 'revoked',
        encrypted_access_token: null,
        metadata: { revoked_at: new Date().toISOString(), revoked_by: user.id },
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    // Desativa canais associados
    await (admin.from('social_channels') as any)
      .update({
        participation_enabled: false,
        status: 'revoked',
        diagnostic_status: 'revoked',
        diagnostic_message: 'Conexão revogada pelo usuário.',
        updated_at: new Date().toISOString(),
      })
      .eq('connection_id', conn.id);

    return NextResponse.json({ success: true, message: 'Conexão revogada com sucesso.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao revogar conexão.' }, { status: 500 });
  }
}
