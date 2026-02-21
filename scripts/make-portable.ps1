$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$distFolder = Join-Path $projectRoot 'dist'
$portableFolder = Join-Path $projectRoot 'portable'

if (Test-Path $portableFolder) {
    Remove-Item $portableFolder -Recurse -Force
}

New-Item -ItemType Directory -Path $portableFolder | Out-Null
Copy-Item $distFolder -Destination (Join-Path $portableFolder 'dist') -Recurse

$runFile = Join-Path $portableFolder 'run-portable.ps1'
@"
Write-Host 'Starting GOD portable server on http://localhost:4173' -ForegroundColor Cyan
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js (with npx) is required on this machine.'
  exit 1
}
Set-Location -Path `$PSScriptRoot
npx --yes serve .\\dist -l 4173
"@ | Set-Content -Path $runFile -Encoding UTF8

Write-Host "Portable package created at: $portableFolder" -ForegroundColor Green
