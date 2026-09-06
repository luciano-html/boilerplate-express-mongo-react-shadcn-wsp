#!/bin/bash
echo "Iniciando entorno B2B2C..."
echo "Frontend (Storefront): http://localhost:3002"
echo "Backend (Admin): http://localhost:3001"
echo "API (Server): http://localhost:5000"
echo ""
docker compose up -d
npm run dev
