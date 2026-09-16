import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requestPairingCodeAction } from '@/app/actions/pairing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const forceNew = request.nextUrl.searchParams.get('force') === '1';
  if (!forceNew && request.cookies.get('mpm_tv_pairing_code')?.value && request.cookies.get('mpm_tv_pairing_secret')?.value) {
    return NextResponse.redirect(new URL('/api/tv/pairing/status', request.url), 303);
  }

  const secret = crypto.randomBytes(32).toString('hex');
  const fingerprint = request.headers.get('user-agent')?.slice(0, 500) || undefined;
  const result = await requestPairingCodeAction(secret, fingerprint);

  if (!result.success || !result.code || !result.expiresAt) {
    return new NextResponse(
      errorHtml(result.error || 'Tente novamente em alguns instantes.'),
      { status: 503, headers: htmlHeaders() }
    );
  }

  const response = NextResponse.redirect(new URL('/api/tv/pairing/status', request.url), 303);
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 10 * 60,
  };
  response.cookies.set('mpm_tv_pairing_code', result.code, cookieOptions);
  response.cookies.set('mpm_tv_pairing_secret', secret, cookieOptions);
  response.cookies.set('mpm_tv_pairing_expires', String(new Date(result.expiresAt).getTime()), cookieOptions);
  return response;
}

function htmlHeaders() {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  };
}

function errorHtml(message: string) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Falha no pareamento</title><style>
html,body{height:100%;margin:0;background:#020617;color:#fff;font-family:Arial,sans-serif}main{min-height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px;box-sizing:border-box}.card{max-width:760px;border:1px solid #334155;background:#0f172a;border-radius:24px;padding:36px;box-sizing:border-box}h1{font-size:32px;margin:0 0 16px}p{color:#cbd5e1;font-size:20px;line-height:1.5}a{display:inline-block;margin-top:22px;padding:18px 28px;border-radius:14px;background:#0ea5e9;color:#fff;text-decoration:none;font-size:20px;font-weight:bold}
</style></head><body><main><section class="card"><h1>Não foi possível gerar o código</h1><p>${message}</p><a href="/api/tv/pairing/start">Tentar gerar novamente</a></section></main></body></html>`;
}
