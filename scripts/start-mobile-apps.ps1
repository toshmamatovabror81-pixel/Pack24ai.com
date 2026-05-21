# Pack24AI (customer) + Pack24 Driver — Expo ishga tushirish
# Talab: pack24-web dev server http://localhost:3000 da ishlashi kerak

$LanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress
if (-not $LanIp) { $LanIp = '192.168.0.113' }

Write-Host ""
Write-Host "=== Pack24 mobil ilovalar ===" -ForegroundColor Cyan
Write-Host "Backend API: http://${LanIp}:3000  (va http://localhost:3000)"
Write-Host ""

# Web backend tekshiruvi
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "pack24-web: OK ($($r.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "pack24-web ishlamayapti! Avval: cd c:\pack24-web && npm run dev" -ForegroundColor Red
}

# Driver: expo-secure-store
if (-not (Test-Path "C:\pack24-driver\node_modules\expo-secure-store")) {
    Write-Host "pack24-driver: expo-secure-store o'rnatilmoqda..." -ForegroundColor Yellow
    Push-Location C:\pack24-driver
    npx expo install expo-secure-store 2>&1 | Out-Null
    Pop-Location
}

Write-Host ""
Write-Host "Pack24AI (customer) — port 8081" -ForegroundColor Green
Write-Host "  Papka: C:\pack24-mobile\apps\customer"
Write-Host "  Terminal 1: cd C:\pack24-mobile\apps\customer && npx expo start --port 8081"
Write-Host ""
Write-Host "Pack24 Driver — port 8082" -ForegroundColor Green
Write-Host "  Papka: C:\pack24-driver"
Write-Host "  Terminal 2: cd C:\pack24-driver && npx expo start --port 8082"
Write-Host ""
Write-Host "Telefonda (Expo Go): QR kodni skanerlang. API: http://${LanIp}:3000"
Write-Host "Android emulyator: http://10.0.2.2:3000"
Write-Host ""
