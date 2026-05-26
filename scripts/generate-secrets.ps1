# Generates new secret values for token rotation.
# Output: .env.rotation-draft (gitignored) — copy to Vercel, do NOT commit.

$ErrorActionPreference = 'Stop'
$out = Join-Path (Join-Path $PSScriptRoot '..') '.env.rotation-draft'

function New-RandomBase64([int]$bytes = 32) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

function New-RandomHex([int]$bytes = 32) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ([BitConverter]::ToString($buf) -replace '-', '').ToLower()
}

$authSecret = New-RandomBase64 32
$adminSecret = New-RandomBase64 32
$driverSecret = New-RandomBase64 32
$webhookSecret = New-RandomHex 32
$opsSecret = New-RandomHex 32

$content = @"
# Pack24 token rotation draft — $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# Copy values to Vercel Environment Variables. DO NOT COMMIT THIS FILE.

AUTH_SECRET=$authSecret
NEXTAUTH_SECRET=$authSecret
ADMIN_SECRET=$adminSecret
DRIVER_TOKEN_SECRET=$driverSecret
TELEGRAM_WEBHOOK_SECRET=$webhookSecret
TELEGRAM_OPS_SECRET=$opsSecret

# Manual rotation required (see docs/launch/security-rotation-checklist.md):
# CUSTOMER_BOT_TOKEN, DRIVER_BOT_TOKEN, ADMIN_BOT_TOKEN, PACK24ADMIN_BOT_TOKEN
# CLICK_SECRET_KEY, PAYME_SECRET_KEY, PAYME_TEST_SECRET
# ADMIN_PASSWORD, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, VAPID keys
"@

Set-Content -Path $out -Value $content -Encoding UTF8
Write-Host "Generated: $out" -ForegroundColor Green
Write-Host "Copy values to Vercel. File is gitignored." -ForegroundColor Yellow
