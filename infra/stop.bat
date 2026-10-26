@echo off
echo [Vedha AI] Stopping containers...
powershell -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
pause
