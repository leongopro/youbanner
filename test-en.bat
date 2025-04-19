@echo off
echo ======================================
echo    Stability API Test Tool
echo ======================================
echo.

echo Checking Python environment...

REM Try different Python commands
WHERE python >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo Found Python command
    SET PYTHON_CMD=python
    GOTO :INSTALL_DEPS
)

WHERE py >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo Found Python launcher
    SET PYTHON_CMD=py
    GOTO :INSTALL_DEPS
)

WHERE python3 >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo Found Python3 command
    SET PYTHON_CMD=python3
    GOTO :INSTALL_DEPS
)

echo Python not found. Please make sure Python is installed and added to your PATH
echo You can try running the script manually: python test-python.py
echo.
echo Trying Node.js instead...

REM Try using Node.js script
WHERE node >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo Found Node.js, will use Node script instead
    node test-api-simple.js
    GOTO :END
) ELSE (
    echo Node.js not found.
    echo Please make sure Python or Node.js is installed and added to your PATH.
    GOTO :END
)

:INSTALL_DEPS
echo Installing required Python dependencies...
%PYTHON_CMD% -m pip install requests

echo.
echo Running test script...
%PYTHON_CMD% test-python.py

:END
echo.
echo Test completed. Press any key to exit...
pause > nul 