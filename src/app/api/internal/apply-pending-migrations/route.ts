import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {};

  const connStr = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) {
    return NextResponse.json({ success: false, error: 'No POSTGRES_URL found in environment' }, { status: 500 });
  }

  let cleanConnStr = connStr;
  try {
    const parsedUrl = new URL(connStr);
    parsedUrl.searchParams.delete('sslmode');
    cleanConnStr = parsedUrl.toString();
  } catch {}

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const client = new pg.Client({
    connectionString: cleanConnStr,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    results.postgresConnected = true;

    // 1. Get already applied migrations
    const migsRes = await client.query(`
      SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC;
    `);
    const appliedVersions = new Set(migsRes.rows.map((r: any) => r.version));
    results.appliedBeforeCount = appliedVersions.size;

    // 2. Discover migration files
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    let files: string[] = [];
    if (fs.existsSync(migrationsDir)) {
      files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    } else {
      results.warning = `Directory ${migrationsDir} does not exist.`;
    }

    results.discoveredFilesCount = files.length;
    const newlyApplied: string[] = [];

    for (const file of files) {
      const match = file.match(/^(\d+)_/);
      if (!match) continue;
      const version = match[1];

      if (appliedVersions.has(version)) {
        continue;
      }

      console.log(`[apply-pending-migrations] Applying migration ${file} (version ${version})...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO supabase_migrations.schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        newlyApplied.push(version);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`[apply-pending-migrations] Error applying ${file}:`, err);
        results.failedAt = { file, version, error: err.message };
        break;
      }
    }

    results.newlyApplied = newlyApplied;

    // 3. Notify PostgREST to reload schema
    await client.query("NOTIFY pgrst, 'reload schema';");
    results.notifiedPgrst = true;

    // 4. Verify function in pg_proc
    const procRes = await client.query(`
      SELECT proname, pg_get_function_identity_arguments(oid) as args
      FROM pg_proc
      WHERE proname = 'submit_or_update_organic_benefit';
    `);
    results.verifiedRpc = procRes.rows;

    // 5. Verify calculation terms for R$ 79,90 x 10
    const calcRes = await client.query(`
      SELECT * FROM public.calculate_organic_benefit_terms(79.90, 10);
    `);
    results.verifiedTerms = calcRes.rows[0];

    // 6. Verify organic benefit configurations
    const configRes = await client.query(`
      SELECT commercial_insertion_unit_cost, media_insertions_per_brl,
             commercial_tv_weight, windows_monitor_weight, residential_screen_weight
      FROM public.organic_benefit_configurations
      LIMIT 1;
    `);
    results.verifiedConfig = configRes.rows[0];

    // 7. Test submitting mandatory benefit if requested
    if (request.nextUrl.searchParams.get('create_mandatory_benefit') === 'true') {
      const compRes = await client.query(`
        SELECT cu.company_id as id, c.trade_name as name, u.email, u.id as user_id
        FROM public.company_users cu
        JOIN public.companies c ON c.id = cu.company_id
        JOIN auth.users u ON u.id = cu.user_id
        WHERE u.email = 'homolog.empresa@msdeducacao.com.br'
        LIMIT 1;
      `);
      let companyId: string | null = null;
      let companyInfo: any = null;
      if (compRes.rows.length > 0) {
        companyId = compRes.rows[0].id;
        companyInfo = compRes.rows[0];
      } else {
        // Fallback para qualquer empresa de teste vinculada
        const anyComp = await client.query(`
          SELECT cu.company_id as id, c.trade_name as name, u.email, u.id as user_id
          FROM public.company_users cu
          JOIN public.companies c ON c.id = cu.company_id
          JOIN auth.users u ON u.id = cu.user_id
          LIMIT 1;
        `);
        if (anyComp.rows.length > 0) {
          companyId = anyComp.rows[0].id;
          companyInfo = anyComp.rows[0];
        }
      }

      if (companyId) {
        // Define claims para que auth.uid() reconheça o usuário na sessão
        await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [companyInfo.user_id]);
        await client.query("SELECT set_config('request.jwt.claim.role', 'authenticated', false)");
        await client.query("SELECT set_config('request.jwt.claims', $1, false)", [
          JSON.stringify({ sub: companyInfo.user_id, role: 'authenticated' })
        ]);

        const uidCheck = await client.query("SELECT auth.uid() as uid;");
        results.verifiedAuthUid = uidCheck.rows[0]?.uid;

        const subRes = await client.query(`
          SELECT * FROM public.submit_or_update_organic_benefit(
            NULL::uuid,
            $1::uuid,
            'Rodízio de Pizza',
            'Delicioso rodízio de pizzas artesanais com sabores tradicionais e especiais.',
            'Gastronomia & Alimentação',
            NULL::text,
            79.90,
            10,
            1,
            ARRAY['Rua Berena, 3333'],
            ARRAY[1],
            '18:00:00'::TIME,
            '22:00:00'::TIME,
            0,
            7,
            (now() + INTERVAL '30 days'),
            NULL::uuid,
            'Válido às segundas-feiras das 18h às 22h na Rua Berena, 3333.'
          );
        `, [companyId]);
        results.createdMandatoryBenefit = {
          company: companyInfo,
          benefit: subRes.rows[0],
        };

        const benefitId = subRes.rows[0]?.submit_or_update_organic_benefit?.id;
        if (benefitId) {
          const rewardRes = await client.query(`
            SELECT * FROM public.organic_campaign_rewards WHERE id = $1;
          `, [benefitId]);
          results.savedRewardRecord = rewardRes.rows[0];

          const entRes = await client.query(`
            SELECT * FROM public.organic_benefit_media_entitlements WHERE reward_id = $1;
          `, [benefitId]);
          results.savedEntitlementRecord = entRes.rows[0];
        }
      } else {
        results.createdMandatoryBenefit = { error: 'No company found in database' };
      }
    }

    await client.end();
    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, ...results }, { status: 500 });
  }
}
