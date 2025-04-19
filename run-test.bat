@echo off
chcp 936 >nul
echo ======================================
echo    Stability API 背景替换测试工具
echo ======================================
echo.

echo 正在检查Python环境...

REM 尝试不同的Python命令
WHERE python >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo 找到Python命令，使用python运行
    SET PYTHON_CMD=python
    GOTO :INSTALL_DEPS
)

WHERE py >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo 找到Python启动器，使用py运行
    SET PYTHON_CMD=py
    GOTO :INSTALL_DEPS
)

WHERE python3 >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo 找到Python3命令，使用python3运行
    SET PYTHON_CMD=python3
    GOTO :INSTALL_DEPS
)

echo 未找到Python命令，请确保已安装Python并添加到系统路径
echo 您可以尝试手动运行脚本: python test-python.py
echo.
echo 尝试使用Node.js替代...

REM 尝试使用Node.js脚本
WHERE node >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo 找到Node.js，将使用节点脚本替代
    node test-api-simple.js
    GOTO :END
) ELSE (
    echo 未找到Node.js。
    echo 请确保已安装Python或Node.js并添加到系统路径。
    GOTO :END
)

:INSTALL_DEPS
echo 正在安装必要的Python依赖...
%PYTHON_CMD% -m pip install requests

echo.
echo 正在运行测试脚本...
%PYTHON_CMD% test-python.py

:END
echo.
echo 测试完成。按任意键退出...
pause > nul 