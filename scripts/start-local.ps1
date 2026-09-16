$ErrorActionPreference = 'Stop'
$nativosRoot = Split-Path -Parent $PSScriptRoot
$nativosNode = (Get-Command node.exe).Source
New-Item -ItemType Directory -Path (Join-Path $nativosRoot '.local') -Force | Out-Null
foreach ($nativosService in @(@{ Port=4310; Script='scripts/dev.ts'; Name='central' })) {
  $nativosListener = Get-NetTCPConnection -State Listen -LocalPort $nativosService.Port -ErrorAction SilentlyContinue
  if (-not $nativosListener) {
    Start-Process -FilePath $nativosNode -ArgumentList $nativosService.Script -WorkingDirectory $nativosRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $nativosRoot ".local/$($nativosService.Name).stdout.log") -RedirectStandardError (Join-Path $nativosRoot ".local/$($nativosService.Name).stderr.log") | Out-Null
  }
  $nativosReady = $false
  for ($nativosAttempt = 0; $nativosAttempt -lt 30; $nativosAttempt++) {
    try {
      $nativosPath = if ($nativosService.Port -eq 4310) { '/api/status' } else { '/api/pos-local/status' }
      $nativosResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$($nativosService.Port)$nativosPath" -TimeoutSec 2
      if ($nativosResponse.StatusCode -eq 200) { $nativosReady = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $nativosReady) { throw "No arranco $($nativosService.Name). Revisa .local/$($nativosService.Name).stderr.log; conserva los datos locales." }
}
Write-Output 'Sitio Nativos: http://127.0.0.1:4310 | Caja: http://127.0.0.1:4310/caja'
