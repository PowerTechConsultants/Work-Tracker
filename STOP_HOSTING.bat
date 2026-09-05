@echo off
echo Stopping HR Tracker...
pm2 stop all
taskkill /F /IM cloudflared.exe 2>nul
echo Stopped - Website OFFLINE
pause
