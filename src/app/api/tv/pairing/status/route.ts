import { NextRequest, NextResponse } from 'next/server';
import { acknowledgePairingAction, checkPairingStatusAction } from '@/app/actions/pairing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const code = request.cookies.get('mpm_tv_pairing_code')?.value;
  const secret = request.cookies.get('mpm_tv_pairing_secret')?.value;
  const expiresAt = request.cookies.get('mpm_tv_pairing_expires')?.value;

  if (!code || !secret || !expiresAt) {
    return NextResponse.redirect(new URL('/api/tv/pairing/start', request.url), 303);
  }

  const result = await checkPairingStatusAction(code, secret);
  if (result.status === 'paired' && result.deviceToken) {
    const response = NextResponse.redirect(new URL('/tv?pareado=1', request.url), 303);
    response.cookies.set('rede_indoor_device_token', result.deviceToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    });
    clearPairingCookies(response);
    await acknowledgePairingAction(code, secret);
    return response;
  }

  if (result.status === 'expired' || result.status === 'cancelled' || Number(expiresAt) <= Date.now()) {
    const response = new NextResponse(statusHtml({ code, state: 'expired' }), {
      status: 410,
      headers: htmlHeaders(),
    });
    clearPairingCookies(response);
    return response;
  }

  if (
    result.status === 'not_found' ||
    result.status === 'invalid_secret' ||
    result.status === 'server_error' ||
    result.status === 'decryption_failed' ||
    result.status === 'paired'
  ) {
    const response = new NextResponse(statusHtml({ code, state: 'error' }), {
      status: 503,
      headers: htmlHeaders(),
    });
    clearPairingCookies(response);
    return response;
  }

  return new NextResponse(statusHtml({ code, state: 'pending' }), {
    status: 200,
    headers: {
      ...htmlHeaders(),
      Refresh: '3; url=/api/tv/pairing/status',
    },
  });
}

function clearPairingCookies(response: NextResponse) {
  for (const name of ['mpm_tv_pairing_code', 'mpm_tv_pairing_secret', 'mpm_tv_pairing_expires']) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
}

function htmlHeaders() {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  };
}

function statusHtml(input: { code: string; state: 'pending' | 'expired' | 'error' }) {
  const pending = input.state === 'pending';
  const title = pending ? 'Código de pareamento' : input.state === 'expired' ? 'Código expirado' : 'Falha ao consultar pareamento';
  const message = pending
    ? 'Digite este código no cadastro da TV no painel. Esta página verifica o vínculo automaticamente.'
    : input.state === 'expired'
      ? 'O código venceu. Gere um novo código para continuar.'
      : 'Não foi possível consultar este código. Gere outro para tentar novamente.';
  const refresh = pending ? '<meta http-equiv="refresh" content="3;url=/api/tv/pairing/status">' : '';
  const action = pending
    ? '<a class="secondary" href="/api/tv/pairing/status">Verificar agora</a>'
    : '<a href="/api/tv/pairing/start">Gerar novo código</a>';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${refresh}
<title>${title} — Mídia por Mídia</title><style>
html,body{height:100%;margin:0;background:#020617;color:#fff;font-family:Arial,sans-serif}main{min-height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px;box-sizing:border-box}.card{width:100%;max-width:900px;border:2px solid #075985;background:#0f172a;border-radius:28px;padding:42px;box-sizing:border-box}.brand{color:#38bdf8;font-weight:bold;letter-spacing:2px;text-transform:uppercase;font-size:18px}h1{font-size:34px;margin:14px 0}code{display:block;margin:26px auto;padding:24px;border:3px solid #0ea5e9;border-radius:22px;background:#020617;color:#38bdf8;font-family:monospace;font-size:78px;font-weight:bold;letter-spacing:12px}p{color:#cbd5e1;font-size:20px;line-height:1.5;margin:12px auto;max-width:720px}.small{font-size:15px;color:#94a3b8}a{display:inline-block;margin-top:24px;padding:17px 26px;border-radius:14px;background:#0ea5e9;color:#fff;text-decoration:none;font-size:18px;font-weight:bold}.secondary{background:#334155}
@media(max-width:700px){.card{padding:24px}code{font-size:48px;letter-spacing:7px}h1{font-size:26px}}
</style></head><body><main><section class="card"><div class="brand">Mídia por Mídia TV</div><h1>${title}</h1>${pending ? `<code>${input.code}</code>` : ''}<p>${message}</p><p class="small">Validade: 10 minutos. Atualização automática a cada 3 segundos.</p>${action}</section></main></body></html>`;
}
