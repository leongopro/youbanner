@echo off
chcp 936 >nul
echo 正在运行 Stability API 测试脚本...
python -m pip install requests
python backend/scripts/test-python.py
echo.
echo 测试完成。按任意键退出...
pause > nul 