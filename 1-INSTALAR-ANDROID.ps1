$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== RESTX - PREPARACAO ANDROID ===" -ForegroundColor Green
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js nao foi encontrado. Instale o Node.js e execute novamente."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm nao foi encontrado. Instale o Node.js e execute novamente."
}

Write-Host "[1/5] Instalando dependencias..." -ForegroundColor Cyan
npm install

Write-Host "[2/5] Gerando a versao web..." -ForegroundColor Cyan
npm run build

if (-not (Test-Path ".\android")) {
    Write-Host "[3/5] Criando projeto Android Capacitor..." -ForegroundColor Cyan
    npx cap add android
} else {
    Write-Host "[3/5] Projeto Android ja existe; mantendo." -ForegroundColor Yellow
}

Write-Host "[4/5] Preparando notificacao e som nativos..." -ForegroundColor Cyan
npm run setup:native

Write-Host "[5/5] Sincronizando Capacitor..." -ForegroundColor Cyan
npx cap sync android

Write-Host ""
Write-Host "=== CONCLUIDO ===" -ForegroundColor Green
Write-Host ""
Write-Host "Agora abra o Android Studio com:"
Write-Host "    npx cap open android"
Write-Host ""
Write-Host "No Android Studio, conecte o celular por USB (Depuracao USB ativa)"
Write-Host "ou use um emulador e pressione Run."
Write-Host ""
Read-Host "Pressione ENTER para fechar"
