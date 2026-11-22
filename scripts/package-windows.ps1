$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\env.ps1"
Set-Location $projectRoot
# Use verified local tools when available; a fresh checkout uses electron-builder's
# checksum-checked downloads into ELECTRON_BUILDER_CACHE on D:.
if (Test-Path '.cache\tools\7za.exe') { $env:ELECTRON_BUILDER_7ZIP_PATH = "$projectRoot\.cache\tools\7za.exe" }
if (Test-Path '.cache\tools\nsis\Bin\makensis.exe') { $env:ELECTRON_BUILDER_NSIS_DIR = "$projectRoot\.cache\tools\nsis" }
if (Test-Path '.cache\tools\nsis-resources') { $env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = "$projectRoot\.cache\tools\nsis-resources" }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
$electronVersion = (Get-Content 'node_modules/electron/package.json' -Raw | ConvertFrom-Json).version
$archiveName = "electron-v$electronVersion-win32-x64.zip"
$archive = ".cache/electron-verified/parallel-$archiveName"
$distribution = ".cache/electron-dist-$electronVersion"
if (Test-Path -LiteralPath $archive) {
  $expected = (Get-Content 'node_modules/electron/checksums.json' -Raw | ConvertFrom-Json).PSObject.Properties[$archiveName].Value
  if (!$expected -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) {
    throw 'Electron archive checksum differs from the installed release metadata'
  }
  Expand-Archive -LiteralPath $archive -DestinationPath $distribution -Force
  npx electron-builder --win portable --x64 "--config.electronDist=$distribution"
} else {
  npx electron-builder --win portable --x64
}
if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed' }
$version = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version
$name = "QALAWindow-$version-Windows-x64.exe"
$artifact = Join-Path 'release/windows' $name
$checksum = Get-FileHash -LiteralPath $artifact -Algorithm SHA256
"$($checksum.Hash.ToLowerInvariant())  $name" | Set-Content -Encoding ascii -LiteralPath "$artifact.sha256"
$checksum
