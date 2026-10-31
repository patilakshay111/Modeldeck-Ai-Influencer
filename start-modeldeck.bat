@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  ModelDeck START
echo ============================================
echo.

:: ── 1. Stop any old processes on ports 8787 (backend) and 5173 (frontend) ──
echo Stopping any old ModelDeck processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8787') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   stopped backend (port 8787, PID %%a)
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   stopped frontend (port 5173, PID %%a)
)

:: ── 2. Paths ──
set BACKEND_DIR=%~dp0backend
set FRONTEND_DIR=%~dp0frontend
set NODE_EXE=%USERPROFILE%\.local\node\node-v24.18.0-win-x64\node.exe

if not exist "%NODE_EXE%" (
    echo ERROR: Node.js not found at %NODE_EXE%
    pause
    exit /b 1
)

:: ── 3. Start backend ──
echo Starting backend on http://127.0.0.1:8787 ...
start "ModelDeck Backend" cmd /c "cd /d "%BACKEND_DIR%"& set PORT=8787& set HOST=127.0.0.1& set JWT_SECRET=modeldeck-local-development-secret-0001& set PUBLIC_ORIGIN=http://127.0.0.1:8787& "%NODE_EXE%" --import tsx src/server.ts"

:: ── 4. Start frontend ──
echo Starting frontend on http://127.0.0.1:5173 ...
start "ModelDeck Frontend" cmd /c "cd /d "%FRONTEND_DIR%"& npm.cmd run dev"

echo.
echo ============================================
echo  ModelDeck started
echo ============================================
echo  Backend:  http://127.0.0.1:8787
echo  Frontend: http://127.0.0.1:5173
echo.
echo  Both services run in separate windows.
echo  Press Ctrl+C in either window to stop that service.
echo.
