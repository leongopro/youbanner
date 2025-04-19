@echo off
chcp 936 >nul
echo 开始测试 Stability AI 移除背景 API...
python backend/scripts/test-remove-bg.py
echo.
echo 测试完成。按任意键退出...
pause > nul 