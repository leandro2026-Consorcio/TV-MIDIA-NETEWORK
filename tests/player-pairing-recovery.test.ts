import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const player = fs.readFileSync(path.join(root, 'src/app/player/page.tsx'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src/app/(dashboard)/screens/[id]/page.tsx'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'public/mpm-tv-sw.js'), 'utf8');
const middleware = fs.readFileSync(path.join(root, 'src/lib/supabase/middleware.ts'), 'utf8');

test('TV sem vínculo possui recuperação explícita e URL para forçar novo pareamento', () => {
  assert.match(player, /get\('parear'\) === '1'/);
  assert.match(player, /clearStoredDeviceToken\(\)/);
  assert.match(player, /Gerar código de pareamento/);
  assert.match(player, /midiapormidia\.com\.br\/tv\?parear=1/);
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
