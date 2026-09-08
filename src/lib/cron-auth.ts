import { timingSafeEqual } from 'node:crypto';

export function hasValidCronAuthorization(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(authorization, 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
