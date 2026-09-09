Este proyecto es un boilerplate B2B2C para locales de comida: tienda pública, panel de empleados y bot de WhatsApp, con un deployment por cliente (no multitenant).

## Stack
- Backend: Node + Express + TypeScript + Mongoose + Zod
- Admin (`client/`): React + Vite + shadcn/ui + TanStack Query + Recharts
- Tienda (`store-frontend/`): React + Vite + Tailwind
- Tipos compartidos: `shared/` (workspace de npm)
- BD: MongoDB en Docker, publicado en el **puerto 27018**
- WhatsApp: `whatsapp-web.js`

## Levantar en local
```
start.bat            # docker compose up -d + npm run dev
```
o a mano:
```
docker compose up -d
npm run dev          # server :5000, admin :3001, tienda :3002
```

Admin: `admin@admin.com` / `admin123`.

## Variables importantes (`server/.env`)
- `WHATSAPP_BOT_ENABLED` — **default false**. Sin esto en `true` el bot no se conecta ni aunque el toggle del admin esté prendido.
- `WHATSAPP_ALLOWED_NUMBERS` — allowlist de clientes; filtra entrada y salida. Dejala puesta mientras testees sobre una línea real.
- `WHATSAPP_MAX_MESSAGE_AGE_SECONDS` — ventana de gracia tras una reconexión (default 600).
- `LOG_LEVEL` — `debug` muestra las renovaciones del QR y los mensajes descartados.

## Migraciones
```
cd server
npx tsx src/scripts/migrateNavSections.ts
npx tsx src/scripts/migrateOrderStatus.ts
npx tsx src/scripts/migrateDeliveryAddress.ts
```
Las tres son idempotentes.

## Rutas del admin
| Ruta | Página |
|---|---|
| `/` | Dashboard |
| `/pedidos` | Pedidos Live (Kanban) |
| `/catalogo` | Catálogo de productos |
| `/navegacion` | Navegación de la tienda |
| `/historial` | Historial de Ventas |
| `/ganancias` | Ganancias |
| `/rutas` | Hojas de Ruta |
| `/configuracion` | Configuración y QR de WhatsApp |

## Commit policy
**ESTRICTAMENTE PROHIBIDO** hacer `git commit` o `git push` de forma autónoma. Solo cuando el usuario lo ordene explícitamente. Ver `.agents/rules/git-workflow.md`.

Conventional Commits, un cambio lógico por commit. Nunca commitear builds, logs, `server/.wwebjs_auth/` ni credenciales.

## Documentación viva
El estado y el roadmap se mantienen en el proyecto de Claude "BoilerplateCasaDeComidas": `roadmap-gaps.md`, `roadmap-precios.md`, `estados-y-eta.md`.
