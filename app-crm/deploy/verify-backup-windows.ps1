param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$privateRoot = [IO.Path]::GetFullPath($config.privateDirectory)
$work = Join-Path $privateRoot ('recovery-check-' + [Guid]::NewGuid().ToString('N'))
if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($work)) -ne $privateRoot) { throw 'Ruta de verificación no válida.' }
New-Item -ItemType Directory -Path $work | Out-Null
$identityBytes = $null
$process = $null
try {
    $state = Get-Content -LiteralPath (Join-Path $config.destination 'estado.json') -Raw | ConvertFrom-Json
    if (-not $state.ok -or $state.file -notmatch '^lazo-\d{8}T\d{6}Z\.tar\.gz\.age$') { throw 'No hay una copia comprobada.' }
    $encrypted = Join-Path $config.destination $state.file
    if ((Get-FileHash -LiteralPath $encrypted -Algorithm SHA256).Hash.ToLowerInvariant() -ne $state.sha256) { throw 'La copia cambió desde su descarga.' }
    Add-Type -AssemblyName System.Security
    $identityBytes = [Security.Cryptography.ProtectedData]::Unprotect(
      [IO.File]::ReadAllBytes($config.identity),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $archive = Join-Path $work 'snapshot.tar.gz'
    foreach ($safePath in @($archive,$encrypted)) {
      if ($safePath.Contains('"') -or $safePath.Contains("`n")) { throw 'Ruta de archivo no válida.' }
    }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $config.age
    $start.Arguments = '-d -i - -o "' + $archive + '" "' + $encrypted + '"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($start)
    $process.StandardInput.WriteLine([Text.Encoding]::UTF8.GetString($identityBytes))
    $process.StandardInput.Close()
    if (-not $process.WaitForExit(180000)) { $process.Kill(); throw 'La verificación de cifrado superó su tiempo límite.' }
    if ($process.ExitCode -ne 0) { throw 'La copia cifrada no pudo abrirse con la clave protegida.' }
    $recovery = Join-Path $work 'restored'
    $result = & $config.python $config.recoveryChecker $archive $recovery
    if ($LASTEXITCODE -ne 0) { throw 'La copia no superó la verificación de integridad.' }
    $keyResult = & $config.node $config.secretsChecker $recovery
    if ($LASTEXITCODE -ne 0) { throw 'La clave maestra no puede recuperar las conexiones o los adjuntos.' }
    [ordered]@{ok=$true;checkedUtc=[DateTime]::UtcNow.ToString('o');file=$state.file;
      integrity=(($result -join "`n") | ConvertFrom-Json);secrets=(($keyResult -join "`n") | ConvertFrom-Json)} |
      ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $config.destination 'verificacion.json') -Encoding UTF8
    Write-Output 'LAZO: recuperación aislada correcta; base íntegra y clave maestra comprobada.'
} finally {
    if ($identityBytes) { [Array]::Clear($identityBytes,0,$identityBytes.Length) }
    if ($process) { if (-not $process.HasExited) { $process.Kill() }; $process.Dispose() }
    if ((Test-Path -LiteralPath $work) -and
        [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($work)) -eq $privateRoot -and
        [IO.Path]::GetFileName($work) -match '^recovery-check-[0-9a-f]{32}$') {
      Remove-Item -LiteralPath $work -Recurse -Force
    }
}
