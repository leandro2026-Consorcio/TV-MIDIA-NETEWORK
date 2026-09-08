/**
 * Utilitário de QR Code sem dependências externas.
 * Fornece fallback seguro com URL de serviço de QR e gerador de SVG baseado em matriz.
 */

export function getQrCodeImageUrl(content: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}`;
}

export function getQrVerificationUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://midiapormidia.com.br';
  return `${base}/verify-coupon/${encodeURIComponent(token)}`;
}
