param(
  [string]$Target = ".\data\backups"
)

# MVP 备份脚本：备份本地资源目录；接入 PostgreSQL 后可在此处增加 pg_dump。
New-Item -ItemType Directory -Force -Path $Target | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $Target "threevision-assets-$stamp.zip"
$paths = @(".\data\assets", ".\data\releases") | Where-Object { Test-Path $_ }
if ($paths.Count -gt 0) {
  Compress-Archive -Path $paths -DestinationPath $archive -Force
  Write-Output "备份完成：$archive"
} else {
  Write-Output "未找到 data\assets 或 data\releases 目录，跳过文件备份。"
}
