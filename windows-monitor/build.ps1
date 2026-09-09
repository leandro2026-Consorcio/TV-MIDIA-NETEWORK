$ErrorActionPreference = 'Stop'

Write-Host "==> Iniciando compilação do ecossistema MPM Player Windows..." -ForegroundColor Cyan

$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) {
    throw "Compilador csc.exe não encontrado em: $csc"
}

$binDir = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$iconPath = Join-Path $PSScriptRoot 'mpm.ico'
$iconArg = if (Test-Path $iconPath) { "/win32icon:`"$iconPath`"" } else { "" }

# 1. Compilar MPMMonitor.exe
Write-Host "  [1/3] Compilando MPMMonitor.exe..." -ForegroundColor Yellow
$monitorSrc1 = Join-Path $PSScriptRoot 'src\MPMMonitor\Program.cs'
$monitorSrc2 = Join-Path $PSScriptRoot 'src\MPMMonitor\AssemblyInfo.cs'
$monitorOut = Join-Path $binDir 'MPMMonitor.exe'
if ($iconArg -ne "") {
    & $csc /target:winexe /optimize+ /platform:anycpu $iconArg "/out:$monitorOut" $monitorSrc1 $monitorSrc2
} else {
    & $csc /target:winexe /optimize+ /platform:anycpu "/out:$monitorOut" $monitorSrc1 $monitorSrc2
}
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar MPMMonitor.exe" }

# 2. Compilar Uninstall.exe
Write-Host "  [2/3] Compilando Uninstall.exe..." -ForegroundColor Yellow
$uninstSrc1 = Join-Path $PSScriptRoot 'src\Uninstaller\Program.cs'
$uninstSrc2 = Join-Path $PSScriptRoot 'src\Uninstaller\AssemblyInfo.cs'
$uninstOut = Join-Path $binDir 'Uninstall.exe'
if ($iconArg -ne "") {
    & $csc /target:winexe /optimize+ /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll $iconArg "/out:$uninstOut" $uninstSrc1 $uninstSrc2
} else {
    & $csc /target:winexe /optimize+ /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$uninstOut" $uninstSrc1 $uninstSrc2
}
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar Uninstall.exe" }

# 3. Compilar MPM-Player-Setup.exe com recursos embutidos
Write-Host "  [3/3] Compilando MPM-Player-Setup.exe (Wizard WinForms com binários embutidos)..." -ForegroundColor Yellow
$setupSrc1 = Join-Path $PSScriptRoot 'src\Setup\Program.cs'
$setupSrc2 = Join-Path $PSScriptRoot 'src\Setup\AssemblyInfo.cs'
$setupOut = Join-Path $binDir 'MPM-Player-Setup.exe'
$resMonitor = "/resource:$monitorOut,MPMMonitor.exe"
$resUninst = "/resource:$uninstOut,Uninstall.exe"
if ($iconArg -ne "") {
    & $csc /target:winexe /optimize+ /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll $resMonitor $resUninst $iconArg "/out:$setupOut" $setupSrc1 $setupSrc2
} else {
    & $csc /target:winexe /optimize+ /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll $resMonitor $resUninst "/out:$setupOut" $setupSrc1 $setupSrc2
}
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar MPM-Player-Setup.exe" }

# 4. Copiar para public/downloads/MPM-Player-Setup.exe
$publicDownloads = Join-Path (Get-Item $PSScriptRoot).Parent.FullName 'public\downloads'
New-Item -ItemType Directory -Force -Path $publicDownloads | Out-Null
$destExe = Join-Path $publicDownloads 'MPM-Player-Setup.exe'
Copy-Item -LiteralPath $setupOut -Destination $destExe -Force

$hash = (Get-FileHash -LiteralPath $destExe -Algorithm SHA256).Hash
$size = (Get-Item -LiteralPath $destExe).Length

Write-Host "==> Compilação concluída com sucesso!" -ForegroundColor Green
Write-Host "  Arquivo gerado: $destExe"
Write-Host "  Tamanho: $size bytes ($([Math]::Round($size / 1KB, 2)) KB)"
Write-Host "  SHA-256: $hash"
