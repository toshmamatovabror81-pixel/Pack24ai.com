$urls = @(
    'https://pack24.uz',
    'https://pack24.uz/api/telegram/health',
    'https://www.pack24.uz'
)
foreach ($url in $urls) {
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 5
        Write-Host "[OK] $url => $($r.StatusCode)" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code) {
            Write-Host "[$code] $url" -ForegroundColor Yellow
        } else {
            Write-Host "[ERR] $url : $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}
