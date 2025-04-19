@echo off
chcp 936 >nul
echo 准备下载任务结果...

if "%~1"=="" (
    echo 错误: 请提供任务ID
    echo 用法: download-result.bat 任务ID [最大尝试次数] [间隔秒数]
    exit /b 1
)

set TASK_ID=%1
set MAX_ATTEMPTS=10
set INTERVAL=10

if not "%~2"=="" set MAX_ATTEMPTS=%2
if not "%~3"=="" set INTERVAL=%3

echo 开始监控任务: %TASK_ID%
echo 最大尝试次数: %MAX_ATTEMPTS%
echo 尝试间隔: %INTERVAL%秒
echo 注意: API文档建议轮询间隔不小于10秒
echo.

python backend/scripts/download-result.py %TASK_ID% %MAX_ATTEMPTS% %INTERVAL%
echo.
echo 操作完成。按任意键退出...
pause > nul 