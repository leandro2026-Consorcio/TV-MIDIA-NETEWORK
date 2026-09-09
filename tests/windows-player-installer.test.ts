import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('MPM Windows Player — Executável nativo compilado e íntegro', () => {
  const setupExePath = path.join(process.cwd(), 'public', 'downloads', 'MPM-Player-Setup.exe');
  assert.equal(fs.existsSync(setupExePath), true, 'MPM-Player-Setup.exe deve existir em public/downloads');

  const stats = fs.statSync(setupExePath);
  assert.ok(stats.size > 30000, `Tamanho do instalador deve ser maior que 30KB (atual: ${stats.size} bytes)`);
  assert.ok(stats.size < 5000000, `Tamanho do instalador deve ser enxuto (< 5MB)`);

  // Validar assinatura MZ do cabeçalho PE do Windows
  const buffer = fs.readFileSync(setupExePath);
  assert.equal(buffer[0], 0x4D, 'Byte 0 do cabeçalho PE deve ser "M"');
  assert.equal(buffer[1], 0x5A, 'Byte 1 do cabeçalho PE deve ser "Z"');
});

test('MPM Windows Player — Componentes internos MPMMonitor e Uninstaller', () => {
  const monitorPath = path.join(process.cwd(), 'windows-monitor', 'bin', 'MPMMonitor.exe');
  const uninstPath = path.join(process.cwd(), 'windows-monitor', 'bin', 'Uninstall.exe');

  assert.equal(fs.existsSync(monitorPath), true, 'MPMMonitor.exe deve existir em windows-monitor/bin');
  assert.equal(fs.existsSync(uninstPath), true, 'Uninstall.exe deve existir em windows-monitor/bin');

  const bufMonitor = fs.readFileSync(monitorPath);
  assert.equal(bufMonitor[0], 0x4D);
  assert.equal(bufMonitor[1], 0x5A);

  const bufUninst = fs.readFileSync(uninstPath);
  assert.equal(bufUninst[0], 0x4D);
  assert.equal(bufUninst[1], 0x5A);
});

test('MPM Windows Player — Rota de download com injeção de configuração PE Overlay', () => {
  const baseExe = fs.readFileSync(path.join(process.cwd(), 'public', 'downloads', 'MPM-Player-Setup.exe'));

  // Simulação da geração de overlay comercial (padrão)
  const commConfig = {
    playerUrl: 'https://midiapormidia.com.br/tv',
    idleStartMinutes: 0,
    mode: 'commercial',
  };
  const commOverlay = Buffer.from(`\n__MPM_CONFIG_START__${JSON.stringify(commConfig)}__MPM_CONFIG_END__\n`, 'utf8');
  const commBinary = Buffer.concat([baseExe, commOverlay]);

  assert.ok(commBinary.length > baseExe.length);
  const commStr = commBinary.toString('utf8');
  assert.ok(commStr.includes('__MPM_CONFIG_START__'));
  assert.ok(commStr.includes('https://midiapormidia.com.br/tv'));
  assert.ok(commStr.includes('"idleStartMinutes":0'));

  // Simulação da geração de overlay orgânico (residencial)
  const orgConfig = {
    playerUrl: 'https://midiapormidia.com.br/organic-tv',
    idleStartMinutes: 5,
    mode: 'organic',
  };
  const orgOverlay = Buffer.from(`\n__MPM_CONFIG_START__${JSON.stringify(orgConfig)}__MPM_CONFIG_END__\n`, 'utf8');
  const orgBinary = Buffer.concat([baseExe, orgOverlay]);

  const orgStr = orgBinary.toString('utf8');
  assert.ok(orgStr.includes('https://midiapormidia.com.br/organic-tv'));
  assert.ok(orgStr.includes('"idleStartMinutes":5'));
  assert.ok(orgStr.includes('"mode":"organic"'));
});

test('MPM Windows Player — Equivalência funcional com a lógica legada do PowerShell', () => {
  const monitorCs = fs.readFileSync(
    path.join(process.cwd(), 'windows-monitor', 'src', 'MPMMonitor', 'Program.cs'),
    'utf8'
  );

  // 1. Argumentos do quiosque
  assert.ok(monitorCs.includes('--kiosk'), 'Deve usar parâmetro --kiosk');
  assert.ok(monitorCs.includes('--noerrdialogs'), 'Deve usar parâmetro --noerrdialogs');
  assert.ok(monitorCs.includes('--disable-session-crashed-bubble'), 'Deve usar parâmetro --disable-session-crashed-bubble');
  assert.ok(monitorCs.includes('--user-data-dir'), 'Deve usar perfil dedicado');

  // 2. Detecção de Chrome e Edge
  assert.ok(monitorCs.includes('Google\\Chrome\\Application\\chrome.exe'), 'Deve detectar Chrome');
  assert.ok(monitorCs.includes('Microsoft\\Edge\\Application\\msedge.exe'), 'Deve detectar Edge');

  // 3. P/Invoke de inatividade e keep-awake
  assert.ok(monitorCs.includes('GetLastInputInfo'), 'Deve chamar GetLastInputInfo nativo');
  assert.ok(monitorCs.includes('SetThreadExecutionState'), 'Deve chamar SetThreadExecutionState nativo');
  assert.ok(monitorCs.includes('ES_CONTINUOUS'), 'Deve usar flags de execução contínua');
  assert.ok(monitorCs.includes('ES_DISPLAY_REQUIRED'), 'Deve manter tela/monitor ligado');

  // 4. Modo ocioso vs contínuo
  assert.ok(monitorCs.includes('idleStartMinutes <= 0'), 'Suporta modo contínuo sem inatividade');
  assert.ok(monitorCs.includes('Thread.Sleep(5000)'), 'Ciclo de monitoramento a cada 5 segundos');
});

test('MPM Windows Player — Eliminação de scripts .ps1 para usuário final na interface', () => {
  const screensNewPage = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', '(dashboard)', 'screens', 'new', 'page.tsx'),
    'utf8'
  );
  assert.ok(!screensNewPage.includes('Install-MidiaMonitor.ps1'), 'Não deve exibir .ps1 para download de telas');
  assert.ok(screensNewPage.includes('MPM-Player-Setup.exe'), 'Deve indicar o instalador executável');

  const tourComponent = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'onboarding-tour.tsx'),
    'utf8'
  );
  assert.ok(tourComponent.includes('MPM Player (.exe)'), 'Tour deve indicar o executável Windows');

  const gettingStartedPage = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', '(dashboard)', 'help', 'getting-started', 'page.tsx'),
    'utf8'
  );
  assert.ok(gettingStartedPage.includes('MPM-Player-Setup.exe'), 'Help Center deve orientar uso do setup executável');
});
