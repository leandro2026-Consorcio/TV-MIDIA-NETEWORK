import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const player = fs.readFileSync(path.join(root, 'src/app/player/page.tsx'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src/app/(dashboard)/screens/[id]/page.tsx'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'public/mpm-tv-sw.js'), 'utf8');
const middleware = fs.readFileSync(path.join(root, 'src/lib/supabase/middleware.ts'), 'utf8');
const rootMiddleware = fs.readFileSync(path.join(root, 'src/middleware.ts'), 'utf8');
const tvPage = fs.readFileSync(path.join(root, 'src/app/tv/page.tsx'), 'utf8');
const nativePairingStart = fs.readFileSync(path.join(root, 'src/app/api/tv/pairing/start/route.ts'), 'utf8');
const nativePairingStatus = fs.readFileSync(path.join(root, 'src/app/api/tv/pairing/status/route.ts'), 'utf8');
const legacyTvPage = fs.readFileSync(path.join(root, 'src/app/tv-legado/page.tsx'), 'utf8');
const shortLegacyTvPage = fs.readFileSync(path.join(root, 'src/app/tva/page.tsx'), 'utf8');
const alternateLegacyTvPage = fs.readFileSync(path.join(root, 'src/app/tv2/page.tsx'), 'utf8');
const pairingActions = fs.readFileSync(path.join(root, 'src/app/actions/pairing.ts'), 'utf8');

test('TV sem vínculo possui recuperação explícita e URL para forçar novo pareamento', () => {
  assert.match(player, /get\('parear'\) === '1'/);
  assert.match(player, /clearStoredDeviceToken\(\)/);
  assert.match(player, /Gerar código de pareamento/);
  assert.match(player, /midiapormidia\.com\.br\/tv\?parear=1/);
  assert.match(player, /createCompatiblePlayerId\('sess'\)/);
  assert.match(player, /createCompatiblePlayerId\('pair'\)/);
  assert.doesNotMatch(player, /window\.crypto\.randomUUID\(\)/);
  assert.match(player, /gere um novo código abaixo/);
  assert.match(player, /action="\/api\/tv\/pairing\/start" method="get"/);
});

test('rota /tv sem token usa pareamento nativo independente de JavaScript', () => {
  assert.match(tvPage, /cookieStore\.get\('rede_indoor_device_token'\)/);
  assert.match(tvPage, /redirect\('\/api\/tv\/pairing\/start'\)/);
  assert.match(nativePairingStart, /requestPairingCodeAction\(secret, fingerprint\)/);
  assert.match(nativePairingStatus, /checkPairingStatusAction\(code, secret\)/);
  assert.match(nativePairingStatus, /http-equiv="refresh"/);
  assert.match(nativePairingStatus, /response\.cookies\.set\('rede_indoor_device_token'/);
  assert.match(legacyTvPage, /redirect\('\/api\/tv\/pairing\/start'\)/);
  assert.match(screen, /midiapormidia\.com\.br\/tva/);
  assert.match(screen, /sem depender de JavaScript/);
  assert.match(shortLegacyTvPage, /tv-legado\/page/);
  assert.match(alternateLegacyTvPage, /tv-legado\/page/);
  assert.match(legacyTvPage, /novo === '1'/);
  assert.match(nativePairingStatus, /result\.status === 'decryption_failed'/);
  assert.match(pairingActions, /\.eq\('status', 'pending'\)/);
  assert.match(pairingActions, /O painel não pode deixar a tela falsamente online/);
  assert.match(rootMiddleware, /pathname === '\/player'/);
  assert.match(rootMiddleware, /url\.pathname = '\/tv'/);
});

test('chamadas iniciais do Player não deixam a TV presa eternamente em loading', () => {
  assert.match(player, /PLAYER_REQUEST_TIMEOUT_MS = 15000/);
  assert.match(player, /withPlayerTimeout\([\s\S]*getPlayerPlaylistAction/);
  assert.match(player, /withPlayerTimeout\([\s\S]*requestPairingCodeAction/);
  assert.match(player, /Verificando o vínculo desta TV/);
});

test('painel informa o endereço público, origem e validade do código', () => {
  assert.match(screen, /midiapormidia\.com\.br\/tv/);
  assert.match(screen, /código de 6 caracteres/);
  assert.match(screen, /válido por 10 minutos/);
  assert.match(screen, /O código nasce na TV/);
});

test('Player oferece instalação como app quando o navegador da TV suporta PWA', () => {
  assert.match(player, /ConditionalPwaInstall/);
  assert.match(player, /serviceWorker\.register\('\/mpm-tv-sw\.js', \{ scope: '\/tv' \}\)/);
  assert.match(player, /Instalar MPM nesta TV/);
  assert.match(screen, /modo quiosque\/inicialização do aparelho/);
  assert.match(screen, /instalador nativo abaixo, que já prepara a autoexecução/);
  assert.match(serviceWorker, /network-first/);
  assert.match(middleware, /pathname === '\/mpm-tv-sw\.js'/);
});
