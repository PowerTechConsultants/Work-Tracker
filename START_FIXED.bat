@echo off
echo === HR Tracker FIXED URL ===
pm2 resurrect
timeout /t 5 >nul
echo Starting FIXED tunnel https://hr-main-emp-tracker.loca.lt ...
start "" cmd /c "npx --yes localtunnel --port 3000 --subdomain hr-main-emp-tracker"
timeout /t 6 >nul
type C:\Users\user\AppData\Local\Temp\lt.log 2>nul
echo.
echo FIXED URL: https://hr-main-emp-tracker.loca.lt
echo This URL NEVER changes - same after restart
echo Local: http://localhost:3000
echo LAN: http://192.168.0.108:3000
echo API: https://hr-main-emp-tracker.loca.lt/health
pause
