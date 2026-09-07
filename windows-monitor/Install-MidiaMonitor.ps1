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
`$chrome = @(
  "`$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "`$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "`$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "`$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "`$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path `$_ } | Select-Object -First 1
if (`$chrome) {
  Start-Process -FilePath `$chrome -ArgumentList "--kiosk", "--noerrdialogs", "--disable-session-crashed-bubble", `$url
} else {
  Start-Process `$url
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
Write-Output "Pasta local: $installDir"
