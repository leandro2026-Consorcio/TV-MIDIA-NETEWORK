import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSocialToken } from '@/lib/social-token-crypto';
import { fingerprint, maskIdentifier, normalizeEmail, normalizePhone } from '@/lib/referrals';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const code = String(form.get('code') || '').toUpperCase();
  const name = String(form.get('name') || '').trim();
  const phone = normalizePhone(String(form.get('phone') || ''));
  const email = normalizeEmail(String(form.get('email') || ''));
  const city = String(form.get('city') || '').trim();
  if (!/^[A-Z0-9_-]{8,32}$/.test(code) || name.length < 2 || phone.length < 10 || form.get('consent') !== 'yes') return NextResponse.json({ success: false, error: 'Dados ou consentimento inválidos.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: feature } = await (admin.from('platform_settings') as any).select('value').eq('key', 'creator_referral_leads_enabled').maybeSingle();
  if (!(feature?.value === true || feature?.value === 'true')) return NextResponse.json({ success: false, error: 'Captação temporariamente indisponível.' }, { status: 503 });
  const idempotency = fingerprint(`${code}:${phone}:${new Date().toISOString().slice(0, 10)}`);
  const { data, error } = await (admin.rpc as any)('capture_referral_lead', {
    p_public_code: code, p_masked_identifier: maskIdentifier(name, phone),
    p_encrypted_contact: encryptSocialToken(JSON.stringify({ name, phone, email: email || null })),
    p_phone_hash: fingerprint(phone), p_email_hash: email ? fingerprint(email) : null,
    p_source_channel: 'landing_mpm', p_source_provider: request.headers.get('referer') || 'direct',
    p_consent_purpose: 'campaign_referral_contact', p_consent_policy_version: 'privacy-v1',
    p_idempotency_key: idempotency, p_external_lead_id: null,
  });
  if (error) return NextResponse.json({ success: false, error: 'Não foi possível registrar a indicação.' }, { status: 400 });
  if (data?.lead_id) await (admin.from as any)('referral_leads').update({ metadata: { city } }).eq('id', data.lead_id);
  return new NextResponse('<!doctype html><meta charset="utf-8"><title>Recebido</title><main style="font-family:sans-serif;max-width:560px;margin:80px auto;text-align:center"><h1>Indicação recebida</h1><p>A equipe responsável poderá entrar em contato. Nenhum pagamento foi realizado.</p></main>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
