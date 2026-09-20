$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Atualizando RestX Android..." -ForegroundColor Green
npm run build
npm run setup:native
npx cap sync android
npx cap open android
