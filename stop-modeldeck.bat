@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  ModelDeck STOP
echo ============================================
echo.

:: ── Stop any old processes on ports 8787 (backend) and 5173 (frontend) ──
echo Stopping ModelDeck processes...

set FOUND=0

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8787') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   stopped backend (port 8787, PID %%a)
    set FOUND=1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   stopped frontend (port 5173, PID %%a)
    set FOUND=1
)

if "%FOUND%"=="0" (
    echo   no ModelDeck processes found running.
)

echo.
echo Done.
pause
