$ErrorActionPreference = 'SilentlyContinue'
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'MidiaPorMidia Monitor.lnk'
$installDir = Join-Path $env:LOCALAPPDATA 'MidiaPorMidia\Monitor'
Remove-Item -LiteralPath $shortcutPath -Force
Remove-Item -LiteralPath $installDir -Recurse -Force
Write-Output 'Monitor Windows removido deste computador.'
