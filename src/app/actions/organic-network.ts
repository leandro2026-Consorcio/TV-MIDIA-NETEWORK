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

/**
 * Dashboard do Participante da Rede Orgânica V2:
 * - Pontos da Rede
 * - Meu Próximo Prêmio (com foto, estabelecimento, barra de progresso, bônus, marcos)
 * - Hoje: X Exibições Validadas, +Y pontos
 * - Missões ativas
 * - Histórico amigável agrupado
 */
export async function getOrganicDashboardAction() {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: participant } = await (supabase.from('organic_participants') as any)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!participant) {
    return {
      success: true as const,
      participant: null,
      screens: [],
      rewards: [],
      ledger: [],
      redemptions: [],
      pinnedReward: null,
      todayStats: { validatedDisplays: 0, pointsEarned: 0 },
      availableMissionsCount: 0,
    };
  }

  const [screensRes, rewardsRes, ledgerRes, redemptionsRes, pinnedRes, completionsRes, missionsRes] = await Promise.all([
    (supabase.from('organic_screens') as any)
      .select('*')
      .eq('participant_id', participant.id)
      .order('created_at'),
    (supabase.from('organic_campaign_rewards') as any)
      .select('*, companies(trade_name, city, neighborhood, address)')
      .eq('status', 'active')
      .gt('quantity_available', 0)
      .gt('expires_at', new Date().toISOString())
      .order('credits_required'),
    (supabase.from('organic_credit_ledger') as any)
      .select('*')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(100),
    (supabase.from('organic_reward_redemptions') as any)
      .select('*, organic_campaign_rewards(title, companies(trade_name))')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(20),
    (supabase.from('organic_participant_pinned_rewards') as any)
      .select('*, organic_campaign_rewards(*, companies(trade_name, city, neighborhood))')
      .eq('participant_id', participant.id)
      .maybeSingle(),
    (supabase.from('organic_participant_mission_completions') as any)
      .select('*')
      .eq('participant_id', participant.id),
    (supabase.from('organic_reward_missions') as any)
      .select('id, reward_id')
      .eq('is_active', true),
  ]);

  const screens = screensRes.data || [];
  const rewards = rewardsRes.data || [];
  const ledger = ledgerRes.data || [];
  const redemptions = redemptionsRes.data || [];
  const completions = completionsRes.data || [];
  const missions = missionsRes.data || [];

  // Estatísticas de hoje (base local)
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayDisplays = 0;
  let todayPoints = 0;

  for (const entry of ledger) {
    if (entry.created_at && entry.created_at.startsWith(todayStr)) {
      if (entry.type === 'playback') {
        todayDisplays += 1;
        todayPoints += Number(entry.amount || 0);
      } else if (Number(entry.amount || 0) > 0) {
        todayPoints += Number(entry.amount || 0);
      }
    }
  }

  // Processa "Meu Próximo Prêmio"
  let pinnedReward: any = null;
  const targetReward = pinnedRes.data?.organic_campaign_rewards || (rewards.length > 0 ? rewards[0] : null);

  if (targetReward) {
    const basePoints = Number(targetReward.credits_required || 80);
    const baseBonus = Number(targetReward.bonus_percentage || 0);

    // Soma bônus de missões aprovadas para esse prêmio
    const approvedMissionsBonus = completions
      .filter((c: any) => c.reward_id === targetReward.id && c.status === 'approved')
      .reduce((sum: number, c: any) => sum + Number(c.bonus_percentage_applied || 0), 0);

    const totalBonus = Math.min(95, baseBonus + approvedMissionsBonus);
    const promoPointsEquivalent = basePoints * (totalBonus / 100);
    const userBalance = Number(participant.available_balance || 0);
    const totalPointsEffective = userBalance + promoPointsEquivalent;

    const progressPercent = Math.min(100, Math.round((totalPointsEffective / basePoints) * 100));
    const netPointsRequired = totalBonus > 0 ? Math.max(1, Math.round(basePoints * (1 - totalBonus / 100))) : basePoints;
    const isReadyToRedeem = userBalance >= netPointsRequired && targetReward.quantity_available > 0;

    let milestoneMessage = 'Conecte sua tela e ganhe Pontos da Rede.';
    if (progressPercent >= 100) milestoneMessage = 'Seu prêmio está liberado! 🎉';
    else if (progressPercent >= 75) milestoneMessage = 'Falta pouco para liberar seu prêmio.';
    else if (progressPercent >= 50) milestoneMessage = 'Metade do caminho!';
    else if (progressPercent >= 25) milestoneMessage = 'Você já começou!';

    pinnedReward = {
      id: targetReward.id,
      title: targetReward.title,
      description: targetReward.description,
      imageUrl: targetReward.image_url,
      companyTradeName: targetReward.companies?.trade_name || 'Estabelecimento Parceiro',
      city: targetReward.companies?.city || targetReward.city || '',
      basePoints,
      baseBonus,
      totalBonus,
      userBalance,
      netPointsRequired,
      progressPercent,
      isReadyToRedeem,
      milestoneMessage,
      quantityAvailable: targetReward.quantity_available,
      expiresAt: targetReward.expires_at,
      pinnedAt: pinnedRes.data?.pinned_at || null,
      isPinned: !!pinnedRes.data,
    };
  }

  // Agrupamento amigável de microeventos do histórico
  const groupedLedger: any[] = [];
  const playbackByDate: Record<string, { count: number; points: number; lastTime: string }> = {};

  for (const entry of ledger) {
    if (entry.type === 'playback') {
      const dateKey = entry.created_at ? entry.created_at.slice(0, 10) : 'recent';
      if (!playbackByDate[dateKey]) {
        playbackByDate[dateKey] = { count: 0, points: 0, lastTime: entry.created_at };
      }
      playbackByDate[dateKey].count += 1;
      playbackByDate[dateKey].points += Number(entry.amount || 0);
    } else {
      groupedLedger.push({
        id: entry.id,
        type: entry.type,
        amount: Number(entry.amount || 0),
        title: entry.type === 'referral'
          ? '+30 — Empresa indicada tornou-se cliente'
          : entry.type === 'reservation'
            ? `${entry.amount} — Resgate de Prêmio`
            : entry.description || 'Lançamento de Pontos',
        createdAt: entry.created_at,
        isGrouped: false,
      });
    }
  }

  // Insere os grupos de exibição por data
  for (const [dateKey, grp] of Object.entries(playbackByDate)) {
    const formattedPoints = grp.points.toFixed(2).replace('.', ',');
    groupedLedger.push({
      id: `group-playback-${dateKey}`,
      type: 'playback_group',
      amount: grp.points,
      title: `+${formattedPoints} pontos — ${grp.count} Exibições Validadas ${dateKey === todayStr ? 'hoje' : 'em ' + dateKey}`,
      createdAt: grp.lastTime,
      isGrouped: true,
      displayCount: grp.count,
    });
  }

  groupedLedger.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    success: true as const,
    participant,
    screens,
    rewards,
    ledger: groupedLedger,
    redemptions,
    pinnedReward,
    todayStats: {
      validatedDisplays: todayDisplays,
      pointsEarned: todayPoints,
    },
    availableMissionsCount: missions.length,
  };
}

/**
 * Fixa ou desfixa o prêmio objetivo ("Meu Próximo Prêmio")
 * IMPORTANTE: Marcar como objetivo NUNCA reserva estoque!
 */
export async function pinOrganicRewardAction(rewardId: string) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: participant } = await (supabase.from('organic_participants') as any)
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!participant) return { success: false as const, error: 'Participante não encontrado.' };

  const admin: any = createAdminClient();

  const { error } = await (admin.from('organic_participant_pinned_rewards') as any)
    .upsert({
      participant_id: participant.id,
      reward_id: rewardId,
      pinned_at: new Date().toISOString(),
    }, { onConflict: 'participant_id' });

  if (error) return { success: false as const, error: error.message };

  return { success: true as const, message: 'Prêmio definido como seu próximo objetivo!' };
}

/**
 * Submete comprovante de missão promocional (Story, Feed/Reel, Compartilhamento)
 */
export async function submitMissionProofAction(payload: {
  missionId: string;
  rewardId: string;
  proofType: 'link' | 'image_url' | 'text';
  proofContent: string;
}) {
  const supabase: any = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const { data: participant } = await (supabase.from('organic_participants') as any)
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!participant) return { success: false as const, error: 'Participante não encontrado.' };

  const content = (payload.proofContent || '').trim();
  if (content.length < 3) {
    return { success: false as const, error: 'Forneça o link ou comprovante da publicação.' };
  }

  const admin: any = createAdminClient();

  const { data, error } = await (admin.from('organic_participant_mission_completions') as any)
    .insert({
      mission_id: payload.missionId,
      reward_id: payload.rewardId,
      participant_id: participant.id,
      proof_type: payload.proofType,
      proof_content: content,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return { success: false as const, error: error.message };

  return {
    success: true as const,
    message: 'Comprovante enviado com sucesso! O bônus será aplicado assim que validado pelo estabelecimento.',
    completion: data,
  };
}

/**
 * Caminho canônico de pontuação por Exibição Validada na tela residencial:
 * - Timezone local da tela/participante
 * - Idempotência por proof_id
 * - Faixa 06:00-23:59 pontua (0.05 pts)
 * - Faixa 00:00-05:59 registra exibição com ZERO pontos (anti-farming)
 * - Lançamento imutável no ledger orgânico
 */
export async function processOrganicDisplayProofAction(payload: {
  screenId: string;
  proofId: string;
  playedAt?: string;
  clientTimezone?: string;
}) {
  const admin: any = createAdminClient();
  const playedAt = payload.playedAt ? new Date(payload.playedAt).toISOString() : new Date().toISOString();

  const { data, error } = await (admin.rpc as any)('process_organic_screen_display_points', {
    p_screen_id: payload.screenId,
    p_proof_id: payload.proofId,
    p_played_at: playedAt,
    p_client_timezone: payload.clientTimezone || 'America/Cuiaba',
  });

  if (error) {
    console.error('[processOrganicDisplayProofAction] RPC error:', error);
    return { success: false as const, error: error.message };
  }

  return { success: true as const, ...data };
}

/**
 * Atribui bônus de indicação de empresa (+30 Pontos da Rede)
 */
export async function creditReferralBonusAction(payload: {
  participantId: string;
  referredCompanyId: string;
}) {
  const admin: any = createAdminClient();
  const { data, error } = await (admin.rpc as any)('credit_organic_referral_points', {
    p_participant_id: payload.participantId,
    p_referred_company_id: payload.referredCompanyId,
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  return { success: true as const, ...data };
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
    .select('id,campaign_id,title,city,state,campaigns(status,campaign_type,campaign_media(is_active,playback_duration_seconds,media_assets(id,title,file_path,media_type,status,owner_only,trial_internal_only)))')
    .eq('status', 'active').gt('quantity_available', 0).lt('starts_at', new Date().toISOString()).gt('expires_at', new Date().toISOString()).limit(25);
  const items: any[] = [];
  for (const reward of rewards || []) {
    if (reward.city && reward.city.toLowerCase() !== String(city).toLowerCase()) continue;
    if (reward.state && reward.state.toUpperCase() !== String(state).toUpperCase()) continue;
    if (!['active', 'scheduled'].includes(reward.campaigns?.status) || reward.campaigns?.campaign_type === 'internal') continue;
    for (const link of reward.campaigns?.campaign_media || []) {
      const media = link.media_assets;
      if (!link.is_active || media?.status !== 'approved' || media.owner_only || media.trial_internal_only) continue;
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
  const { data, error } = await (supabase.rpc as any)('reserve_organic_coupon', { p_reward_id: rewardId });
  if (error || !data?.success) {
    return { success: false as const, error: error?.message || data?.error || 'Não foi possível reservar o prêmio.' };
  }
  return {
    success: true as const,
    code: data.coupon_code,
    qrToken: data.qr_token,
    expiresAt: data.expires_at,
    title: data.title,
    participantName: data.participant_name,
    netCreditsDebited: data.net_credits_debited,
    bonusAppliedPercent: data.bonus_applied_percent,
  };
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
    (supabase.from('campaigns') as any).select('id,company_id,name,status,campaign_type').in('company_id', companyIds).in('status', ['draft','scheduled','active']).neq('campaign_type', 'internal').order('created_at', { ascending: false }),
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
  const { data: campaign } = await (supabase.from('campaigns') as any).select('id,company_id,campaign_type').eq('id', payload.campaignId).eq('company_id', payload.companyId).neq('campaign_type', 'internal').single();
  if (!campaign) return { success: false as const, error: 'Campanha inválida para esta empresa.' };
  const { data: campaignMedia } = await (supabase.from('campaign_media') as any).select('media_assets(owner_only,trial_internal_only)').eq('campaign_id', payload.campaignId);
  if ((campaignMedia || []).some((link: any) => link.media_assets?.owner_only || link.media_assets?.trial_internal_only)) return { success: false as const, error: 'Campanhas com mídia de uso interno não podem participar da Rede Orgânica.' };
  const quantity = Math.max(1, Math.floor(payload.quantity));
  const { error } = await (supabase.from('organic_campaign_rewards') as any).insert({ campaign_id: payload.campaignId, company_id: payload.companyId, title: payload.title.trim(), description: payload.description.trim() || null, credits_required: Math.max(0.01, payload.creditsRequired), credit_budget: Math.max(0.01, payload.creditBudget), quantity_total: quantity, quantity_available: quantity, expires_at: new Date(payload.expiresAt).toISOString(), city: payload.city?.trim() || null, state: payload.state?.trim().toUpperCase() || null, status: 'active', created_by: user.id });
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export async function validateOrganicRedemptionAction(rawCode: string) {
  if (!rawCode || rawCode.trim().length < 4) return { success: false as const, error: 'Código inválido.' };
  const supabase: any = createClient();
  const { data, error } = await (supabase.rpc as any)('validate_and_redeem_coupon', { p_code_or_token: rawCode.trim().toUpperCase() });
  return error || !data?.success ? { success: false as const, error: error?.message || data?.error || 'Não foi possível validar.' } : { success: true as const, title: data.reward_title };
}
