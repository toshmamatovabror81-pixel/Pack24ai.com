<# : Pack24 - nace.ai API kalitini kompyuterga saqlash (ikki marta bosib ishga tushiring)
@echo off
chcp 65001 >nul
title Pack24 - nace.ai kalit
set "PACK24_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ([IO.File]::ReadAllText($env:PACK24_SELF, [Text.Encoding]::UTF8))"
if errorlevel 2 (
  echo.
  echo Xatolik yuz berdi. Oynani yopish uchun istalgan tugmani bosing.
  pause >nul
)
exit /b %errorlevel%
#>
# ---- PowerShell qismi ----
$ErrorActionPreference = 'Stop'
trap { try { [System.Windows.Forms.MessageBox]::Show("Kutilmagan xato: $($_.Exception.Message)", 'Pack24 - nace.ai kalit') | Out-Null } catch {}; exit 2 }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Show-Msg([string]$text, [string]$title = 'Pack24 - nace.ai kalit', $icon = 'Information') {
  [void][System.Windows.Forms.MessageBox]::Show($text, $title, 'OK', $icon)
}

# Kalitni yashirin maydonda so'raymiz (ekranda yulduzcha ko'rinadi)
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Pack24 - nace.ai API kalit'
$form.Size = New-Object System.Drawing.Size(560, 220)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$label = New-Object System.Windows.Forms.Label
$label.Text = "console.nace.ai -> API Keys -> Create key orqali olingan kalitni shu yerga qo'ying (nace_sk_ bilan boshlanadi).`nKalit faqat shu kompyuterda saqlanadi, chatga yuborilmaydi."
$label.AutoSize = $false
$label.Size = New-Object System.Drawing.Size(520, 60)
$label.Location = New-Object System.Drawing.Point(12, 12)
$box = New-Object System.Windows.Forms.TextBox
$box.Size = New-Object System.Drawing.Size(520, 24)
$box.Location = New-Object System.Drawing.Point(12, 80)
$box.UseSystemPasswordChar = $true
$ok = New-Object System.Windows.Forms.Button
$ok.Text = 'Saqlash'
$ok.Location = New-Object System.Drawing.Point(330, 125)
$ok.DialogResult = 'OK'
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Bekor qilish'
$cancel.Location = New-Object System.Drawing.Point(432, 125)
$cancel.DialogResult = 'Cancel'
$form.Controls.AddRange(@($label, $box, $ok, $cancel))
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$form.Add_Shown({ $box.Focus() })
if ($form.ShowDialog() -ne 'OK') { exit 1 }
$key = $box.Text.Trim()

if ($key -notmatch '^nace_sk_[A-Za-z0-9_\-]{8,}$') {
  Show-Msg "Kalit noto'g'ri ko'rinishda. U nace_sk_ bilan boshlanishi kerak. Qaytadan ishga tushiring." 'Xato' 'Error'
  exit 1
}

# 1) ~/.nace/config.toml (nace CLI, nace-mcp va saralash.mjs shu faylni o'qiydi)
$dir = Join-Path $env:USERPROFILE '.nace'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$cfg = Join-Path $dir 'config.toml'
$content = "api_key = `"$key`"`r`n"
[IO.File]::WriteAllText($cfg, $content, (New-Object Text.UTF8Encoding $false))
try {
  # faqat shu foydalanuvchi o'qiy oladigan qilib qo'yamiz
  $acl = Get-Acl $cfg
  $acl.SetAccessRuleProtection($true, $false)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("$env:USERDOMAIN\$env:USERNAME", 'FullControl', 'Allow')
  $acl.SetAccessRule($rule)
  Set-Acl $cfg $acl
} catch {}

# 2) Foydalanuvchi muhit o'zgaruvchisi (yangi ochilgan dasturlar uchun)
try { [Environment]::SetEnvironmentVariable('NACE_API_KEY', $key, 'User') } catch {}

# 3) Kalitni tekshirish (arzon, pulsiz so'rov: ishlar ro'yxati)
$status = 'tekshirilmadi'
try {
  $resp = Invoke-WebRequest -Uri 'https://console.nace.ai/v1/documents/jobs?limit=1' -Headers @{ Authorization = "Bearer $key" } -UseBasicParsing -TimeoutSec 30
  if ($resp.StatusCode -eq 200) { $status = 'ishlayapti' }
} catch {
  $code = $null
  try { $code = [int]$_.Exception.Response.StatusCode } catch {}
  if ($code -eq 401 -or $code -eq 403) { $status = 'notogri' } else { $status = 'tekshirilmadi' }
}

switch ($status) {
  'ishlayapti' { Show-Msg "Kalit saqlandi va ishlayapti.`n`nSaqlangan joyi: $cfg`n`nEndi Claude'ga shu gapni yozing:`nDrex bu nace.ai; kalit kompyuterda saqlandi; nace orqali saralashni boshla" }
  'notogri'    { Show-Msg "Kalit saqlandi, lekin nace.ai uni qabul qilmadi (401). console.nace.ai -> API Keys da yangi kalit yarating va dasturni qayta ishga tushiring." 'Xato' 'Warning' }
  default      { Show-Msg "Kalit saqlandi: $cfg`nInternet orqali tekshirib bo'lmadi, lekin saqlangan kalit ishlatiladi.`n`nEndi Claude'ga shu gapni yozing:`nDrex bu nace.ai; kalit kompyuterda saqlandi; nace orqali saralashni boshla" }
}
exit 0
