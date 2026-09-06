@echo off
echo Iniciando entorno B2B2C...
echo Frontend (Storefront): http://localhost:3002
echo Backend (Admin): http://localhost:3001
echo API (Server): http://localhost:5000
echo Iniciando base de datos (requiere permisos de administrador si estaba apagada)...
net start MongoDB 2>nul
echo.
npm run dev
