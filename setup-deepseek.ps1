# 本地配置 DeepSeek（密钥只保存在本机 .env.local，不会上传 Git）
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root ".env.local"

Write-Host ""
Write-Host "=== DeepSeek 本地配置 ===" -ForegroundColor Cyan
Write-Host "请勿在聊天/截图中发送 API Key。仅在下面本机输入。"
Write-Host ""
Write-Host "获取密钥: https://platform.deepseek.com → API Keys → 创建 → 复制整段 sk-..."
Write-Host ""

$key = Read-Host "粘贴 DeepSeek API Key"
$key = $key.Trim()
if (-not $key.StartsWith("sk-")) {
    Write-Warning "密钥通常以 sk- 开头，请确认是否复制完整。"
}

$content = "DEEPSEEK_API_KEY=$key`nAI_PROVIDER=deepseek`n"
[System.IO.File]::WriteAllText($envFile, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "已写入: $envFile" -ForegroundColor Green
Write-Host ""
Write-Host "【本地试用】新开终端执行：" -ForegroundColor Yellow
Write-Host "  cd $root"
Write-Host "  d:\cursor\resources\app\resources\helpers\node.exe preview-server.mjs"
Write-Host "  浏览器 http://127.0.0.1:5173/ → 点 AI"
Write-Host ""
Write-Host "【另一终端可测接口】" -ForegroundColor Yellow
Write-Host "  d:\cursor\resources\app\resources\helpers\node.exe scripts\test-agent.mjs"
Write-Host ""
Write-Host "【Vercel 线上】Settings → Environment Variables：" -ForegroundColor Yellow
Write-Host "  名称: DEEPSEEK_API_KEY"
Write-Host "  值:   （与上面相同的一整串 sk-...）"
Write-Host "  保存 → Deployments → Redeploy"
Write-Host "  访问: https://lcl-resume-github-io.vercel.app/"
Write-Host ""
