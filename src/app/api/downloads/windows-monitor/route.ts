import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const organic = request.nextUrl.searchParams.get('mode') === 'organic';
  const requestedIdle = Number(request.nextUrl.searchParams.get('idle') || (organic ? 5 : 0));
  const idle = Number.isFinite(requestedIdle) ? Math.max(0, Math.min(1440, Math.round(requestedIdle))) : (organic ? 5 : 0);
  const source = fs.readFileSync(path.join(process.cwd(), 'windows-monitor', 'Install-MidiaMonitor.ps1'), 'utf8');
  const playerUrl = organic ? 'https://midiapormidia.com.br/organic-tv' : 'https://midiapormidia.com.br/tv';
  const script = source
    .replace("[string]$PlayerUrl = 'https://midiapormidia.com.br/tv'", `[string]$PlayerUrl = '${playerUrl}'`)
    .replace('[int]$IdleStartMinutes = 0', `[int]$IdleStartMinutes = ${idle}`);

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${organic ? 'Instalar-MidiaMonitor-Organico.ps1' : 'Instalar-MidiaMonitor.ps1'}"`,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
