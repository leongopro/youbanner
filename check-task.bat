@echo off
chcp 936 >nul
echo 正在检查任务状态...

if "%~1"=="" (
    echo 错误: 请提供任务ID
    echo 用法: check-task.bat 任务ID
    exit /b 1
)

python backend/scripts/test-python.py %1
echo.
echo 检查完成。按任意键退出...
pause > nul 