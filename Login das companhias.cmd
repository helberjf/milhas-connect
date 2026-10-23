@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 ou superior nao foi encontrado.
  pause
  exit /b 1
)
node scripts\robot-login.mjs %*
if errorlevel 1 pause
