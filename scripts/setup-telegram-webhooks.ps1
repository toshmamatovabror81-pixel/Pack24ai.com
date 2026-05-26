# Register production Telegram webhooks via /api/telegram/setup
param(
    [string]$BaseUrl = $env:NEXT_PUBLIC_APP_URL,
    [string]$OpsSecret = $env:TELEGRAM_OPS_SECRET
)

if (-not $BaseUrl) {
    Write-Host "BaseUrl kerak. Masalan: `$env:NEXT_PUBLIC_APP_URL='https://pack24.uz'" -ForegroundColor Red
    exit 1
}
if (-not $OpsSecret) {
    Write-Host "TELEGRAM_OPS_SECRET kerak." -ForegroundColor Red
    exit 1
}

$body = @{ mode = 'webhook'; baseUrl = $BaseUrl.TrimEnd('/') } | ConvertTo-Json
$headers = @{
    'Content-Type' = 'application/json'
    'x-telegram-ops-secret' = $OpsSecret
}

Write-Host "Webhook o'rnatilmoqda: $BaseUrl" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/api/telegram/setup" `
        -Method POST -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 5
    if ($response.ok) {
        Write-Host "OK: Webhooklar o'rnatildi." -ForegroundColor Green
        exit 0
    }
    Write-Host "Xato: webhook o'rnatilmadi." -ForegroundColor Red
    exit 1
} catch {
    Write-Host "So'rov xatosi: $_" -ForegroundColor Red
    exit 1
}
