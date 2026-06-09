$bots = @(
    @{ name='Customer bot'; token='8767673956:AAF8Szu3wBHULqd5diIkJavKVhlH2ya5YVo'; path='customer' },
    @{ name='Driver bot';   token='8369124151:AAF95S1I45m91jhI-Jbg78-9QTWjozS5voY'; path='driver' },
    @{ name='Admin bot';    token='8506404614:AAFbpBJ-maEFrWeBjGMsqmSioZA11dYb1aw'; path='admin' },
    @{ name='Pack24Admin';  token='8649747946:AAEhnc7yjNEBaC_i-OTtRRZe89qkZq_5O5U'; path='pack24admin' }
)

$secret  = 'pack24-telegram-webhook-2026-secret'
$baseUrl = 'https://pack24.uz'

Write-Host ">> Telegram webhook'larni o'rnatish..." -ForegroundColor Cyan
Write-Host ""

foreach ($bot in $bots) {
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
    $infoUrl = "https://api.telegram.org/bot$($bot.token)/getWebhookInfo"
    $info    = Invoke-RestMethod -Uri $infoUrl
    Write-Host "  $($bot.name): $($info.result.url) | pending: $($info.result.pending_update_count)" -ForegroundColor Gray
}

Write-Host ""
Write-Host ">> TAYYOR! Barcha bot webhook'lari pack24.uz ga ulandi." -ForegroundColor Green
