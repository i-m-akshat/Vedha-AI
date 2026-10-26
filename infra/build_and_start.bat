@echo off
echo [Vedha AI] Rebuilding and launching containers...
powershell -ExecutionPolicy Bypass -File "%~dp0build_and_start.ps1"
pause
