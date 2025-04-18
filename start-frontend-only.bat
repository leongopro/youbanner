@echo off
echo ===== 仅启动前端服务器 =====
echo.

:: 检查前端目录
if not exist "frontend" (
    echo 错误: 找不到 frontend 目录!
    pause
    exit /b 1
)

:: 先尝试释放3000端口
echo 检查3000端口是否被占用...
netstat -ano | findstr :3000
if %ERRORLEVEL% EQU 0 (
    echo 发现3000端口被占用
    echo 尝试释放端口...
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3000') do (
        echo 尝试终止进程 PID: %%i
        taskkill /F /PID %%i
    )
) else (
    echo 3000端口未被占用，很好。
)

echo.
echo 启动前端服务器...
echo 前端将在 http://localhost:3000 启动
echo.

:: 启动前端服务器
cd frontend
start "PhotoCalory 前端服务器" cmd /k "npm run dev"
cd ..

echo 前端服务器启动中，请稍候...
echo 等待10秒后将自动打开浏览器...
timeout /t 10 /nobreak >nul

start http://localhost:3000

echo.
echo 如果浏览器无法访问，请检查以下问题:
echo 1. 查看前端服务器窗口中是否有错误信息
echo 2. 尝试运行 fix-frontend.bat 修复前端
echo 3. 确认后端服务器是否正常运行
echo.

cmd /k 