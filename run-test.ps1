# Stability API 背景替换测试工具
Write-Host "======================================"
Write-Host "   Stability API 背景替换测试工具" -ForegroundColor Cyan
Write-Host "======================================"
Write-Host ""

Write-Host "正在检查Python环境..." -ForegroundColor Yellow

# 尝试不同的Python命令
$pythonCmd = $null

if (Get-Command "python" -ErrorAction SilentlyContinue) {
    Write-Host "找到Python命令，使用python运行" -ForegroundColor Green
    $pythonCmd = "python"
}
elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    Write-Host "找到Python启动器，使用py运行" -ForegroundColor Green
    $pythonCmd = "py"
}
elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    Write-Host "找到Python3命令，使用python3运行" -ForegroundColor Green
    $pythonCmd = "python3"
}
else {
    Write-Host "未找到Python命令，请确保已安装Python并添加到系统路径" -ForegroundColor Red
    Write-Host "您可以尝试手动运行脚本: python test-python.py"
    Write-Host ""
    Write-Host "尝试使用Node.js替代..." -ForegroundColor Yellow
    
    # 尝试使用Node.js脚本
    if (Get-Command "node" -ErrorAction SilentlyContinue) {
        Write-Host "找到Node.js，将使用节点脚本替代" -ForegroundColor Green
        node test-api-simple.js
    }
    else {
        Write-Host "未找到Node.js。" -ForegroundColor Red
        Write-Host "请确保已安装Python或Node.js并添加到系统路径。"
    }
    
    Write-Host ""
    Write-Host "测试完成。按任意键退出..." -ForegroundColor Cyan
    Read-Host | Out-Null
    exit
}

# 安装依赖
Write-Host "正在安装必要的Python依赖..." -ForegroundColor Yellow
& $pythonCmd -m pip install requests

Write-Host ""
Write-Host "正在运行测试脚本..." -ForegroundColor Yellow
& $pythonCmd test-python.py

Write-Host ""
Write-Host "测试完成。按任意键退出..." -ForegroundColor Cyan
Read-Host | Out-Null 