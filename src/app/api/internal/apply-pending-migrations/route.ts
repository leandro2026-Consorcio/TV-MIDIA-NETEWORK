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

    await client.end();
    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, ...results }, { status: 500 });
  }
}
