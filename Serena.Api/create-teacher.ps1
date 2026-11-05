$ErrorActionPreference = 'Stop'

$email = (Read-Host 'Correo docente (@gmail.com)').Trim().ToLowerInvariant()
if ($email -notmatch '^[^\s@]+@gmail\.com$') {
    throw 'El correo debe terminar en @gmail.com, como valida el formulario.'
}

$securePassword = Read-Host 'Contraseña (mínimo 12 caracteres)' -AsSecureString
$pointer = [IntPtr]::Zero
$plainPassword = $null
$randomGenerator = $null
$pbkdf2 = $null
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($plainPassword.Length -lt 12) { throw 'La contraseña debe tener al menos 12 caracteres.' }

    $iterations = 600000
    $salt = [byte[]]::new(16)
    $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($salt)
    $pbkdf2 = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
        $plainPassword,
        $salt,
        $iterations,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256
    )
    $hash = $pbkdf2.GetBytes(32)

    $dataDirectory = Join-Path $PSScriptRoot 'Data'
    $usersPath = Join-Path $dataDirectory 'teachers.json'
    [System.IO.Directory]::CreateDirectory($dataDirectory) | Out-Null
    $users = [System.Collections.Generic.List[object]]::new()
    if (Test-Path -LiteralPath $usersPath) {
        $store = Get-Content -LiteralPath $usersPath -Raw | ConvertFrom-Json
        foreach ($existing in @($store.users)) { if ($existing) { $users.Add($existing) } }
    }

    $record = [ordered]@{
        email = $email
        salt = [Convert]::ToBase64String($salt)
        passwordHash = [Convert]::ToBase64String($hash)
        iterations = $iterations
    }
    $existingIndex = -1
    for ($index = 0; $index -lt $users.Count; $index++) {
        if ($users[$index].email -ieq $email) { $existingIndex = $index; break }
    }
    if ($existingIndex -ge 0) { $users[$existingIndex] = [pscustomobject]$record }
    else { $users.Add([pscustomobject]$record) }

    $json = [ordered]@{ users = @($users.ToArray()) } | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($usersPath, $json, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Cuenta lista para $email; el JSON contiene el hash, no la contraseña."
}
finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($plainPassword) { $plainPassword = $null }
    if ($pbkdf2) { $pbkdf2.Dispose() }
    if ($randomGenerator) { $randomGenerator.Dispose() }
    if ($securePassword) { $securePassword.Dispose() }
}
