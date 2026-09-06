# Boilerplate B2B2C - MERN + WhatsApp Bot

Este es un boilerplate genérico diseñado para crear plataformas B2B2C (Business to Business to Consumer) con integración directa a WhatsApp. 

## Stack Tecnológico
- **Frontend:** React + Vite + TailwindCSS + shadcn/ui
- **Backend:** Node.js + Express + TypeScript
- **Base de Datos:** MongoDB + Mongoose
- **Integración WhatsApp:** whatsapp-web.js

## Características Principales
1. **Catálogo de Productos:** Administra tus productos de forma sencilla (CRUD).
2. **Configuración Dinámica:** Establece tiempos de preparación (ETA) base y adicionales por demanda.
3. **Bot de WhatsApp Nativo:** Flujo conversacional automatizado para la toma de pedidos, capturando nombre, ítems, entrega y pago.
4. **Pedidos en Tiempo Real (Kanban):** Interfaz visual tipo Trello para manejar los estados de las órdenes a medida que entran.
5. **Modo Oscuro:** Interfaz amigable para pantallas y administración prolongada.

## Cómo empezar
1. Asegúrate de tener Docker corriendo y levanta la base de datos con `./start.bat` o `./start.sh`
2. Ve a la pestaña `Configuración` en el Dashboard (localhost:3001) para escanear el QR y vincular el bot a una línea de WhatsApp.
3. Carga tus productos en el módulo `Catálogo`.
4. Los usuarios ya pueden hablarle al Bot, hacer pedidos y los verás en la pestaña `Pedidos Live`.
