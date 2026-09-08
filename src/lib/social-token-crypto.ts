import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key() {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY não configurada.');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY deve conter 32 bytes em base64.');
  return decoded;
}

export function encryptSocialToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSocialToken(payload: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) throw new Error('Token social criptografado inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
}
