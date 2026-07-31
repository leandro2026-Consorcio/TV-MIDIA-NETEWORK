'use server';

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Helper: Hash SHA-256
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Criptografia AES-256-GCM usando o segredo em memória do cliente
function encryptToken(plaintext: string, secretHex: string) {
  const key = crypto.createHash('sha256').update(secretHex).digest(); // 32 bytes
  const iv = crypto.randomBytes(12); // 12 bytes IV para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

// Descriptografia AES-256-GCM
function decryptToken(encryptedObj: { ciphertext: string; iv: string; authTag: string }, secretHex: string): string | null {
  try {
    const key = crypto.createHash('sha256').update(secretHex).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedObj.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
    let decrypted = decipher.update(encryptedObj.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

// Helper: Gerar código alfanumérico legível de 6 dígitos
function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 1. PLAYER: Solicita código de pareamento de 6 dígitos
 * Envia um pairingSecret gerado em memória RAM no cliente para criptografia ponta-a-ponta
 */
export async function requestPairingCodeAction(pairingSecret: string, fingerprint?: string) {
  if (!pairingSecret || pairingSecret.trim().length < 16) {
    return { success: false, error: 'Segredo de pareamento do cliente inválido.' };
  }

  const supabase = createClient();

  // Proteção básica contra spam de códigos
  const { count } = await (supabase.from('screen_pairing_codes') as any)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if ((count || 0) > 50) {
    return { success: false, error: 'Muitos códigos pendentes no momento. Tente novamente em instantes.' };
  }

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos
  const secretHash = hashToken(pairingSecret);

  const { data, error } = await (supabase.from('screen_pairing_codes') as any)
    .insert({
      code,
      expires_at: expiresAt,
      pairing_secret_hash: secretHash,
      device_fingerprint: fingerprint || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao gerar código de pareamento:', error);
    return { success: false, error: 'Erro ao gerar código de pareamento.' };
  }

  return {
    success: true,
    code: data.code,
    expiresAt: data.expires_at,
  };
}

/**
 * 2. PLAYER: Polling enviando o pairingSecret em memória para receber o token descriptografado
 */
export async function checkPairingStatusAction(code: string, pairingSecret: string) {
  if (!code || !pairingSecret) {
    return { status: 'invalid_request' };
  }

  const supabase = createClient();
  const upperCode = code.toUpperCase();

  const { data, error } = await (supabase.from('screen_pairing_codes') as any)
    .select('*')
    .eq('code', upperCode)
    .single();

  if (error || !data) {
    return { status: 'not_found' };
  }

  // Verificar se o código expirou
  if (data.status === 'pending' && new Date(data.expires_at) < new Date()) {
    await (supabase.from('screen_pairing_codes') as any)
      .update({ status: 'expired' })
      .eq('id', data.id);
    return { status: 'expired' };
  }

  // Se já foi pareado pelo Admin e possui o payload criptografado
  if (data.status === 'paired' && data.encrypted_device_token) {
    // Tenta descriptografar usando o pairingSecret mantido na RAM do player
    const rawDeviceToken = decryptToken(data.encrypted_device_token, pairingSecret);

    if (!rawDeviceToken) {
      return { status: 'decryption_failed' };
    }

    const screenId = data.screen_id;

    // Destruição imediata do payload criptografado após a entrega única
    await (supabase.from('screen_pairing_codes') as any)
      .update({ encrypted_device_token: null })
      .eq('id', data.id);

    return {
      status: 'paired',
      deviceToken: rawDeviceToken,
      screenId,
    };
  }

  return { status: data.status };
}

/**
 * 3. ADMIN: Pareia a Tela no Painel.
 * Criptografa o device_token gerado usando o pairing_secret_hash do cliente e salva APENAS o Hash SHA-256 da Tela em screens.
 */
export async function pairScreenAction(screenId: string, pairingCode: string) {
  const supabase = createClient();

  // 1. Validar usuário autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // 2. Buscar a tela
  const { data: screen, error: screenErr } = await (supabase.from('screens') as any)
    .select('*, companies(*)')
    .eq('id', screenId)
    .single();

  if (screenErr || !screen) {
    return { success: false, error: 'Tela não encontrada.' };
  }

  // 3. Validar se o usuário é Admin da empresa da tela ou Master Admin
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  const isMaster = !!profile?.is_master_admin;

  if (!isMaster) {
    const { data: userLink } = await (supabase.from('company_users') as any)
      .select('role')
      .eq('company_id', screen.company_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userLink || userLink.role !== 'admin') {
      return {
        success: false,
        error: 'Acesso negado. Apenas administradores da empresa podem parear telas.',
      };
    }
  }

  // 4. Buscar e validar o código de pareamento
  const cleanCode = pairingCode.trim().toUpperCase();
  const { data: codeRow, error: codeErr } = await (supabase.from('screen_pairing_codes') as any)
    .select('*')
    .eq('code', cleanCode)
    .single();

  if (codeErr || !codeRow) {
    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: screen.company_id,
      action: 'SCREEN_PAIRING_FAILED',
      details: { screen_id: screenId, code: cleanCode, reason: 'Código inexistente' },
    });
    return { success: false, error: 'Código de pareamento inválido ou inexistente.' };
  }

  if (codeRow.status !== 'pending') {
    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: screen.company_id,
      action: 'SCREEN_PAIRING_FAILED',
      details: { screen_id: screenId, code: cleanCode, reason: `Código com status ${codeRow.status}` },
    });
    return { success: false, error: 'Este código já foi utilizado ou cancelado.' };
  }

  if (new Date(codeRow.expires_at) < new Date()) {
    await (supabase.from('screen_pairing_codes') as any)
      .update({ status: 'expired' })
      .eq('id', codeRow.id);

    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: screen.company_id,
      action: 'SCREEN_PAIRING_FAILED',
      details: { screen_id: screenId, code: cleanCode, reason: 'Código expirado' },
    });
    return { success: false, error: 'O código de pareamento expirou (validade: 10 minutos).' };
  }

  // 5. Gerar o device_token com forte entropia (32 bytes random UUID)
  const rawDeviceToken = `sk_device_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`;
  const tokenHash = hashToken(rawDeviceToken);
  const now = new Date().toISOString();

  // 6. Criptografar o token para a tabela temporária de entrega usando o segredo do cliente
  const pairingSecretHash = codeRow.pairing_secret_hash;
  const encryptedPayload = encryptToken(rawDeviceToken, pairingSecretHash);

  // 7. Atualizar a Tabela Screens (Salva APENAS o HASH SHA-256 do token)
  const { error: screenUpdateErr } = await (supabase.from('screens') as any)
    .update({
      device_token_hash: tokenHash,
      status: 'online',
      paired_at: now,
      last_ping_at: now,
      updated_at: now,
    })
    .eq('id', screenId);

  if (screenUpdateErr) {
    return { success: false, error: 'Erro ao vincular dispositivo à tela.' };
  }

  // 8. Atualizar screen_pairing_codes (Armazena APENAS o payload CRIPTOGRAFADO em AES-256-GCM)
  await (supabase.from('screen_pairing_codes') as any)
    .update({
      status: 'paired',
      screen_id: screenId,
      company_id: screen.company_id,
      encrypted_device_token: encryptedPayload,
      paired_at: now,
    })
    .eq('id', codeRow.id);

  // 9. Log de Auditoria
  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: screen.company_id,
    action: 'SCREEN_PAIRED_SUCCESSFULLY',
    details: {
      screen_id: screenId,
      screen_name: screen.name,
      code: cleanCode,
    },
  });

  return { success: true };
}

/**
 * 4. PLAYER: Heartbeat contínuo enviado com o device_token
 */
export async function heartbeatAction(deviceToken: string) {
  // Validação estrita contra tokens vazios, nulos ou malformados
  if (!deviceToken || typeof deviceToken !== 'string' || deviceToken.trim().length < 20 || !deviceToken.startsWith('sk_device_')) {
    return { success: false, error: 'Token de dispositivo inválido ou malformado.' };
  }

  const supabase = createClient();
  const tokenHash = hashToken(deviceToken);
  const now = new Date().toISOString();

  // Localizar a tela pelo Hash SHA-256 do token
  const { data: screen, error } = await (supabase.from('screens') as any)
    .select('id, name, orientation, resolution, status, company_id')
    .eq('device_token_hash', tokenHash)
    .single();

  if (error || !screen) {
    return { success: false, error: 'Dispositivo inválido ou pareamento revogado.' };
  }

  if (screen.status === 'inactive') {
    return { success: false, error: 'Esta tela foi desativada pelo administrador.' };
  }

  // Atualizar last_ping_at e status para 'online'
  await (supabase.from('screens') as any)
    .update({
      last_ping_at: now,
      status: 'online',
      updated_at: now,
    })
    .eq('id', screen.id);

  return {
    success: true,
    screen: {
      id: screen.id,
      name: screen.name,
      orientation: screen.orientation,
      resolution: screen.resolution,
    },
  };
}

/**
 * 5. ADMIN: Desativar Tela e Revogar Token
 */
export async function deactivateScreenAction(screenId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: screen } = await (supabase.from('screens') as any)
    .select('*')
    .eq('id', screenId)
    .single();

  if (!screen) {
    return { success: false, error: 'Tela não encontrada.' };
  }

  // Revogar totalmente o token no banco (set device_token_hash = null)
  await (supabase.from('screens') as any)
    .update({
      status: 'inactive',
      device_token_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', screenId);

  // Log de auditoria
  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: screen.company_id,
    action: 'SCREEN_DEACTIVATED',
    details: { screen_id: screenId, name: screen.name },
  });

  return { success: true };
}
