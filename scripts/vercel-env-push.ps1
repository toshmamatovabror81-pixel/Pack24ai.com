# Pack24.uz — Vercel Production Environment Variables Push

$envFile = "c:\pack24-web\.env"

Write-Host ">> .env fayldan o'zgaruvchilarni o'qilyapti..." -ForegroundColor Cyan

# Production URL'lar (localhost emas, pack24.uz)
$overrides = @{
    "NEXTAUTH_URL"           = "https://pack24.uz"
    "NEXT_PUBLIC_APP_URL"    = "https://pack24.uz"
    "ALLOWED_ORIGINS"        = "https://pack24.uz,https://www.pack24.uz"
    "TELEGRAM_DEV_AUTO_POLL" = "false"
}

# .env faylni o'qish
$lines = Get-Content $envFile

$count = 0
foreach ($line in $lines) {
    # Bo'sh qatorlar va izohlarni o'tkazib yuborish
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
    
    # KEY=VALUE formatini ajratish
    if ($line -match '^([A-Z_][A-Z0-9_]*)=(.*)$') {
        $key   = $matches[1]
        $value = $matches[2].Trim('"')
        
        # Override qilingan qiymatlar
        if ($overrides.ContainsKey($key)) {
            $value = $overrides[$key]
            Write-Host "  [OVERRIDE] $key = $value" -ForegroundColor Yellow
        } else {
            Write-Host "  Qo'shilyapti: $key" -ForegroundColor Green
        }
        
        # Vercel'ga qo'shish
        $value | vercel env add $key production --force 2>&1 | Out-Null
        
        $count++
    }
}

Write-Host ""
Write-Host ">> $count ta o'zgaruvchi Vercel Production'ga yuklandi!" -ForegroundColor Green
