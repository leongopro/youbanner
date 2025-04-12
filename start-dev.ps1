# 设置终端编码为UTF-8
$env:LANG="en_US.UTF-8"
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "已设置终端编码为UTF-8"
Write-Host "正在启动开发环境..."

# 项目启动命令
# 后续可以替换为实际的项目启动命令，如：
# cd frontend && npm run dev

# 验证中文显示
Write-Host "测试中文显示: 你好，世界！" 