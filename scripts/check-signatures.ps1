param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$Version,[Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$TrustedPublisherThumbprint,[switch]$HelperOnly)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$taskRoot=(Resolve-Path -LiteralPath $Directory).ProviderPath
$taskFiles=if($HelperOnly){@('resources\TimerPolicy.exe')}else{@(('Parakeet-Studio-'+$Version+'-portable.exe'),('Parakeet-Studio-'+$Version+'-setup.exe'),'win-unpacked\Parakeet Studio.exe','win-unpacked\resources\TimerPolicy.exe')}
foreach($taskName in $taskFiles){
 $taskPath=Join-Path $taskRoot $taskName
 $taskSignature=Get-AuthenticodeSignature -LiteralPath $taskPath
 if($taskSignature.Status -ne 'Valid' -or $null -eq $taskSignature.SignerCertificate -or $taskSignature.SignerCertificate.Thumbprint -ne $TrustedPublisherThumbprint -or $null -eq $taskSignature.TimeStamperCertificate){throw ('Signed release gate requires a valid pinned publisher signature and trusted timestamp: '+$taskName)}
}
Write-Output 'PASS selected release executables have a valid pinned publisher signature and timestamp.'
