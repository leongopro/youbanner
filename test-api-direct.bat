@echo off
chcp 936 >nul
echo 开始直接测试 Stability API...
python backend/scripts/test-api-direct.py
echo.
echo 测试完成。按任意键退出...
pause > nul 