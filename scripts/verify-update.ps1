param([Parameter(Mandatory=$true)][string]$Artifact,[Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSha256,[Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$TrustedPublisherThumbprint)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$taskArtifact=(Resolve-Path -LiteralPath $Artifact).ProviderPath
if([IO.Path]::GetExtension($taskArtifact) -ne '.exe'){throw 'Expected an EXE release artifact.'}
$taskAlgorithm=[Security.Cryptography.SHA256]::Create();$taskStream=[IO.File]::OpenRead($taskArtifact)
try{$taskDigest=([BitConverter]::ToString($taskAlgorithm.ComputeHash($taskStream))).Replace('-','')}finally{$taskStream.Dispose();$taskAlgorithm.Dispose()}
if($taskDigest -ne $ExpectedSha256){throw 'Release checksum mismatch; do not run this file.'}
$taskSignature=Get-AuthenticodeSignature -LiteralPath $taskArtifact
if($taskSignature.Status -ne 'Valid' -or $null -eq $taskSignature.SignerCertificate -or $taskSignature.SignerCertificate.Thumbprint -ne $TrustedPublisherThumbprint){throw 'A valid signature from the trusted publisher is required. Unsigned experimental builds cannot use verified updates.'}
Write-Output 'PASS SHA-256 and pinned publisher signature. No file was installed or executed.'
