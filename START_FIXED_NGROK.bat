@echo off
echo For NGROK FIXED domain (more stable):
echo 1. Signup free at https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. Copy token, run: ngrok config add-authtoken YOUR_TOKEN
echo 3. Claim domain at https://dashboard.ngrok.com/cloud-edge/domains
echo 4. Then run: ngrok http 3000 --domain=YOUR_FIXED.ngrok-free.app
echo Example: ngrok http 3000 --domain=hr-main-emp.ngrok-free.app
pause
