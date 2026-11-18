param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$copyDirectory = [IO.Path]::GetFullPath($config.destination)
if (-not (Test-Path -LiteralPath $copyDirectory -PathType Container)) { throw 'No existe la carpeta privada de copias.' }
$taskLock = $null
$partialPath = $null
try {
    $taskLock = [IO.File]::Open((Join-Path $copyDirectory '.download.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $sshOptions = @('-o','BatchMode=yes','-o','ConnectTimeout=15','-o','StrictHostKeyChecking=yes',
      '-o',('UserKnownHostsFile=' + $config.knownHosts),'-i',$config.sshKey)
    $metadataText = & $config.ssh @sshOptions $config.server 'sudo -n /usr/local/sbin/lazo-crm-export'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar la copia en OVH.' }
    $metadata = ($metadataText -join "`n") | ConvertFrom-Json
    if ($metadata.file -notmatch '^lazo-\d{8}T\d{6}Z\.tar\.gz\.age$' -or
        $metadata.sha256 -notmatch '^[0-9a-f]{64}$' -or $metadata.bytes -le 0 -or $metadata.bytes -gt 2147483648) {
        throw 'Los datos de la copia no son válidos.'
    }
    $finalPath = Join-Path $copyDirectory $metadata.file
    $partialPath = $finalPath + '.part'
    if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($partialPath)) -ne $copyDirectory) { throw 'Ruta de copia no válida.' }
    & $config.scp @sshOptions ($config.server + ':/var/backups/lazo-crm-export/' + $metadata.file) $partialPath
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar la copia cifrada.' }
    if ((Get-Item -LiteralPath $partialPath).Length -ne $metadata.bytes -or
        (Get-FileHash -LiteralPath $partialPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $metadata.sha256) {
        throw 'La copia descargada no coincide por tamaño o SHA-256.'
    }
    Move-Item -LiteralPath $partialPath -Destination $finalPath
    $partialPath = $null
    # Rotation is restricted to regular encrypted exports in the configured directory.
    $cutoff = [DateTime]::UtcNow.AddDays(-7)
    Get-ChildItem -LiteralPath $copyDirectory -File | Where-Object {
      $_.Name -match '^lazo-\d{8}T\d{6}Z\.tar\.gz\.age$' -and
      -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $_.LastWriteTimeUtc -lt $cutoff
    } | ForEach-Object {
      if ([IO.Path]::GetDirectoryName($_.FullName) -ne $copyDirectory) { throw 'Rotación fuera de alcance.' }
      Remove-Item -LiteralPath $_.FullName
    }
    [ordered]@{ok=$true;checkedUtc=[DateTime]::UtcNow.ToString('o');file=$metadata.file;
      bytes=$metadata.bytes;sha256=$metadata.sha256} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $copyDirectory 'estado.json') -Encoding UTF8
    Write-Output 'LAZO: copia cifrada descargada y comprobada por SHA-256.'
} catch {
    [ordered]@{ok=$false;checkedUtc=[DateTime]::UtcNow.ToString('o');error='No se completó la copia. Revisa conexión y tarea.'} |
      ConvertTo-Json | Set-Content -LiteralPath (Join-Path $copyDirectory 'estado.json') -Encoding UTF8
    throw
} finally {
    if ($partialPath -and (Test-Path -LiteralPath $partialPath)) { Remove-Item -LiteralPath $partialPath }
    if ($taskLock) { $taskLock.Dispose() }
}
