import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function normalizePhone(value: string) { return value.replace(/\D/g, ''); }
export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function fingerprint(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function maskIdentifier(name: string, phone: string) {
  const first = name.trim().split(/\s+/)[0] || 'Lead';
  const digits = normalizePhone(phone);
  return `${first.slice(0, 2)}*** · ***${digits.slice(-4)}`;
}
export function verifyPartnerSignature(secret: string, timestamp: string, rawBody: string, received: string) {
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
export function isFreshTimestamp(timestamp: string, now = Date.now(), toleranceMs = 5 * 60_000) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && Math.abs(now - parsed) <= toleranceMs;
}
