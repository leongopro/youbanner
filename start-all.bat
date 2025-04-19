@echo off
echo 正在启动PhotoCalory2应用...
echo.
echo 正在启动前端和后端服务器...
echo.

start cmd /k "title PhotoCalory2前端 && call start-frontend.bat"
start cmd /k "title PhotoCalory2后端 && call start-backend.bat"

echo.
echo 前端和后端服务器已在新窗口中启动。
echo 服务器正在后台运行，此窗口将自动关闭。
echo.
timeout /t 3 > nul 