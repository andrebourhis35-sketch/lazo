param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$configuration = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$runner = Join-Path $configuration.privateDirectory 'backup-windows.ps1'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw 'Falta el descargador local.' }
foreach ($path in @($ConfigPath,$runner)) {
    if ($path.Contains('"') -or $path.Contains("`n")) { throw 'Ruta de tarea no válida.' }
}
$userName = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $runner + '" -ConfigPath "' + $ConfigPath + '"')
$triggers = @((New-ScheduledTaskTrigger -Daily -At '09:00'), (New-ScheduledTaskTrigger -AtLogOn -User $userName))
$principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'LAZO - Copia cifrada OVH' -Action $action -Trigger $triggers `
  -Principal $principal -Settings $settings -Description 'Descarga privada de LAZO, cifrada con age y comprobada por SHA-256. No guarda la contraseña de Windows.' -Force | Out-Null
Write-Output 'LAZO: tarea diaria y al iniciar sesión preparada, con este usuario y sin guardar contraseña.'
