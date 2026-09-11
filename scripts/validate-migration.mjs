import fs from 'node:fs';
import pg from 'pg';

const envFile = process.argv[2] || '.env.preview.local';
const migrationFile = process.argv[3];
if (!migrationFile) throw new Error('Informe a migration a validar.');
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
}
const connectionString = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL;
if (!connectionString) throw new Error(`Conexão PostgreSQL não configurada em ${envFile}. Chaves lidas: ${Object.keys(env).join(', ')}`);
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('begin');
  await client.query(fs.readFileSync(migrationFile, 'utf8'));
  await client.query('rollback');
  console.log('Migration SQL validada com sucesso em transação revertida.');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  await client.end();
}
