@echo off
chcp 65001 >nul
title SpecCheck.AI - Frontend

echo.
echo  ================================================
echo   SpecCheck.AI - Frontend (React + Vite)
echo  ================================================
echo.

cd /d "%~dp0frontend"

:: Install node modules if needed
if not exist "node_modules" (
    echo  [1/2] Installing Node.js dependencies (first time only)...
    npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed! Make sure Node.js is installed.
        echo  Download: https://nodejs.org
        pause
        exit /b 1
    )
) else (
    echo  [1/2] Node modules already installed. Skipping...
)

echo  [2/2] Starting development server...
echo.
echo  Website running at: http://localhost:5173
echo  Press Ctrl+C to stop.
echo.
npm run dev
pause
