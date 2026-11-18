@echo off
rem Double-click while changing the code: the site reloads by itself when a file is saved.
title Saksham - edit mode
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

echo.
echo Saksham edit mode at http://localhost:3000  (close this window to stop it)
rem Open the browser only once the site answers (the first page can take ~20 s to prepare).
start "" /min cmd /c "for /l %%i in (1,1,90) do (curl -s -o nul http://localhost:3000/login && (start http://localhost:3000 & exit) || timeout /t 2 >nul)"
call npm run dev
pause
