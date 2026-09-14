@echo off
title SDS-CHEM - Build Staging
cd /d "%~dp0"

echo ============================================
echo   Building SDS-CHEM for staging...
echo   (run this AFTER changing code, before starting)
echo ============================================
echo.

call bun run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED - read the errors above.
  pause
  exit /b 1
)

echo.
echo BUILD OK - now run start-staging.bat
pause
