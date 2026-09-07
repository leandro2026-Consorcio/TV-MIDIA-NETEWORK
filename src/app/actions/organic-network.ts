'use server';

import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function code() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join('');
}

function encrypt(value: string, secretHash: string) {
  const key = crypto.createHash('sha256').update(secretHash).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('hex'), iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

function decrypt(value: any, secretHash: string) {
  try {
    const key = crypto.createHash('sha256').update(secretHash).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(value.authTag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'hex')), decipher.final()]).toString('utf8');
  } catch { return null; }
}

export async function getOrganicDashboardAction() {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: participant } = await (supabase.from('organic_participants') as any).select('*').eq('user_id', user.id).maybeSingle();
  if (!participant) return { success: true as const, participant: null, screens: [], rewards: [], ledger: [], redemptions: [] };
  const [screens, rewards, ledger, redemptions] = await Promise.all([
    (supabase.from('organic_screens') as any).select('*').eq('participant_id', participant.id).order('created_at'),
    (supabase.from('organic_campaign_rewards') as any).select('*, companies(trade_name)').eq('status', 'active').gt('quantity_available', 0).gt('expires_at', new Date().toISOString()).order('credits_required'),
    (supabase.from('organic_credit_ledger') as any).select('*').eq('participant_id', participant.id).order('created_at', { ascending: false }).limit(50),
    (supabase.from('organic_reward_redemptions') as any).select('*, organic_campaign_rewards(title, companies(trade_name))').eq('participant_id', participant.id).order('created_at', { ascending: false }).limit(20),
  ]);
  return { success: true as const, participant, screens: screens.data || [], rewards: rewards.data || [], ledger: ledger.data || [], redemptions: redemptions.data || [] };
}

export async function activateOrganicParticipantAction(payload: { displayName: string; city: string; state: string }) {
  const supabase: any = createClient();
  const { data, error } = await (supabase.rpc as any)('activate_organic_participant', { p_display_name: payload.displayName, p_city: payload.city, p_state: payload.state || 'MT' });
  return error ? { success: false as const, error: error.message } : { success: true as const, id: data };
}

export async function createOrganicScreenAction(payload: { name: string; deviceType: 'organic_tv' | 'organic_windows_monitor'; idleStartSeconds: number }) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: participant } = await (supabase.from('organic_participants') as any).select('id').eq('user_id', user.id).eq('status', 'active').single();
  if (!participant) return { success: false as const, error: 'Ative primeiro sua participação na Rede Orgânica.' };
  const countResult = await (supabase.from('organic_screens') as any).select('*', { count: 'exact', head: true }).eq('participant_id', participant.id);
  if ((countResult.count || 0) >= 3) return { success: false as const, error: 'Limite inicial de 3 telas por participante.' };
  const { data, error } = await (supabase.from('organic_screens') as any).insert({ participant_id: participant.id, name: payload.name.trim(), device_type: payload.deviceType, idle_start_seconds: Math.max(0, Math.min(86400, payload.idleStartSeconds)), status: 'pending_pairing' }).select().single();
  return error ? { success: false as const, error: error.message } : { success: true as const, screen: data };
}

export async function pairOrganicScreenAction(screenId: string, pairingCode: string) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: screen } = await (supabase.from('organic_screens') as any).select('id, participant_id, organic_participants!inner(user_id)').eq('id', screenId).eq('organic_participants.user_id', user.id).single();
  if (!screen) return { success: false as const, error: 'Tela orgânica não encontrada.' };
  const admin: any = createAdminClient();
  const { data: pairing } = await (admin.from('organic_pairing_codes') as any).select('*').eq('code', pairingCode.trim().toUpperCase()).eq('status', 'pending').gt('expires_at', new Date().toISOString()).single();
  if (!pairing) return { success: false as const, error: 'Código inválido ou expirado.' };
  const token = `sk_organic_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`;
  await (admin.from('organic_screens') as any).update({ device_token_hash: hash(token), status: 'online', paired_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', screenId);
  await (admin.from('organic_pairing_codes') as any).update({ screen_id: screenId, encrypted_device_token: encrypt(token, pairing.request_secret_hash), status: 'paired' }).eq('id', pairing.id);
  return { success: true as const };
}

export async function requestOrganicPairingCodeAction(secret: string) {
  if (secret.length < 16) return { success: false as const, error: 'Solicitação inválida.' };
  const admin: any = createAdminClient();
  const pairingCode = code();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { error } = await (admin.from('organic_pairing_codes') as any).insert({ code: pairingCode, request_secret_hash: hash(secret), expires_at: expiresAt });
  return error ? { success: false as const, error: 'Não foi possível gerar o código.' } : { success: true as const, code: pairingCode, expiresAt };
}

export async function checkOrganicPairingAction(pairingCode: string, secret: string) {
  const admin: any = createAdminClient();
  const { data } = await (admin.from('organic_pairing_codes') as any).select('*').eq('code', pairingCode).single();
  if (!data || data.request_secret_hash !== hash(secret)) return { status: 'invalid' as const };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { status: 'expired' as const };
  if (data.status !== 'paired' || !data.encrypted_device_token) return { status: data.status as string };
  const token = decrypt(data.encrypted_device_token, data.request_secret_hash);
  if (!token) return { status: 'invalid' as const };
  await (admin.from('organic_pairing_codes') as any).update({ status: 'claimed', encrypted_device_token: null }).eq('id', data.id);
  return { status: 'paired' as const, deviceToken: token };
}

export async function getOrganicProgrammingAction(deviceToken: string) {
  if (!deviceToken?.startsWith('sk_organic_')) return { success: false as const, error: 'Dispositivo inválido.' };
  const admin: any = createAdminClient();
  const { data: screen } = await (admin.from('organic_screens') as any).select('*, organic_participants(city,state,status)').eq('device_token_hash', hash(deviceToken)).single();
  if (!screen || screen.status === 'blocked' || screen.status === 'paused' || screen.organic_participants?.status !== 'active') return { success: false as const, error: 'Tela orgânica inativa.' };
  await (admin.from('organic_screens') as any).update({ status: 'online', last_ping_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', screen.id);
  const city = screen.organic_participants.city;
  const state = screen.organic_participants.state;
  const { data: rewards } = await (admin.from('organic_campaign_rewards') as any)
    .select('id,campaign_id,title,city,state,campaigns(status,campaign_media(is_active,playback_duration_seconds,media_assets(id,title,file_path,media_type,status)))')
    .eq('status', 'active').gt('quantity_available', 0).lt('starts_at', new Date().toISOString()).gt('expires_at', new Date().toISOString()).limit(25);
  const items: any[] = [];
  for (const reward of rewards || []) {
    if (reward.city && reward.city.toLowerCase() !== String(city).toLowerCase()) continue;
    if (reward.state && reward.state.toUpperCase() !== String(state).toUpperCase()) continue;
    if (!['active', 'scheduled'].includes(reward.campaigns?.status)) continue;
    for (const link of reward.campaigns?.campaign_media || []) {
      const media = link.media_assets;
      if (!link.is_active || media?.status !== 'approved') continue;
      const { data: signed } = await admin.storage.from('media-assets').createSignedUrl(media.file_path, 3600);
      if (signed?.signedUrl) items.push({ id: `${reward.id}:${media.id}`, rewardId: reward.id, campaignId: reward.campaign_id, mediaId: media.id, title: media.title, mediaType: media.media_type, duration: Number(link.playback_duration_seconds || 10), url: signed.signedUrl });
    }
  }
  return { success: true as const, screen: { id: screen.id, name: screen.name, deviceType: screen.device_type }, items };
}

export async function recordOrganicPlaybackAction(deviceToken: string, item: { rewardId: string; campaignId: string; mediaId: string; duration: number; idempotencyKey: string }) {
  const admin: any = createAdminClient();
  const { data: screen } = await (admin.from('organic_screens') as any).select('id').eq('device_token_hash', hash(deviceToken)).single();
  if (!screen) return { success: false as const, error: 'Dispositivo inválido.' };
  const { data, error } = await (admin.rpc as any)('record_organic_playback', { p_screen_id: screen.id, p_reward_id: item.rewardId, p_campaign_id: item.campaignId, p_media_asset_id: item.mediaId, p_duration_seconds: item.duration, p_idempotency_key: item.idempotencyKey });
  return error ? { success: false as const, error: 'Falha ao registrar exibição.' } : data;
}

export async function reserveOrganicRewardAction(rewardId: string) {
  const rawCode = crypto.randomBytes(5).toString('hex').toUpperCase();
  const supabase: any = createClient();
  const { data, error } = await (supabase.rpc as any)('reserve_organic_reward', { p_reward_id: rewardId, p_code_hash: hash(rawCode), p_code_suffix: rawCode.slice(-4) });
  return error || !data?.success ? { success: false as const, error: error?.message || data?.error || 'Não foi possível reservar.' } : { success: true as const, code: rawCode, expiresAt: data.expires_at };
}

export async function getOrganicRewardsManagementAction() {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).single();
  let companyIds: string[] = [];
  if (profile?.is_master_admin) {
    const { data } = await (supabase.from('companies') as any).select('id'); companyIds = (data || []).map((x: any) => x.id);
  } else {
    const { data } = await (supabase.from('company_users') as any).select('company_id').eq('user_id', user.id).eq('role', 'admin').eq('is_active', true); companyIds = (data || []).map((x: any) => x.company_id);
  }
  if (!companyIds.length) return { success: true as const, companies: [], campaigns: [], rewards: [] };
  const [companies, campaigns, rewards] = await Promise.all([
    (supabase.from('companies') as any).select('id,trade_name').in('id', companyIds).order('trade_name'),
    (supabase.from('campaigns') as any).select('id,company_id,name,status').in('company_id', companyIds).in('status', ['draft','scheduled','active']).order('created_at', { ascending: false }),
    (supabase.from('organic_campaign_rewards') as any).select('*,companies(trade_name),campaigns(name)').in('company_id', companyIds).order('created_at', { ascending: false }),
  ]);
  return { success: true as const, companies: companies.data || [], campaigns: campaigns.data || [], rewards: rewards.data || [] };
}

export async function createOrganicRewardAction(payload: { campaignId: string; companyId: string; title: string; description: string; creditsRequired: number; creditBudget: number; quantity: number; expiresAt: string; city?: string; state?: string }) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).single();
  if (!profile?.is_master_admin) {
    const { data: membership } = await (supabase.from('company_users') as any).select('id').eq('company_id', payload.companyId).eq('user_id', user.id).eq('role', 'admin').eq('is_active', true).single();
    if (!membership) return { success: false as const, error: 'Apenas administradores da empresa podem cadastrar brindes.' };
  }
  const { data: campaign } = await (supabase.from('campaigns') as any).select('id,company_id').eq('id', payload.campaignId).eq('company_id', payload.companyId).single();
  if (!campaign) return { success: false as const, error: 'Campanha inválida para esta empresa.' };
  const quantity = Math.max(1, Math.floor(payload.quantity));
  const { error } = await (supabase.from('organic_campaign_rewards') as any).insert({ campaign_id: payload.campaignId, company_id: payload.companyId, title: payload.title.trim(), description: payload.description.trim() || null, credits_required: Math.max(0.01, payload.creditsRequired), credit_budget: Math.max(0.01, payload.creditBudget), quantity_total: quantity, quantity_available: quantity, expires_at: new Date(payload.expiresAt).toISOString(), city: payload.city?.trim() || null, state: payload.state?.trim().toUpperCase() || null, status: 'active', created_by: user.id });
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export async function validateOrganicRedemptionAction(rawCode: string) {
  if (!rawCode || rawCode.trim().length < 8) return { success: false as const, error: 'Código inválido.' };
  const supabase: any = createClient();
  const { data, error } = await (supabase.rpc as any)('validate_organic_redemption', { p_code_hash: hash(rawCode.trim().toUpperCase()) });
  return error || !data?.success ? { success: false as const, error: error?.message || data?.error || 'Não foi possível validar.' } : { success: true as const, title: data.title };
}
