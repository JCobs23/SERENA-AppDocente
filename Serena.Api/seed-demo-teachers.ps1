$ErrorActionPreference = 'Stop'

$iterations = 600000
$password = '123456789abc'
$dataDirectory = Join-Path $PSScriptRoot 'Data'
$usersPath = Join-Path $dataDirectory 'teachers.json'
[System.IO.Directory]::CreateDirectory($dataDirectory) | Out-Null

$users = [System.Collections.Generic.List[object]]::new()
if (Test-Path -LiteralPath $usersPath) {
    $store = Get-Content -LiteralPath $usersPath -Raw | ConvertFrom-Json
    foreach ($existing in @($store.users)) {
        if ($existing) { $users.Add($existing) }
    }
}

$randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    for ($number = 0; $number -le 10; $number++) {
        $email = if ($number -eq 0) { "javierlainv@gmail.com" } else { "profesor$number@gmail.com" }
        $salt = [byte[]]::new(16)
        $randomGenerator.GetBytes($salt)
        $pbkdf2 = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
            $password,
            $salt,
            $iterations,
            [System.Security.Cryptography.HashAlgorithmName]::SHA256
        )
        try {
            $hash = $pbkdf2.GetBytes(32)
        } finally {
            $pbkdf2.Dispose()
        }

        $record = [pscustomobject]@{
            email = $email
            salt = [Convert]::ToBase64String($salt)
            passwordHash = [Convert]::ToBase64String($hash)
            iterations = $iterations
        }

        $existingIndex = -1
        for ($index = 0; $index -lt $users.Count; $index++) {
            if ($users[$index].email -ieq $email) { $existingIndex = $index; break }
        }
        if ($existingIndex -ge 0) { $users[$existingIndex] = $record }
        else { $users.Add($record) }
    }
} finally {
    $randomGenerator.Dispose()
}

$json = [ordered]@{ users = @($users.ToArray()) } | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($usersPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Cuentas de demostración preparadas (contraseñas guardadas únicamente como hashes).'
