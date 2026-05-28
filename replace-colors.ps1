Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName)
    if ($content -match '#064E3B') {
        $newContent = $content -replace '\[#064E3B\]', 'brand-green'
        [System.IO.File]::WriteAllText($_.FullName, $newContent)
        Write-Host ("Updated: " + $_.FullName)
    }
}
