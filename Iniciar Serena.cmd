@echo off
setlocal
cd /d "%~dp0"

where dotnet >nul 2>nul
if errorlevel 1 (
  echo No se encontro .NET SDK. Instala .NET SDK 10 y vuelve a abrir este archivo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node.js LTS y vuelve a abrir este archivo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo No se encontro npm. Reinstala Node.js LTS con npm incluido.
  pause
  exit /b 1
)

if not exist "backend\node_modules\socket.io" (
  echo Instalando dependencias del backend...
  call npm.cmd --prefix backend ci
  if errorlevel 1 goto :error
)

if not exist "frontend\node_modules\vite" (
  echo Instalando dependencias del frontend...
  call npm.cmd --prefix frontend ci
  if errorlevel 1 goto :error
)

echo Compilando la API...
dotnet build Serena.Api
if errorlevel 1 goto :error

echo Preparando cuentas de prueba...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "Serena.Api\seed-demo-teachers.ps1"
if errorlevel 1 goto :error

if not exist "dist\serena-docente\Serena-Docente.exe" (
  echo Creando el ejecutable de Serena...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "launcher\build-exe.ps1"
  if errorlevel 1 goto :error
)

echo Abriendo Serena. Mantenga esta ventana abierta durante la sesion.
start "" /wait "dist\serena-docente\Serena-Docente.exe"
exit /b %errorlevel%

:error
echo No se pudo preparar Serena. Revisa el mensaje anterior y vuelve a intentarlo.
pause
exit /b 1
