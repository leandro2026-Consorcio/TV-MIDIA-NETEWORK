import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSION = '20260911000385';
const FILE = `${VERSION}_multichannel_bidirectional_replication.sql`;
const ONE_TIME_KEY = 'mpm-f3-20260911-49d8d115-6b32-43e2-92b9-fcbfd9e5f1af';

function authorized(value: string | null) {
  if (!value) return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(ONE_TIME_KEY);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request.headers.get('x-mpm-migration-key'))) return NextResponse.json({ success: false }, { status: 401 });
  const rawConnectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!rawConnectionString) return NextResponse.json({ success: false, error: 'Postgres indisponível.' }, { status: 500 });
  let connectionString = rawConnectionString;
  try {
    const parsed = new URL(rawConnectionString);
    parsed.searchParams.delete('sslmode');
    connectionString = parsed.toString();
  } catch {}
  const requestedMode = request.nextUrl.searchParams.get('mode');
  const mode = requestedMode === 'validate' ? 'validate' : requestedMode === 'homology' ? 'homology' : 'apply';
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const applied = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version');
    const versions = new Set(applied.rows.map((row: any) => row.version));
    const localVersions = readFileSync(join(process.cwd(), 'supabase', 'migrations', FILE), 'utf8');
    const unexpectedPending = ['20260911000382', '20260911000383', '20260911000384'].filter(version => !versions.has(version));
    if (unexpectedPending.length) return NextResponse.json({ success: false, error: 'Migrations predecessoras ausentes.', unexpectedPending }, { status: 409 });
    if (mode === 'homology') {
      if (!versions.has(VERSION)) return NextResponse.json({ success: false, error: 'Migration 385 ainda não aplicada.' }, { status: 409 });
      await client.query('BEGIN');
      await client.query("SELECT set_config('request.jwt.claim.role','service_role',true)");
      await client.query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
      const candidate = await client.query(`SELECT c.id AS company_id,
        (SELECT id FROM public.social_channels WHERE owner_type='company' AND owner_id=c.id AND status='active' ORDER BY provider LIMIT 1) AS channel_id,
        (SELECT provider FROM public.social_channels WHERE owner_type='company' AND owner_id=c.id AND status='active' ORDER BY provider LIMIT 1) AS provider,
        (SELECT id FROM public.screens WHERE company_id=c.id AND venue_type<>'residential' LIMIT 1) AS screen_id,
        (SELECT id FROM public.media_assets WHERE company_id=c.id AND status='approved' LIMIT 1) AS media_id,
        (SELECT id FROM public.campaigns WHERE company_id=c.id LIMIT 1) AS campaign_id
        FROM public.companies c WHERE EXISTS(SELECT 1 FROM public.social_channels WHERE owner_type='company' AND owner_id=c.id AND status='active')
        AND EXISTS(SELECT 1 FROM public.screens WHERE company_id=c.id AND venue_type<>'residential')
        AND EXISTS(SELECT 1 FROM public.media_assets WHERE company_id=c.id AND status='approved')
        AND EXISTS(SELECT 1 FROM public.campaigns WHERE company_id=c.id) LIMIT 1`);
      const inventory = await client.query(`SELECT
        (SELECT count(*) FROM public.multichannel_rules) AS rules_before,
        (SELECT count(*) FROM public.propagation_events) AS events_before,
        (SELECT count(*) FROM public.wallet_ledger) AS credits_before,
        (SELECT count(*) FROM public.media_right_ledger) AS media_rights_before,
        (SELECT count(*) FROM public.conversion_commission_ledger) AS commissions_before,
        (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN
          ('multichannel_rules','multichannel_rule_targets','propagation_events','propagation_targets','multichannel_approval_tasks','multichannel_asset_variants')) AS rls_policies`);
      if (!candidate.rows[0]?.company_id) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: true, mode, controlled: true, rolledBack: true, eligibleFixture: false, inventory: inventory.rows[0] });
      }
      const fixture = candidate.rows[0];
      await client.query(`UPDATE public.platform_settings SET value='true'::jsonb WHERE key IN
        ('multichannel_replication_enabled','social_to_tv_replication_enabled','multichannel_auto_mode_enabled')`);
      const rule = await client.query(`INSERT INTO public.multichannel_rules(owner_type,owner_id,name,source_kind,source_social_channel_id,campaign_id,
        mode,starts_at,ends_at,fallback_mode,filters) VALUES('company',$1,'HOMOLOGAÇÃO TRANSACIONAL FASE 3','social',$2,$3,
        'automatic_temporary',now()-interval '1 minute',now()+interval '5 minutes','approval','{"homology":true}'::jsonb) RETURNING id`,
        [fixture.company_id, fixture.channel_id, fixture.campaign_id]);
      const targetKey = `tv:${fixture.screen_id}`;
      await client.query(`INSERT INTO public.multichannel_rule_targets(rule_id,target_type,target_key,target_screen_id,target_format)
        VALUES($1,'tv',$2,$3,'tv_16_9')`, [rule.rows[0].id, targetKey, fixture.screen_id]);
      const first = await client.query(`SELECT public.register_propagation_event($1,$2,$3,NULL,NULL,'realtime','homology-content','homology-asset',NULL,'{}',0,'homology:event:1') AS result`,
        [rule.rows[0].id, fixture.campaign_id, fixture.media_id]);
      const replay = await client.query(`SELECT public.register_propagation_event($1,$2,$3,NULL,NULL,'realtime','homology-content','homology-asset',NULL,'{}',0,'homology:event:1') AS result`,
        [rule.rows[0].id, fixture.campaign_id, fixture.media_id]);
      const looped = await client.query(`SELECT public.register_propagation_event($1,$2,$3,NULL,NULL,'realtime','homology-loop','homology-asset',NULL,ARRAY[$4],1,'homology:event:loop') AS result`,
        [rule.rows[0].id, fixture.campaign_id, fixture.media_id, targetKey]);
      const depth = await client.query(`SELECT public.register_propagation_event($1,$2,$3,NULL,NULL,'realtime','homology-depth','homology-asset',NULL,'{}',4,'homology:event:depth') AS result`,
        [rule.rows[0].id, fixture.campaign_id, fixture.media_id]);
      const targetStatuses = await client.query(`SELECT status,count(*)::int FROM public.propagation_targets
        WHERE rule_id=$1 GROUP BY status ORDER BY status`, [rule.rows[0].id]);
      const detection = await client.query(`SELECT detection_mode FROM public.propagation_events WHERE id=($1::jsonb->>'event_id')::uuid`, [first.rows[0].result]);
      await client.query(`UPDATE public.multichannel_rules SET ends_at=now()-interval '1 second' WHERE id=$1`, [rule.rows[0].id]);
      const scheduler = await client.query(`SELECT public.process_multichannel_scheduler('homology-fase3') AS result`);
      const fallback = await client.query(`SELECT mode FROM public.multichannel_rules WHERE id=$1`, [rule.rows[0].id]);
      const economics = await client.query(`SELECT
        (SELECT count(*) FROM public.wallet_ledger) AS credits_after,
        (SELECT count(*) FROM public.media_right_ledger) AS media_rights_after,
        (SELECT count(*) FROM public.conversion_commission_ledger) AS commissions_after`);
      await client.query('ROLLBACK');
      return NextResponse.json({ success: true, mode, controlled: true, rolledBack: true, eligibleFixture: true,
        provider: fixture.provider, first: first.rows[0].result, replay: replay.rows[0].result, loop: looped.rows[0].result,
        depth: depth.rows[0].result, targetStatuses: targetStatuses.rows, detectionMode: detection.rows[0]?.detection_mode,
        scheduler: scheduler.rows[0].result, fallbackMode: fallback.rows[0]?.mode, inventory: inventory.rows[0], economics: economics.rows[0] });
    }
    if (versions.has(VERSION)) return NextResponse.json({ success: true, mode, alreadyApplied: true, version: VERSION });
    await client.query('BEGIN');
    await client.query(localVersions);
    const verification = await client.query(`SELECT
      to_regclass('public.multichannel_rules') IS NOT NULL AS rules,
      to_regclass('public.propagation_events') IS NOT NULL AS events,
      to_regclass('public.propagation_targets') IS NOT NULL AS targets,
      (SELECT count(*) FROM public.platform_settings WHERE key IN
        ('multichannel_replication_enabled','social_to_tv_replication_enabled','social_crosspost_enabled','multichannel_auto_mode_enabled')
        AND value='false'::jsonb)=4 AS flags_off`);
    if (mode === 'validate') await client.query('ROLLBACK');
    else {
      await client.query('INSERT INTO supabase_migrations.schema_migrations(version) VALUES($1)', [VERSION]);
      await client.query('COMMIT');
    }
    return NextResponse.json({ success: true, mode, version: VERSION, verification: verification.rows[0] });
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch {}
    return NextResponse.json({ success: false, mode, error: error.message }, { status: 500 });
  } finally {
    await client.end().catch(() => undefined);
  }
}
