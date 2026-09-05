@echo off
echo === Starting HR Tracker - Production (Fast) ===
pm2 resurrect
timeout /t 8 >nul
echo Starting Public Tunnel...
start "" "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000 --logfile C:\Users\user\AppData\Local\Temp\cf_new.log --no-autoupdate
timeout /t 6 >nul
echo.
echo --- Local ---
echo Web: http://localhost:3000
echo API: http://localhost:4000/health
echo LAN: http://192.168.0.108:3000
echo.
echo --- Public (wait 10 sec then check) ---
type C:\Users\user\AppData\Local\Temp\cf_new.log | findstr trycloudflare
echo.
echo Admin: admin@company.com / Admin@123456
echo Keep this PC ON - closing = offline
pause
