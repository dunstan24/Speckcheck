@echo off
chcp 65001 >nul
title SpecCheck.AI - Build EXE

echo.
echo  ================================================
echo   SpecCheck.AI - Build Detector ke .EXE
echo   Letakkan BUILD.bat di folder "detector"
echo  ================================================
echo.

:: Pastikan kita di folder yang benar
if not exist "speccheck_detect.py" (
    echo  [ERROR] File speccheck_detect.py tidak ditemukan!
    echo  Pastikan BUILD.bat ada di folder yang sama dengan speccheck_detect.py
    echo.
    pause
    exit /b 1
)

:: Cek Python
echo  [1/4] Cek Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python tidak ditemukan!
    echo  Download di: https://python.org/downloads
    echo  Centang "Add Python to PATH" saat install.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo  OK - %%i
echo.

:: Install dependencies
echo  [2/4] Install PyInstaller + psutil + pywin32 + wmi...
python -m pip install pyinstaller psutil pywin32 wmi --quiet --upgrade
if errorlevel 1 (
    echo  [ERROR] Gagal install. Cek koneksi internet.
    pause
    exit /b 1
)
echo  OK - Semua library terinstall
echo.

:: Build exe
echo  [3/4] Build SpecCheck_Detect.exe (1-3 menit)...
echo.
python -m PyInstaller ^
    --onefile ^
    --noconsole ^
    --name "SpecCheck_Detect" ^
    --clean ^
    --noconfirm ^
    speccheck_detect.py

if errorlevel 1 (
    echo.
    echo  [ERROR] Build gagal! Lihat error di atas.
    pause
    exit /b 1
)

:: Pindahkan ke folder ini
echo.
echo  [4/4] Menyiapkan file...
if exist "dist\SpecCheck_Detect.exe" (
    copy /Y "dist\SpecCheck_Detect.exe" "SpecCheck_Detect.exe" >nul
    
    echo.
    echo  ================================================
    echo   BUILD BERHASIL!
    echo  ================================================
    echo   File: SpecCheck_Detect.exe (folder ini)
    echo.
    echo   Cara distribusi ke user:
    echo   1. Copy SpecCheck_Detect.exe ke komputer user
    echo   2. User double-click file tersebut
    echo   3. Browser otomatis terbuka dengan hasil analisis
    echo  ================================================
    echo.

    :: Tanya test sekarang?
    set /p RUN="  Test sekarang? (y/n): "
    if /i "%RUN%"=="y" (
        echo.
        echo  Menjalankan SpecCheck_Detect.exe...
        start "" "SpecCheck_Detect.exe"
    )

    :: Bersihkan folder build sementara
    echo.
    set /p CLEAN="  Hapus folder build dan dist? (y/n): "
    if /i "%CLEAN%"=="y" (
        rmdir /s /q build >nul 2>&1
        rmdir /s /q dist  >nul 2>&1
        del /q "SpecCheck_Detect.spec" >nul 2>&1
        echo  Folder temporary dihapus.
    )
) else (
    echo  [ERROR] File .exe tidak ditemukan setelah build.
)

echo.
pause
