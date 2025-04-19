@echo off
chcp 65001 >nul
echo ===== PhotoCalory App Stop Tool =====
echo.

:: Enable delayed variable expansion
setlocal enabledelayedexpansion

:: Set a specific title for this window to prevent self-closure
title PhotoCalory_StopTool_DO_NOT_CLOSE

echo STEP 1: Killing all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

echo STEP 2: Killing processes on ports 3000 and 5000...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo   - Killing process: %%p
    taskkill /F /PID %%p >nul 2>&1
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo   - Killing process: %%p
    taskkill /F /PID %%p >nul 2>&1
)

echo STEP 3: Extra step - Finding and closing CMD windows...

:: First approach - get all CMD processes (except us)
echo   Method 1: Closing command prompts by PID...
for /f "skip=3 tokens=2" %%a in ('tasklist /fi "imagename eq cmd.exe" /fo table') do (
    :: Get the title of the window to check if it's us
    for /f "tokens=*" %%t in ('tasklist /v /fi "PID eq %%a" /fo list ^| findstr "Window Title"') do (
        set "windowTitle=%%t"
        :: Check if it's not our window
        echo !windowTitle! | findstr /C:"PhotoCalory_StopTool_DO_NOT_CLOSE" >nul
        if !errorlevel! neq 0 (
            echo   - Closing CMD PID: %%a
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

:: Second approach - try to kill by specific window titles
echo   Method 2: Closing by window titles...
taskkill /F /FI "WINDOWTITLE eq *PhotoCalory2*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq *Frontend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq *Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq *前端*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq *后端*" >nul 2>&1

:: The most direct approach - kill all CMD except ourselves by name
echo   Method 3: Terminating all CMD instances except current...
:: First, get our own process ID
for /f "tokens=2" %%p in ('tasklist /v ^| find "cmd.exe" ^| find "PhotoCalory_StopTool_DO_NOT_CLOSE"') do set OUR_PID=%%p
echo   - Our PID: !OUR_PID!

:: Kill all other command prompts
for /f "tokens=2" %%p in ('tasklist /v ^| find "cmd.exe"') do (
    if not "%%p"=="!OUR_PID!" (
        echo   - Killing CMD PID: %%p
        taskkill /F /PID %%p >nul 2>&1
    )
)

:: Third approach - create a separate process to kill the windows
echo   Method 4: Creating a background process to close windows...
(
    echo @echo off
    echo timeout /t 1 ^>nul
    echo taskkill /F /FI "WINDOWTITLE eq *PhotoCalory2前端*" ^>nul 2^>^&1
    echo taskkill /F /FI "WINDOWTITLE eq *PhotoCalory2后端*" ^>nul 2^>^&1
    echo taskkill /F /IM cmd.exe /FI "WINDOWTITLE ne PhotoCalory_StopTool_DO_NOT_CLOSE" ^>nul 2^>^&1
    echo del %%0
) > kill_cmd_windows.bat

start /b cmd /c kill_cmd_windows.bat

echo.
echo STEP 4: Verification - checking port status...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if !errorlevel! equ 0 (
    echo [WARNING] Frontend port 3000 is still occupied
) else (
    echo [SUCCESS] Frontend port 3000 is free
)

netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if !errorlevel! equ 0 (
    echo [WARNING] Backend port 5000 is still occupied
) else (
    echo [SUCCESS] Backend port 5000 is free
)

:: STEP 5: Final instruction for the user
echo.
echo ===== Operation completed =====
echo.
echo If you still see any PhotoCalory windows running:
echo 1. Press Ctrl+Alt+Delete
echo 2. Open Task Manager
echo 3. End all processes named "cmd.exe" and "node.exe"
echo.
echo Press any key to exit...
pause >nul

endlocal 