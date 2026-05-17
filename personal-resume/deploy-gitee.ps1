# 推送到 Gitee 后，请到仓库「服务 → Gitee Pages」点击「更新」
$git = "C:\Program Files\Git\cmd\git.exe"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path $git)) {
  Write-Error "未找到 Git，请安装 Git for Windows。"
  exit 1
}

$remotes = & $git remote 2>$null
if ($remotes -notcontains "gitee") {
  & $git remote add gitee "https://gitee.com/LeeXDE/personal-resume.git"
}

Write-Host "正在推送到 Gitee（仓库：LeeXDE/personal-resume）..."
Write-Host "若提示输入密码，请使用 Gitee 私人令牌（不是登录密码）。`n"
& $git push -u gitee main

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n推送成功。请打开："
  Write-Host "  https://gitee.com/LeeXDE/personal-resume/pages"
  Write-Host "选择分支 main，部署目录 / ，点击「启动/更新」。"
  Write-Host "`n访问地址一般为："
  Write-Host "  https://leexde.gitee.io/personal-resume/"
} else {
  Write-Host "`n推送失败。请按下方说明配置 Gitee 私人令牌后重试。"
}
