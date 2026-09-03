param(
  [string]$Target = "",
  [string]$DataRoot = $env:DATA_DIR
)

# Back up assets, releases, the project index, and encrypted credentials together.
if (-not $DataRoot) {
  $DataRoot = Join-Path $PSScriptRoot "..\data"
}
if (-not $Target) {
  $Target = Join-Path $DataRoot "backups"
}
New-Item -ItemType Directory -Force -Path $Target | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $Target "threevision-data-$stamp.zip"
$paths = @(
  (Join-Path $DataRoot "assets"),
  (Join-Path $DataRoot "releases"),
  (Join-Path $DataRoot "projects.json"),
  (Join-Path $DataRoot "secrets.json"),
  (Join-Path $DataRoot ".secret-key")
) | Where-Object { Test-Path $_ }
if ($paths.Count -gt 0) {
  Compress-Archive -Path $paths -DestinationPath $archive -Force
  Write-Output "Backup completed: $archive"
} else {
  Write-Output "No DATA_DIR files found; backup skipped."
}
