# 生成腾讯云上传用的站点压缩包（仅含 index.html、src、public）
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$staging = Join-Path $root "_tencent_deploy"
$zip = Join-Path $root "resume-site-tencent.zip"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }

New-Item -ItemType Directory -Path (Join-Path $staging "src") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "public") -Force | Out-Null
Copy-Item (Join-Path $root "index.html") $staging
Copy-Item (Join-Path $root "src\*") (Join-Path $staging "src\")
Copy-Item (Join-Path $root "public\*") (Join-Path $staging "public\")

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zip -Force
Remove-Item $staging -Recurse -Force

Write-Host "已生成: $zip"
Write-Host "请按对话中的腾讯云 Webify / COS 步骤上传此压缩包内解压后的文件。"
