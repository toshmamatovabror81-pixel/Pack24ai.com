# Telegram webhook'larni o'rnatish.
# XAVFSIZLIK: tokenlar env o'zgaruvchilardan o'qiladi — bu faylga HECH QACHON token yozmang!
#
# Ishlatish (PowerShell):
#   $env:CUSTOMER_BOT_TOKEN    = '...'
#   $env:DRIVER_BOT_TOKEN      = '...'
#   $env:ADMIN_BOT_TOKEN       = '...'
#   $env:PACK24ADMIN_BOT_TOKEN = '...'
#   $env:TELEGRAM_WEBHOOK_SECRET = '...'
#   .\scripts\set-webhooks.ps1

$bots = @(
    @{ name='Customer bot'; token=$env:CUSTOMER_BOT_TOKEN;    path='customer' },
    @{ name='Driver bot';   token=$env:DRIVER_BOT_TOKEN;      path='driver' },
    @{ name='Admin bot';    token=$env:ADMIN_BOT_TOKEN;       path='admin' },
    @{ name='Pack24Admin';  token=$env:PACK24ADMIN_BOT_TOKEN; path='pack24admin' }
)

$secret  = $env:TELEGRAM_WEBHOOK_SECRET
$baseUrl = if ($env:WEBHOOK_BASE_URL) { $env:WEBHOOK_BASE_URL } else { 'https://pack24.uz' }

if (-not $secret) {
    Write-Host "[XATO] TELEGRAM_WEBHOOK_SECRET env o'zgaruvchisi o'rnatilmagan." -ForegroundColor Red
    exit 1
}

Write-Host ">> Telegram webhook'larni o'rnatish..." -ForegroundColor Cyan
Write-Host ""

foreach ($bot in $bots) {
    if (-not $bot.token) {
        Write-Host "  [SKIP] $($bot.name): token env o'zgaruvchisi yo'q" -ForegroundColor Yellow
        continue
    }

    $webhookUrl = "$baseUrl/api/telegram/webhook/$($bot.path)"
    $apiUrl     = "https://api.telegram.org/bot$($bot.token)/setWebhook"

    $body = @{
        url                  = $webhookUrl
        secret_token         = $secret
        drop_pending_updates = $true
    } | ConvertTo-Json

    try {
        $resp = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -ContentType 'application/json'
        if ($resp.ok) {
            Write-Host "  [OK] $($bot.name)" -ForegroundColor Green
            Write-Host "       => $webhookUrl" -ForegroundColor DarkGreen
        } else {
            Write-Host "  [XATO] $($bot.name): $($resp.description)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  [XATO] $($bot.name): $_" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host ">> Webhook tekshirish (getWebhookInfo)..." -ForegroundColor Cyan
foreach ($bot in $bots) {
    if (-not $bot.token) { continue }
    $infoUrl = "https://api.telegram.org/bot$($bot.token)/getWebhookInfo"
    $info    = Invoke-RestMethod -Uri $infoUrl
    Write-Host "  $($bot.name): $($info.result.url) | pending: $($info.result.pending_update_count)" -ForegroundColor Gray
}

Write-Host ""
Write-Host ">> TAYYOR!" -ForegroundColor Green
