param(
  [string]$PlayerUrl = 'https://midiapormidia.com.br/tv',
  [int]$IdleStartMinutes = 0
)

$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'MidiaPorMidia\Monitor'
$startupDir = [Environment]::GetFolderPath('Startup')
$launcher = Join-Path $installDir 'Start-MidiaMonitor.ps1'
$shortcutPath = Join-Path $startupDir 'MidiaPorMidia Monitor.lnk'

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$launcherContent = @"
`$ErrorActionPreference = 'SilentlyContinue'
`$url = '$PlayerUrl'
`$idleMinutes = $IdleStartMinutes
`$profileDir = '$installDir\BrowserProfile'
`$chrome = @(
  "`$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "`$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "`$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "`$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "`$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path `$_ } | Select-Object -First 1

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MidiaIdle {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO value);
  [DllImport("kernel32.dll")] static extern uint SetThreadExecutionState(uint flags);
  public static uint Seconds() { var value = new LASTINPUTINFO(); value.cbSize = (uint)Marshal.SizeOf(value); GetLastInputInfo(ref value); return ((uint)Environment.TickCount - value.dwTime) / 1000; }
  public static void KeepAwake() { SetThreadExecutionState(0x80000000u | 0x00000001u | 0x00000002u); }
  public static void RestorePowerPolicy() { SetThreadExecutionState(0x80000000u); }
}
'@

`$playerProcess = `$null
while (`$true) {
  `$idleEnough = `$idleMinutes -le 0 -or [MidiaIdle]::Seconds() -ge (`$idleMinutes * 60)
  `$running = `$playerProcess -and -not `$playerProcess.HasExited
  if (`$idleEnough -and -not `$running) {
    [MidiaIdle]::KeepAwake()
    if (`$chrome) {
      `$playerProcess = Start-Process -PassThru -FilePath `$chrome -ArgumentList "--kiosk", "--noerrdialogs", "--disable-session-crashed-bubble", "--user-data-dir=`"`$profileDir`"", `$url
    } else { Start-Process `$url; `$playerProcess = `$null }
  }
  if (`$idleMinutes -gt 0 -and -not `$idleEnough -and `$running) {
    Stop-Process -Id `$playerProcess.Id -Force
    `$playerProcess = `$null
    [MidiaIdle]::RestorePowerPolicy()
  }
  Start-Sleep -Seconds 5
}
"@

Set-Content -LiteralPath $launcher -Value $launcherContent -Encoding UTF8

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = 'Inicia o Monitor Windows Mídia por Mídia'
$shortcut.Save()

Write-Output "Monitor Windows instalado. O player iniciará com o Windows em: $PlayerUrl"
Write-Output "Inatividade configurada: $IdleStartMinutes minuto(s). Zero significa exibição contínua."
Write-Output "Pasta local: $installDir"
