import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSocialToken } from '@/lib/social-token-crypto';
import { isFreshTimestamp, verifyPartnerSignature } from '@/lib/referrals';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const keyId = request.headers.get('x-mpm-key-id') || '';
  const apiKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const timestamp = request.headers.get('x-mpm-timestamp') || '';
  const signature = request.headers.get('x-mpm-signature') || '';
  if (!keyId || !apiKey || !isFreshTimestamp(timestamp)) return NextResponse.json({ error: 'Autenticação inválida ou timestamp expirado.' }, { status: 401 });
  const admin = createAdminClient();
  const { data: feature } = await (admin.from('platform_settings') as any).select('value').eq('key', 'external_lead_api_enabled').maybeSingle();
  if (!(feature?.value === true || feature?.value === 'true')) return NextResponse.json({ error: 'Integração externa desabilitada.' }, { status: 503 });
  const { data: credential } = await (admin.from as any)('integration_credentials').select('*,integration_partners(*)').eq('key_id', keyId).eq('status', 'active').maybeSingle();
  if (!credential || credential.api_key_hash !== createHash('sha256').update(apiKey).digest('hex')) return NextResponse.json({ error: 'Credencial inválida.' }, { status: 401 });
  if (!verifyPartnerSignature(decryptSocialToken(credential.encrypted_hmac_secret), timestamp, raw, signature)) return NextResponse.json({ error: 'Assinatura HMAC inválida.' }, { status: 401 });
  const partner = credential.integration_partners;
  const { data: allowed } = await (admin.rpc as any)('consume_integration_rate_limit', { p_partner_id: partner.id, p_limit: partner.rate_limit_per_minute });
  if (!allowed) return NextResponse.json({ error: 'Rate limit excedido.' }, { status: 429 });
  let payload: any; try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const externalEventId = String(payload.external_event_id || '');
  const eventType = String(payload.event_type || '');
  if (!externalEventId || !eventType || !credential.scopes.includes('events:write')) return NextResponse.json({ error: 'Escopo ou evento inválido.' }, { status: 403 });
  const { data: existing } = await (admin.from as any)('integration_events').select('id,status').eq('partner_id', partner.id).eq('external_event_id', externalEventId).maybeSingle();
  if (existing) return NextResponse.json({ success: true, deduplicated: true, event_id: existing.id });
  const { data: event, error } = await (admin.from as any)('integration_events').insert({ partner_id: partner.id, franchise_id: partner.franchise_id, external_event_id: externalEventId, event_type: eventType, event_timestamp: payload.occurred_at || timestamp, payload_hash: createHash('sha256').update(raw).digest('hex'), payload, status: 'received' }).select('id').single();
  if (error) return NextResponse.json({ error: 'Evento não recebido.' }, { status: 409 });
  const { data: result, error: processError } = await (admin.rpc as any)('apply_conversion_event', { p_lead_id: payload.mpm_lead_id, p_event_type: eventType, p_external_event_id: externalEventId, p_payload: payload.data || {}, p_idempotency_key: `${partner.id}:${externalEventId}` });
  await (admin.from as any)('integration_events').update({ status: processError ? 'failed' : 'processed', error_message: processError?.message || null, processed_at: new Date().toISOString() }).eq('id', event.id);
  return NextResponse.json(processError ? { success: false, event_id: event.id, error: 'Falha no processamento.' } : { success: true, event_id: event.id, result }, { status: processError ? 422 : 200 });
}
