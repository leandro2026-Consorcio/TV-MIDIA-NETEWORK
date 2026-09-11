import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSocialToken, encryptSocialToken } from '@/lib/social-token-crypto';
import { fingerprint, isFreshTimestamp, maskIdentifier, normalizeEmail, normalizePhone, verifyPartnerSignature } from '@/lib/referrals';

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
  if (!partner || partner.status !== 'active' || !credential.scopes.includes('leads:write')) return NextResponse.json({ error: 'Parceiro ou escopo inválido.' }, { status: 403 });
  const { data: allowed } = await (admin.rpc as any)('consume_integration_rate_limit', { p_partner_id: partner.id, p_limit: partner.rate_limit_per_minute });
  if (!allowed) return NextResponse.json({ error: 'Rate limit excedido.' }, { status: 429 });

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const code = String(payload.referral_code || '').toUpperCase();
  const externalLeadId = String(payload.external_lead_id || '');
  const name = String(payload.name || '').trim();
  const phone = normalizePhone(String(payload.phone || ''));
  const email = normalizeEmail(String(payload.email || ''));
  if (!/^[A-Z0-9_-]{8,32}$/.test(code) || !externalLeadId || name.length < 2 || phone.length < 10 || payload.consent !== true) return NextResponse.json({ error: 'Lead ou consentimento inválido.' }, { status: 400 });
  const { data: referral } = await (admin.from as any)('campaign_referrals').select('id,franchise_id').eq('public_code', code).eq('status', 'active').maybeSingle();
  if (!referral || (partner.franchise_id && referral.franchise_id !== partner.franchise_id)) return NextResponse.json({ error: 'Indicação fora do escopo da franquia.' }, { status: 403 });

  const { data, error } = await (admin.rpc as any)('capture_referral_lead', {
    p_public_code: code,
    p_masked_identifier: maskIdentifier(name, phone),
    p_encrypted_contact: encryptSocialToken(JSON.stringify({ name, phone, email: email || null })),
    p_phone_hash: fingerprint(phone),
    p_email_hash: email ? fingerprint(email) : null,
    p_source_channel: 'partner_api',
    p_source_provider: partner.partner_key,
    p_consent_purpose: String(payload.consent_purpose || 'campaign_referral_contact'),
    p_consent_policy_version: String(payload.consent_policy_version || 'privacy-v1'),
    p_idempotency_key: `${partner.id}:lead:${externalLeadId}`,
    p_external_lead_id: externalLeadId,
  });
  if (error) return NextResponse.json({ error: 'Lead não recebido.' }, { status: 409 });
  return NextResponse.json({ success: true, lead_id: data?.lead_id, deduplicated: Boolean(data?.deduplicated), validation_status: data?.validation_status }, { status: data?.deduplicated ? 200 : 201 });
}
