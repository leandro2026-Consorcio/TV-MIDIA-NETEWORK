param([int]$IdleStartMinutes = 5)

$installer = Join-Path $PSScriptRoot 'Install-MidiaMonitor.ps1'
& $installer -PlayerUrl 'https://midiapormidia.com.br/organic-tv' -IdleStartMinutes $IdleStartMinutes
