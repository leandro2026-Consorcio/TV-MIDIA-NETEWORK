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

    // 8. Audit Social Foundation V2 on Production if requested
    if (request.nextUrl.searchParams.get('audit_social') === 'true') {
      const socialAudit: Record<string, any> = {};

      // 8.1 Verify columns in social_connections
      const scCols = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_connections'
        ORDER BY ordinal_position;
      `);
      socialAudit.connectionsColumns = scCols.rows;

      // 8.2 Verify columns in social_channels
      const chCols = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'social_channels'
        ORDER BY ordinal_position;
      `);
      socialAudit.channelsColumns = chCols.rows;

      // 8.3 Verify platform_settings for social
      const settingsRes = await client.query(`
        SELECT key, value, description
        FROM public.platform_settings
        WHERE key LIKE 'social%'
        ORDER BY key;
      `);
      socialAudit.platformSettings = settingsRes.rows;

      // 8.4 Verify RPC functions exist
      const rpcRes = await client.query(`
        SELECT proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc
        WHERE proname IN ('ensure_canonical_creator_profile', 'get_social_diagnostics_for_master');
      `);
      socialAudit.rpcFunctions = rpcRes.rows;

      // 8.5 Test ensure_canonical_creator_profile on Creator user
      const creatorUser = await client.query(`
        SELECT id, email FROM auth.users WHERE email = 'homolog.creator@msdeducacao.com.br' LIMIT 1;
      `);
      if (creatorUser.rows.length > 0) {
        const cUserId = creatorUser.rows[0].id;
        const ensureRes = await client.query(`
          SELECT public.ensure_canonical_creator_profile($1) as canonical_id;
        `, [cUserId]);
        socialAudit.canonicalCreatorProfileId = ensureRes.rows[0]?.canonical_id;

        // Verify profile details
        const profRes = await client.query(`
          SELECT id, user_id, display_name, slug, status FROM public.creator_profiles WHERE id = $1;
        `, [ensureRes.rows[0]?.canonical_id]);
        socialAudit.creatorProfile = profRes.rows[0];
      }

      // 8.6 Test Master diagnostics RPC
      // Call as postgres superuser/definer to inspect what the function generates
      try {
        const diagRes = await client.query(`
          SELECT * FROM public.get_social_diagnostics_for_master();
        `);
        socialAudit.masterDiagnosticsDirect = diagRes.rows;
      } catch (err: any) {
        // Since get_social_diagnostics_for_master checks is_master_admin(), verify exception or mock admin session
        socialAudit.masterDiagnosticsDirectNote = err.message;
      }

      // 8.7 If simulate_e2e_channels=true, exercise end-to-end real database persistence & lifecycle
      if (request.nextUrl.searchParams.get('simulate_e2e') === 'true') {
        const cUserId = creatorUser.rows[0]?.id;
        const cProfileId = socialAudit.canonicalCreatorProfileId;
        const compRes = await client.query(`
          SELECT cu.company_id FROM public.company_users cu
          JOIN auth.users u ON u.id = cu.user_id
          WHERE u.email = 'homolog.empresa@msdeducacao.com.br' LIMIT 1;
        `);
        const companyId = compRes.rows[0]?.company_id;

        if (cProfileId && companyId) {
          // A. Insert simulated active Instagram Direct connection for Creator
          const igConnRes = await client.query(`
            INSERT INTO public.social_connections (
              owner_type, owner_id, provider, auth_flow, provider_account_id,
              scopes, status, connected_by, expires_at, last_refreshed_at, encrypted_access_token
            ) VALUES (
              'creator', $1, 'instagram', 'instagram_login', 'ig_acc_homolog_creator_999',
              ARRAY['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_insights'],
              'active', $2, now() + interval '60 days', now(),
              'v1.mock_iv.mock_tag.mock_encrypted_ciphertext'
            )
            ON CONFLICT (provider, provider_account_id)
            DO UPDATE SET status = 'active', last_refreshed_at = now()
            RETURNING id, status, auth_flow, expires_at, last_refreshed_at;
          `, [cProfileId, cUserId]);
          const igConnId = igConnRes.rows[0]?.id;

          // Insert channel
          const igChanRes = await client.query(`
            INSERT INTO public.social_channels (
              connection_id, owner_type, owner_id, provider, channel_type, auth_flow,
              provider_channel_id, display_name, username, feed_publish_capable,
              reel_publish_capable, story_publish_capable, insights_capable, metrics_capable,
              diagnostic_status, diagnostic_message
            ) VALUES (
              $1, 'creator', $2, 'instagram', 'instagram_professional', 'instagram_login',
              'ig_acc_homolog_creator_999', '@homolog.creator.oficial', 'homolog.creator.oficial',
              true, true, false, false, false,
              'ready_for_campaigns', 'Instagram profissional pronto (Feed e Reels).'
            )
            ON CONFLICT (connection_id, provider_channel_id)
            DO UPDATE SET diagnostic_status = 'ready_for_campaigns', updated_at = now()
            RETURNING id, display_name, auth_flow, diagnostic_status, feed_publish_capable, reel_publish_capable, story_publish_capable, metrics_capable;
          `, [igConnId, cProfileId]);

          // B. Insert simulated Facebook Page connection for Empresa
          const fbConnRes = await client.query(`
            INSERT INTO public.social_connections (
              owner_type, owner_id, provider, auth_flow, provider_account_id,
              scopes, status, connected_by, expires_at, last_refreshed_at, encrypted_access_token
            ) VALUES (
              'company', $1, 'facebook', 'facebook_login', 'fb_page_homolog_empresa_888',
              ARRAY['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
              'active', (SELECT user_id FROM public.company_users WHERE company_id = $1 LIMIT 1),
              now() + interval '60 days', now(),
              'v1.mock_iv.mock_tag.mock_encrypted_ciphertext'
            )
            ON CONFLICT (provider, provider_account_id)
            DO UPDATE SET status = 'active', last_refreshed_at = now()
            RETURNING id, status, auth_flow, expires_at;
          `, [companyId]);
          const fbConnId = fbConnRes.rows[0]?.id;

          const fbChanRes = await client.query(`
            INSERT INTO public.social_channels (
              connection_id, owner_type, owner_id, provider, channel_type, auth_flow,
              provider_channel_id, display_name, feed_publish_capable, reel_publish_capable,
              story_publish_capable, insights_capable, metrics_capable, diagnostic_status, diagnostic_message
            ) VALUES (
              $1, 'company', $2, 'facebook', 'facebook_page', 'facebook_login',
              'fb_page_homolog_empresa_888', 'Empresa Homologação Oficial',
              true, false, false, false, false,
              'ready_for_campaigns', 'Página do Facebook pronta para veiculação no feed.'
            )
            ON CONFLICT (connection_id, provider_channel_id)
            DO UPDATE SET diagnostic_status = 'ready_for_campaigns', updated_at = now()
            RETURNING id, display_name, auth_flow, diagnostic_status;
          `, [fbConnId, companyId]);

          socialAudit.e2eSimulation = {
            creatorInstagramConnection: igConnRes.rows[0],
            creatorInstagramChannel: igChanRes.rows[0],
            empresaFacebookConnection: fbConnRes.rows[0],
            empresaFacebookChannel: fbChanRes.rows[0],
          };

          // Test Disconnect and Reconnect
          await client.query(`
            UPDATE public.social_connections SET status = 'revoked', encrypted_access_token = NULL WHERE id = $1;
          `, [igConnId]);
          const disconnectedRes = await client.query(`SELECT status FROM public.social_connections WHERE id = $1`, [igConnId]);
          socialAudit.e2eSimulation.disconnectResult = disconnectedRes.rows[0];

          // Reconnect
          await client.query(`
            UPDATE public.social_connections SET status = 'active', encrypted_access_token = 'v1.mock_iv2.mock_tag2.mock_encrypted_ciphertext2' WHERE id = $1;
          `, [igConnId]);
          const reconnectedRes = await client.query(`SELECT status FROM public.social_connections WHERE id = $1`, [igConnId]);
          socialAudit.e2eSimulation.reconnectResult = reconnectedRes.rows[0];

          // Test Refresh Token logic
          await client.query(`
            UPDATE public.social_connections
            SET last_refreshed_at = now(), expires_at = now() + interval '60 days'
            WHERE id = $1
            RETURNING last_refreshed_at, expires_at;
          `, [igConnId]);
          const refreshRes = await client.query(`SELECT last_refreshed_at, expires_at FROM public.social_connections WHERE id = $1`, [igConnId]);
          socialAudit.e2eSimulation.refreshResult = refreshRes.rows[0];
        }
      }

      results.socialAudit = socialAudit;
    }

    await client.end();
    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, ...results }, { status: 500 });
  }
}
