param([Parameter(Mandatory=$true)][string]$Zip,[Parameter(Mandatory=$true)][string]$Manifest)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$description=Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$archive=[IO.Compression.ZipFile]::OpenRead($Zip)
$sha=[Security.Cryptography.SHA256]::Create()
try {
 $count=0
 foreach($property in $description.files.PSObject.Properties) {
  $entry=$archive.GetEntry($property.Name)
  if($null -eq $entry){throw ('Missing source archive entry: '+$property.Name)}
  $stream=$entry.Open()
  try {$digest=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()} finally {$stream.Dispose()}
  if($digest -ne $property.Value){throw ('Source archive digest mismatch: '+$property.Name)}
  $count++
 }
 $entries=@($archive.Entries | Where-Object {-not $_.FullName.EndsWith('/')})
 if($entries.Count -ne ($count+1)){throw 'Unexpected or duplicate files in source archive'}
 $entry=$archive.GetEntry('release-manifest.json');if($null -eq $entry){throw 'Missing embedded release manifest'}
 $stream=$entry.Open();try{$embedded=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','')}finally{$stream.Dispose()}
 $file=[IO.File]::OpenRead($Manifest);try{$external=([BitConverter]::ToString($sha.ComputeHash($file))).Replace('-','')}finally{$file.Dispose()}
 if($embedded -ne $external){throw 'Embedded release manifest differs from external manifest'}
 Write-Output ('PASS source archive: '+$count+' file digests and embedded manifest')
} finally {$sha.Dispose();$archive.Dispose()}
