import { NextRequest, NextResponse } from 'next/server';
import { importActiveRssSources } from '@/lib/rss';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const results = await importActiveRssSources();
    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Falha ao importar fontes RSS.' },
      { status: 500 }
    );
  }
}
