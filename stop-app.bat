@echo off
chcp 65001 >nul
echo ===== PhotoCalory应用停止工具 =====
echo.

:: 启用延迟变量扩展
setlocal enabledelayedexpansion

:: ===== 第1步：通过端口关闭进程 =====
echo [步骤1] 通过端口号查找并关闭进程...

:: 前端进程 (3000端口)
set "FRONTEND_PORT=3000"
echo 正在查找并关闭监听 %FRONTEND_PORT% 端口的进程...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%FRONTEND_PORT%" ^| findstr "LISTENING"') do (
    echo - 发现进程 PID: %%p (端口 %FRONTEND_PORT%)
    taskkill /F /PID %%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止进程 %%p
    ) else (
        echo   [失败] 无法终止进程 %%p
    )
)

:: 后端进程 (5000端口)
set "BACKEND_PORT=5000"
echo 正在查找并关闭监听 %BACKEND_PORT% 端口的进程...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%BACKEND_PORT%" ^| findstr "LISTENING"') do (
    echo - 发现进程 PID: %%p (端口 %BACKEND_PORT%)
    taskkill /F /PID %%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止进程 %%p
    ) else (
        echo   [失败] 无法终止进程 %%p
    )
)

:: ===== 第2步：通过名称查找相关Node进程 =====
echo.
echo [步骤2] 通过进程名和命令行查找相关进程...

:: 查找Next.js相关进程
echo 正在查找Next.js相关进程...
for /f "tokens=2 delims=," %%p in ('wmic process where "commandline like '%%next%%dev%%'" get processid /format:csv ^| findstr /r "[0-9]"') do (
    echo - 发现Next.js进程 PID: %%p
    taskkill /F /PID %%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止Next.js进程 %%p
    ) else (
        echo   [失败] 无法终止Next.js进程 %%p
    )
)

:: 查找前端相关进程
echo 正在查找frontend相关进程...
for /f "tokens=2 delims=," %%p in ('wmic process where "commandline like '%%frontend%%'" get processid /format:csv ^| findstr /r "[0-9]"') do (
    echo - 发现frontend进程 PID: %%p
    taskkill /F /PID %%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止frontend进程 %%p
    ) else (
        echo   [失败] 无法终止frontend进程 %%p
    )
)

:: 查找后端相关进程
echo 正在查找backend相关进程...
for /f "tokens=2 delims=," %%p in ('wmic process where "commandline like '%%backend%%'" get processid /format:csv ^| findstr /r "[0-9]"') do (
    echo - 发现backend进程 PID: %%p
    taskkill /F /PID %%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止backend进程 %%p
    ) else (
        echo   [失败] 无法终止backend进程 %%p
    )
)

:: ===== 第3步：自动关闭所有Node.js进程 =====
echo.
echo [步骤3] 正在关闭所有相关Node.js进程...

:: 查找并关闭PhotoCalory2相关的Node进程
for /f "tokens=2 delims=," %%p in ('wmic process where "commandline like '%%photocalory2%%'" get processid /format:csv ^| findstr /r "[0-9]"') do (
    echo - 发现PhotoCalory相关进程 PID: %%p
    taskkill /F /PID %%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止PhotoCalory相关进程 %%p
    ) else (
        echo   [失败] 无法终止PhotoCalory相关进程 %%p
    )
)

:: 查找端口3000和5000相关的所有Node进程
for /f "tokens=1,5" %%a in ('netstat -ano ^| findstr ":3000\|:5000"') do (
    echo - 发现端口3000/5000相关进程 PID: %%b
    taskkill /F /PID %%b >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止端口相关进程 %%b
    ) else (
        echo   [失败] 无法终止端口相关进程 %%b
    )
)

:: ===== 第4步：清理端口 (使用netsh) =====
echo.
echo [步骤4] 尝试释放被占用的端口...

:: 尝试释放前端端口
netsh interface ipv4 show excludedportrange protocol=tcp | findstr "%FRONTEND_PORT%" >nul
if !errorlevel! neq 0 (
    echo 尝试释放前端端口 %FRONTEND_PORT%...
    netsh int ipv4 delete excludedportrange protocol=tcp startport=%FRONTEND_PORT% numberofports=1 >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已释放端口 %FRONTEND_PORT%
    ) else (
        echo   [信息] 无法手动释放端口 %FRONTEND_PORT%
    )
)

:: 尝试释放后端端口
netsh interface ipv4 show excludedportrange protocol=tcp | findstr "%BACKEND_PORT%" >nul
if !errorlevel! neq 0 (
    echo 尝试释放后端端口 %BACKEND_PORT%...
    netsh int ipv4 delete excludedportrange protocol=tcp startport=%BACKEND_PORT% numberofports=1 >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已释放端口 %BACKEND_PORT%
    ) else (
        echo   [信息] 无法手动释放端口 %BACKEND_PORT%
    )
)

:: ===== 第5步：验证端口释放状态 =====
echo.
echo [步骤5] 验证端口占用状态...

:: 验证前端端口
netstat -ano | findstr ":%FRONTEND_PORT%" | findstr "LISTENING" >nul
if !errorlevel! equ 0 (
    echo [警告] 前端端口 %FRONTEND_PORT% 仍被占用
    
    :: 再次尝试强制关闭所有Node进程
    echo 正在强制关闭所有Node.js进程...
    taskkill /f /im node.exe >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [成功] 已终止所有Node.js进程
    )
    timeout /t 2 >nul
    
    :: 再次检查
    netstat -ano | findstr ":%FRONTEND_PORT%" | findstr "LISTENING" >nul
    if !errorlevel! equ 0 (
        echo [警告] 前端端口 %FRONTEND_PORT% 仍被占用，可能需要重启电脑
    ) else (
        echo [成功] 前端端口 %FRONTEND_PORT% 已成功释放
    )
) else (
    echo [成功] 前端端口 %FRONTEND_PORT% 已成功释放
)

:: 验证后端端口
netstat -ano | findstr ":%BACKEND_PORT%" | findstr "LISTENING" >nul
if !errorlevel! equ 0 (
    echo [警告] 后端端口 %BACKEND_PORT% 仍被占用，可能需要重启电脑
) else (
    echo [成功] 后端端口 %BACKEND_PORT% 已成功释放
)

endlocal

echo.
echo ===== 应用停止操作完成 =====
echo 如果仍无法启动，请尝试重启电脑
timeout /t 3 >nul 