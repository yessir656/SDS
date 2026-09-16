@echo off
title SDS-CHEM - Export Database
cd /d "%~dp0"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set STAMP=%%i
set DEST=%USERPROFILE%\Desktop\sds-backup-%STAMP%

echo ============================================
echo   Exporting SDS-CHEM data
echo   TO: %DEST%
echo ============================================
echo.
echo   (If the staging server is running, close its
echo    window FIRST so the database copies cleanly.)
echo.

if not exist "prisma\db\custom.db" (
  echo ERROR: prisma\db\custom.db not found. Run this from the project folder.
  pause
  exit /b 1
)

mkdir "%DEST%"
copy /y "prisma\db\custom.db" "%DEST%\" >nul
robocopy "storage" "%DEST%\storage" /E /NFL /NDL /NJH /NJS >nul

echo ============================================
echo   EXPORT DONE
echo.
echo   The folder on your Desktop contains:
echo     - custom.db     (the entire database)
echo     - storage\      (all attached SDS PDFs)
echo.
echo   Move it to the other PC (USB / cloud / LAN),
echo   then there:
echo     1. Copy custom.db into the project's  prisma\db\  folder (replace)
echo     2. Copy the storage folder into the project root (replace/merge)
echo     3. Run start-staging.bat
echo ============================================
pause
