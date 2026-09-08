import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRODUCTION_PROJECT_REF = 'ubvtfhilsdqgqiwnfciw';
const REQUIRED_ENVIRONMENT = 'homologation';

function fail(message) {
  console.error(`[anti-production] BLOQUEADO: ${message}`);
  process.exit(1);
}

function refFromUrl(value) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname;
    const match = host.match(/^([a-z0-9]{20})\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function linkedRef() {
  const path = resolve('supabase/.temp/project-ref');
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : null;
}

if (process.env.MPM_ENV !== REQUIRED_ENVIRONMENT) {
  fail(`MPM_ENV deve ser exatamente "${REQUIRED_ENVIRONMENT}".`);
}

const expectedRef = process.env.MPM_HOMOLOGATION_PROJECT_REF?.trim();
if (!expectedRef) fail('MPM_HOMOLOGATION_PROJECT_REF é obrigatório.');
if (expectedRef === PRODUCTION_PROJECT_REF) fail('o ref esperado coincide com PRODUÇÃO.');

const candidates = [
  ['SUPABASE_PROJECT_REF', process.env.SUPABASE_PROJECT_REF?.trim()],
  ['supabase/.temp/project-ref', linkedRef()],
  ['SUPABASE_URL', refFromUrl(process.env.SUPABASE_URL)],
  ['NEXT_PUBLIC_SUPABASE_URL', refFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)],
].filter((entry) => entry[1]);

if (candidates.length === 0) {
  fail('nenhum project ref/URL alvo foi encontrado no ambiente ou no link do CLI.');
}

for (const [source, ref] of candidates) {
  if (ref === PRODUCTION_PROJECT_REF) fail(`${source} aponta para PRODUÇÃO.`);
  if (ref !== expectedRef) fail(`${source} (${ref}) diverge do ref de homologação esperado.`);
}

console.log(`[anti-production] PASS: alvo de homologação confirmado (${expectedRef.slice(0, 4)}…${expectedRef.slice(-4)}).`);
