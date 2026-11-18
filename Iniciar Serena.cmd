@echo off
setlocal
cd /d "%~dp0"

where dotnet >nul 2>nul
if errorlevel 1 (
  echo .NET SDK was not found. Install .NET SDK 10 and open this file again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS and open this file again.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS with npm included.
  pause
  exit /b 1
)

if not exist "backend\node_modules\socket.io" (
  echo Installing backend dependencies...
  call npm.cmd --prefix backend ci
  if errorlevel 1 goto :error
)

if not exist "frontend\node_modules\vite" (
  echo Installing frontend dependencies...
  call npm.cmd --prefix frontend ci
  if errorlevel 1 goto :error
)

echo Building the API...
dotnet build Serena.Api
if errorlevel 1 goto :error

echo Preparing test accounts...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "Serena.Api\seed-demo-teachers.ps1"
if errorlevel 1 goto :error

if not exist "dist\serena-docente\Serena-Docente.exe" (
  echo Creating the Serena executable...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "launcher\build-exe.ps1"
  if errorlevel 1 goto :error
)

echo Opening Serena. Keep this window open during the session.
start "" /wait "dist\serena-docente\Serena-Docente.exe"
exit /b %errorlevel%

:error
echo Serena could not be prepared. Check the message above and try again.
pause
exit /b 1
