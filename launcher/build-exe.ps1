$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'dist\serena-docente'

dotnet publish (Join-Path $PSScriptRoot 'Serena.Launcher.csproj') `
  -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true `
  -o $output

Write-Host "Ejecutable creado en: $output\Serena-Docente.exe"
