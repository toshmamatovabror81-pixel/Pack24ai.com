# Pack24 — barcha sirtlarni dev rejimda ishga tushirish
# Ishlatish: npm run dev:all   yoki   powershell -File scripts/dev-all.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Port = 3000
$BaseUrl = "http://localhost:$Port"
$LanUrl = "http://192.168.0.113:$Port"  # telefon uchun (Wi-Fi bir tarmoq)

Write-Host ""
Write-Host "=== Pack24 dev: barcha sirtlar ===" -ForegroundColor Cyan
Write-Host ""

# Eski node jarayonlarini tozalash (faqat pack24 next dev)
Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    ForEach-Object {
        $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and $p.Path -like "*node*") {
            Write-Host "Port $Port band — PID $($_.OwningProcess) to'xtatilmoqda..." -ForegroundColor Yellow
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
Start-Sleep -Seconds 2

# .next cache muammosi bo'lsa — ixtiyoriy tozalash
if ($env:PACK24_DEV_CLEAN -eq "1") {
    Write-Host ".next tozalanmoqda..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
}

Write-Host "Next.js dev server ishga tushmoqda ($BaseUrl)..." -ForegroundColor Green
$devJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    $env:TELEGRAM_DEV_AUTO_POLL = "true"
    npm run dev 2>&1
} -ArgumentList $Root

function Wait-Server {
    param([int]$MaxSec = 90)
    $deadline = (Get-Date).AddSeconds($MaxSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri "$BaseUrl" -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

if (-not (Wait-Server)) {
    Write-Host "Server $MaxSec s ichida javob bermadi. Log:" -ForegroundColor Red
    Receive-Job $devJob -Keep | Select-Object -Last 30
    exit 1
}

Write-Host "Server tayyor." -ForegroundColor Green
Start-Sleep -Seconds 4

# Telegram botlar (polling)
Write-Host "Telegram botlar polling tekshirilmoqda..." -ForegroundColor Green
try {
    $poll = Invoke-RestMethod -Uri "$BaseUrl/api/telegram/start-polling" -Method GET -TimeoutSec 120
    $poll | ConvertTo-Json -Depth 4
} catch {
    Write-Host "Polling API: $($_.Exception.Message) (instrumentation orqali ham ishga tushishi mumkin)" -ForegroundColor Yellow
}

# Health
Write-Host ""
Write-Host "--- API health ---" -ForegroundColor Cyan
@(
    "$BaseUrl/api/auth/session",
    "$BaseUrl/admin/login"
) | ForEach-Object {
    try {
        $code = (Invoke-WebRequest -Uri $_ -UseBasicParsing -TimeoutSec 15).StatusCode
        Write-Host "  OK $code  $_"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "  $code  $_"
    }
}

Write-Host ""
Write-Host "=== Ochish uchun havolalar ===" -ForegroundColor Cyan
Write-Host "  Sayt (web):        $BaseUrl"
Write-Host "  Admin panel:       $BaseUrl/admin/login"
Write-Host "  Mobil TWA:         $BaseUrl/mobile"
Write-Host "  Admin dashboard:   $BaseUrl/admin/dashboard"
Write-Host ""
Write-Host "=== Telegram botlar (Telegramda oching) ===" -ForegroundColor Cyan
Write-Host "  Mijoz:    @Pack24AI_bot"
Write-Host "  Haydovchi: @pack24MX_bot"
Write-Host "  Masul:    @pack24AUP_bot"
Write-Host ""
Write-Host "=== Native mobil ilovalar (alohida repo) ===" -ForegroundColor Cyan
Write-Host "  API bazasi (kompyuter):  $BaseUrl"
Write-Host "  API bazasi (telefon Wi-Fi): $LanUrl"
Write-Host "  Mijoz OTP:  POST $BaseUrl/api/auth/mobile/verify-otp"
Write-Host "  Haydovchi:  POST $BaseUrl/api/auth/driver/login"
Write-Host ""
Write-Host "Qo'lda sinxron test: docs/manual-sync-test.md"
Write-Host ""
Write-Host "To'xtatish: Stop-Job $($devJob.Id); Remove-Job $($devJob.Id)" -ForegroundColor DarkGray
Write-Host "Yoki dev terminalda Ctrl+C"
Write-Host ""

# Brauzerda ochish
Start-Process "$BaseUrl"
Start-Sleep -Milliseconds 800
Start-Process "$BaseUrl/admin/login"
Start-Sleep -Milliseconds 800
Start-Process "$BaseUrl/mobile"

# Job loglarini ko'rish uchun foreground emas — foydalanuvchi alohida terminalda ham ishlatishi mumkin
Write-Host "Dev server fon rejimida ishlayapti (Job ID: $($devJob.Id))." -ForegroundColor Green
Write-Host "Log ko'rish: Receive-Job -Id $($devJob.Id) -Keep -Wait"
Write-Host ""

# Interaktiv: log stream
Receive-Job $devJob -Wait
