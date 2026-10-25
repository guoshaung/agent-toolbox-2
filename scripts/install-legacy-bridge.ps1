#requires -Version 7.0
$ErrorActionPreference = 'Stop'
$bridgeRepo = Split-Path -Parent $PSScriptRoot
$bridgeInstall = Join-Path $env:LOCALAPPDATA 'Programs\agent-toolbox'
$bridgeExe = Join-Path $bridgeInstall 'Agent 工具箱.exe'
$bridgeTarget = Join-Path $bridgeInstall 'resources\app.asar'
$bridgePrepared = Join-Path $bridgeRepo 'work\legacy-bridge\app.asar'
$bridgeProof = Get-Content -LiteralPath (Join-Path $bridgeRepo 'work\legacy-bridge\proof.json') -Raw | ConvertFrom-Json
$bridgeConfig = Join-Path $env:APPDATA 'agent-toolbox\config.json'
# The source and all dependent services must already be stopped normally.
$bridgeRunning = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $bridgeExe })
if ($bridgeRunning.Count) { throw '旧工具箱仍在运行。请先退出旧版（包括其 DSH 服务），原安装未更改。' }
if ((Get-FileHash -LiteralPath $bridgeTarget -Algorithm SHA256).Hash.ToLowerInvariant() -ne $bridgeProof.sourceSha256) { throw '原安装在准备后已变化，已停止。请重新准备兼容补丁。' }
if ((Get-FileHash -LiteralPath $bridgePrepared -Algorithm SHA256).Hash.ToLowerInvariant() -ne $bridgeProof.outputSha256) { throw '补丁校验失败。' }
$bridgeBefore = (Get-FileHash -LiteralPath $bridgeConfig -Algorithm SHA256).Hash
$bridgeBackup = Join-Path $bridgeRepo ('work\legacy-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $bridgeBackup | Out-Null
Copy-Item -LiteralPath $bridgeTarget -Destination (Join-Path $bridgeBackup 'app.asar')
try {
  Copy-Item -LiteralPath $bridgePrepared -Destination $bridgeTarget -Force
  if ((Get-FileHash -LiteralPath $bridgeTarget -Algorithm SHA256).Hash.ToLowerInvariant() -ne $bridgeProof.outputSha256) { throw '安装文件校验失败。' }
  if ((Get-FileHash -LiteralPath $bridgeConfig -Algorithm SHA256).Hash -ne $bridgeBefore) { throw '原配置在安装期间发生变化。' }
} catch {
  Copy-Item -LiteralPath (Join-Path $bridgeBackup 'app.asar') -Destination $bridgeTarget -Force
  throw
}
$bridgeResult = @{ installed = $true; configUnchanged = $true; backup = $bridgeBackup; at = [DateTime]::UtcNow.ToString('o') }
$bridgeResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $bridgeRepo 'work\legacy-bridge-install-proof.json') -Encoding utf8
$bridgeResult | ConvertTo-Json -Compress
