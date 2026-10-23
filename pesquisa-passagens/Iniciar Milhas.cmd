@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js para usar o auxiliar local ou abra index.html.
  pause
  exit /b 1
)
node "%~dp0servidor.cjs"
if errorlevel 1 pause
