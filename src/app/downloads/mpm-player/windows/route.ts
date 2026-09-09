import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getInstallerBinary(): Buffer {
  const primaryPath = path.join(process.cwd(), 'public', 'downloads', 'MPM-Player-Setup.exe');
  if (fs.existsSync(primaryPath)) {
    return fs.readFileSync(primaryPath);
  }
  const fallbackPath = path.join(process.cwd(), 'windows-monitor', 'bin', 'MPM-Player-Setup.exe');
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath);
  }
  throw new Error('Instalador MPM-Player-Setup.exe não encontrado no servidor.');
}

export async function GET(request: NextRequest) {
  try {
    const isOrganic = request.nextUrl.searchParams.get('mode') === 'organic';
    const rawIdle = request.nextUrl.searchParams.get('idle');
    const requestedIdle = rawIdle ? Number(rawIdle) : (isOrganic ? 5 : 0);
    const idleMinutes = Number.isFinite(requestedIdle) ? Math.max(0, Math.min(1440, Math.round(requestedIdle))) : (isOrganic ? 5 : 0);

    const playerUrl = isOrganic ? 'https://midiapormidia.com.br/organic-tv' : 'https://midiapormidia.com.br/tv';
    const mode = isOrganic ? 'organic' : 'commercial';

    const baseBinary = getInstallerBinary();

    const overlayConfig = {
      playerUrl,
      idleStartMinutes: idleMinutes,
      mode,
      downloadedAt: new Date().toISOString(),
    };

    const overlayPayload = Buffer.from(
      `\n__MPM_CONFIG_START__${JSON.stringify(overlayConfig)}__MPM_CONFIG_END__\n`,
      'utf8'
    );

    const finalBinary = Buffer.concat([baseBinary, overlayPayload]);
    const filename = isOrganic ? 'MPM-Player-Setup-Organico.exe' : 'MPM-Player-Setup.exe';

    return new NextResponse(finalBinary, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': finalBinary.length.toString(),
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    return new NextResponse(`Erro ao gerar instalador: ${err?.message || 'Erro desconhecido'}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
