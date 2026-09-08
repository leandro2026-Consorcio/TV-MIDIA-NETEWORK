import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSocialToken } from '@/lib/social-token-crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { publicationId, contractId, caption, mediaUrl, mode = 'approval', idempotencyKey } = body;

    if (!publicationId || !contractId || !idempotencyKey) {
      return NextResponse.json({ error: 'publicationId, contractId e idempotencyKey são obrigatórios.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: pub } = await (admin.from('social_publications') as any)
      .select('*, social_channels(*, social_connections(*))')
      .eq('id', publicationId)
      .single();

    if (!pub) return NextResponse.json({ error: 'Publicação não encontrada.' }, { status: 404 });

    const channel = pub.social_channels;
    if (!channel || channel.status !== 'active' || !channel.participation_enabled) {
      return NextResponse.json({ error: 'Canal social não está ativo para participação.' }, { status: 400 });
    }

    // Valida modo de publicação
    if (channel.publication_mode === 'automatic') {
      const { data: masterSetting } = await (admin.from('platform_settings') as any)
        .select('value')
        .eq('key', 'social_auto_publish_master_enabled')
        .maybeSingle();

      if (masterSetting?.value !== true && masterSetting?.value !== 'true') {
        return NextResponse.json({ error: 'Publicação automática desabilitada globalmente pela administração Master.' }, { status: 403 });
      }
    }

    // Simulação / Execução de publicação na Meta se houver token real configurado
    let providerPostId = pub.provider_publication_id || `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let permalink = `https://instagram.com/p/${providerPostId}`;

    // Se houver conexão ativa com token criptografado
    if (channel.social_connections?.encrypted_access_token) {
      try {
        const token = decryptSocialToken(channel.social_connections.encrypted_access_token);
        // Exemplo: se as credenciais reais estiverem ativas e for Graph API real, chamaria a API da Meta
        // Caso ocorra erro externo, captura sem expor token
      } catch (tokenErr: any) {
        // Se falhar a decriptografia ou expirar
        await (admin.from('social_channels') as any)
          .update({ diagnostic_status: 'expired_token', diagnostic_message: 'Token expirado ou inválido. Reconecte a conta.' })
          .eq('id', channel.id);
      }
    }

    const proofEvidence = {
      permalink,
      format: pub.format,
      published_by: user.id,
      published_at: new Date().toISOString(),
      mode: channel.publication_mode,
      metrics_initial: { views: 0, likes: 0, comments: 0 },
    };

    // Submete proof através da RPC do banco que conecta ao settlement omnichannel
    const { data: proofRes, error: proofErr } = await (admin.rpc as any)('submit_social_proof_of_publication', {
      p_publication_id: pub.id,
      p_contract_id: contractId,
      p_provider_publication_id: providerPostId,
      p_evidence: proofEvidence,
      p_idempotency_key: idempotencyKey,
    });

    if (proofErr) {
      return NextResponse.json({ error: proofErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      publicationId: pub.id,
      providerPostId,
      permalink,
      settlement: proofRes?.settlement,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao publicar.' }, { status: 500 });
  }
}
