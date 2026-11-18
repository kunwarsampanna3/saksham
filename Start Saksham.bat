@echo off
rem Double-click to run Saksham in FAST mode (production build). Close this window to stop it.
title Saksham - fast mode
rem Do not send anonymous usage data to the Next.js team.
set NEXT_TELEMETRY_DISABLED=1
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b 1)

if not exist node_modules (
  echo Installing packages - first time only, takes a few minutes...
  call npm install || (pause & exit /b 1)
)
if not exist .env.local call node scripts\setup-env.mjs

echo Building the fast version - about one minute...
call npm run build || (echo Build failed. See the messages above. & pause & exit /b 1)

echo.
echo Saksham is starting at http://localhost:3000  (close this window to stop it)
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
call npm run start
