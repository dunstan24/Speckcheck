@echo off
chcp 65001 >nul
title SpecCheck.AI - Backend

echo.
echo  ================================================
echo   SpecCheck.AI - Backend (Flask)
echo  ================================================
echo.

cd /d "%~dp0backend"

:: Install dependencies
echo  [1/2] Installing Python dependencies...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo  [ERROR] pip install failed! Make sure Python is installed.
    pause
    exit /b 1
)

echo  [2/2] Starting Flask server...
echo.
echo  Backend running at: http://localhost:5000
echo  Press Ctrl+C to stop.
echo.
python app.py
pause
