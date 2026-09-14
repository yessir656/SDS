@echo off
title SDS-CHEM Staging Server
cd /d "%~dp0"

if not exist ".next\standalone\server.js" (
  echo No production build found. Building first, please wait...
  call bun run build
  if errorlevel 1 (
    echo.
    echo BUILD FAILED - fix the errors above and try again.
    pause
    exit /b 1
  )
)

echo ============================================
echo   SDS-CHEM staging server is starting...
echo.
echo   This PC:      http://localhost:3000
echo   Colleagues:   http://10.10.123.40:3000
echo.
echo   If the colleagues link fails, open cmd and
echo   run "ipconfig" - use the IPv4 address shown.
echo.
echo   STOP the server: press Ctrl+C or close this
echo   window. Server stops when this window closes
echo   or your PC sleeps/shuts down.
echo ============================================
echo.

cd /d "%~dp0.next\standalone"
set NODE_ENV=production
set PORT=3000
set DATABASE_URL=file:C:/Users/jtvillegas/Desktop/sds other version/sdsv5/prisma/db/custom.db
bun server.js

echo.
echo Server stopped.
pause
