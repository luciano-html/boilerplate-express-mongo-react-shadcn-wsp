@echo off
echo Iniciando entorno B2B2C...
echo Frontend (Storefront): http://localhost:3002
echo Backend (Admin): http://localhost:3001
echo API (Server): http://localhost:5000
echo Iniciando base de datos con Docker...
docker compose up -d
echo.
npm run dev
