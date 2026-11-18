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

rem If Saksham is already running (port 3000 busy), just open it instead of starting a second copy.
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul && (echo Saksham is already running - opening it. & start http://localhost:3000 & exit /b 0)

echo Building the fast version - 1 to 3 minutes, please wait...
call npm run build || (echo. & echo Build failed. See the messages above. & pause & exit /b 1)

echo.
echo Saksham is starting at http://localhost:3000  (close this window to stop it)
rem Open the browser only once the site answers.
start "" /min cmd /c "for /l %%i in (1,1,60) do (curl -s -o nul http://localhost:3000/login && (start http://localhost:3000 & exit) || timeout /t 2 >nul)"
call npm run start
pause
