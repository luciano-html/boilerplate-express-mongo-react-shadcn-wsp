# Especificación Técnica (Spec.md) - Real Burger & Boilerplate B2B2C

## 1. Visión General
Este documento define la arquitectura, modelos de datos, flujos de UI y reglas de negocio para el monorepo que servirá como:
1. **Boilerplate Genérico de Nicho Hamburgueserías:** `https://github.com/luciano-html/boilerplate-express-mongo-react-shadcn-wsp.git`
2. **Implementación Específica del Cliente (Real Burger):** `https://github.com/luciano-html/realburgerst.git`

El sistema es un **B2B2C** con un backend en Node.js/Express, dos frontends en React/Vite (Admin y Store) usando `shadcn/ui`, base de datos MongoDB y automatización de WhatsApp web en el servidor.

---

## 2. Arquitectura de Datos (Mongoose)

### 2.1 StoreConfig (Configuración General)
Administrable por el dueño.
- `name`, `whatsapp`, `currency`
- **Delivery:** `deliveryZones` [{ name, cost, isActive }]
- **Cocina/Tiempos:** 
  - `basePrepTime` (minutos base, ej: 15)
  - `delayPerPendingOrder` (minutos extra por cada orden en cola, ej: 8)
  - `deliveryTimePerOrderInQueue` (minutos estáticos de demora extra por cliente en la cola del cadete, ej: 3)
  - `baseCourierTravelTime` (tiempo estimado de movimiento base del cadete, ej: 10)

### 2.2 Product & OptionGroups (Catálogo)
- `name`, `description`, `price`, `category`, `isActive`, `images`
- `optionGroups`: Arreglo para manejar combos y extras.
  - `name` (Ej: "Elegí tu bebida" o "Agregale un extra")
  - `minSelect` (Ej: 0, haciendo que la bebida en el combo pueda ser opcional)
  - `maxSelect` (Ej: 5 para bebidas, 99 para extras libres)
  - `options`: [{ `name`, `additionalPrice` (por defecto 0) }]

### 2.3 Order (Pedidos)
- `customerName`, `customerPhone`
- `orderType`: 'delivery' | 'takeaway'
- `deliveryZone`: Referencia a la zona elegida (si es delivery).
- `items`: 
  - `productId`, `quantity`, `unitPrice`
  - `selectedOptions`: [{ `groupName`, `optionName`, `additionalPrice` }]
  - `notes`: String libre por producto (Ej: "Sin cebolla"). **A nivel individual por cada producto.**
- `paymentMethod`: 'cash' | 'transfer'
- `discounts` / `surcharges` (Calculados al confirmar).
- `status`: `pending_payment` -> `pending` -> `in_preparation` -> `in_expedition` -> `dispatched` -> `delivered`/`cancelled`
- `estimatedTime`: Minutos calculados al momento del pedido.

---

## 3. Lógica de Negocio y Algoritmos

### 3.1 Algoritmo de Cálculo Dinámico de Tiempo (ETA)
Al ingresar un pedido, el sistema calculará la demora estimada sumando los cuellos de botella de Cocina y de Reparto (si aplica):

**1. Tiempo de Cocina (Prep Time):**
`ETA_Cocina = basePrepTime + (ÓrdenesActivasEnCocina * delayPerPendingOrder)`
*(Donde ÓrdenesActivasEnCocina son los pedidos en estado `pending` o `in_preparation`).*

**2. Tiempo de Envío (Delivery Time) - Solo si es Delivery:**
`ETA_Envío = baseCourierTravelTime + (ÓrdenesEnExpedición * deliveryTimePerOrderInQueue)`
*(Donde ÓrdenesEnExpedición son los pedidos listos esperando al cadete, sumando ej. 3 min por cliente en cola).*

**ETA TOTAL:** Si es Retiro por el local = `ETA_Cocina`. Si es Delivery = `ETA_Cocina + ETA_Envío`.
Este tiempo será devuelto al cliente y enviado por WhatsApp.

### 3.2 Automatización de WhatsApp (Triggers)
Se usará `whatsapp-web.js`. Estados que disparan mensajes:
1. **Nuevo Pedido (pending):** "Hola [Nombre], recibimos tu pedido. El tiempo estimado es de [ETA] minutos. Total a pagar: $[Total]."
2. **En Preparación (in_preparation):** "¡Tu pedido ya entró a la parrilla! Lo estamos preparando." *(Nota: Si el pago es transferencia, el empleado debe constatar el comprobante y pasar el pedido a este estado. El mensaje se disparará automáticamente con un delay de 2 minutos luego de este cambio).*
3. **Despachado / Salió (dispatched):**
   - Si es Delivery: "¡Tu pedido está en camino! Estate atento!!!"
   - Si es Takeaway: "¡Tu pedido está listo para retirar por el local! Estate atento!!!"

---

## 4. Frontends (UI/UX)

### 4.1 Storefront (Front de Clientes)
- **Hero & Landing:** Título y estado del local (Abierto/Cerrado). *(No se mostrarán las demoras globales aquí para no disuadir la venta temprana).*
- **Catálogo:** Filtros por categoría. Cards de productos usando shadcn.
- **Drawer/Sheet (Carrito):**
  - Switch: **Delivery** vs **Retiro por el local**.
  - Si Delivery -> Muestra select de Ciudad estática (Santo Tomé o Santa Fe) y luego un select dinámico de Barrios (zonas editables por el admin) para sumar al subtotal.
  - Listado de ítems con desglose de opciones elegidas y campo "Notas" individual.
  - Select de Medio de Pago.
  - **Recomendación UX (Acordada):** El ETA *NO* se mostrará en el carrito para no disuadir la venta. Se calculará y mostrará únicamente en la pantalla de éxito post-confirmación y en el ticket de WhatsApp.

### 4.2 Admin Dashboard (Backoffice)
- **Layout:** Sidebar inamovible (Dashboard, Catálogo, Pedidos Live, Historial de Ventas, Ganancias, Hojas de Ruta, Configuración).
- **Finanzas y Reportes:** 
  - *Historial de Ventas:* Tabla completa con todos los pedidos cerrados, filtros por fecha.
  - *Ganancias:* Módulo de métricas de facturación filtrable por día, mes y año.
- **Hojas de Ruta:** Módulo generador de rutas agrupando pedidos existentes para la expedición de los cadetes.
- **Pedidos (Live):** Tablero **Kanban (Drag & Drop)** interactivo *solo disponible en versión Desktop (PC)*. En versión Mobile, se renderizará como una lista de tarjetas simple. En ambos casos incluirá controles manuales para cambiar estados (`Pendiente de Pago`, `Pendiente`, `En preparación`, `Expedición`, `En camino`). El empleado usará esto para constatar comprobantes y avanzar el flujo.
- **Configuración:**
  - Lector de Código QR para enlazar WhatsApp. *(Alerta UI: "Se debe utilizar el teléfono definido por la empresa. Prohibido escanear números personales").* Se registrarán en BD las sesiones activas (número y fecha).
  - CRUD de Zonas de Envío y variables del algoritmo de ETA.

---

## 5. Estrategia de Versionado (Git Remotes)
Dado que está estrictamente prohibido que el agente ejecute commits automáticamente, se proveen los comandos que el humano (o el agente bajo orden explícita) ejecutará al finalizar la programación:

**Paso A: Guardar el Boilerplate Genérico**
```bash
git remote add boilerplate https://github.com/luciano-html/boilerplate-express-mongo-react-shadcn-wsp.git
git add .
git commit -m "feat: boilerplate consolidado B2B2C Hamburgueserías (SDD)"
git push boilerplate main
```

**Paso B: Guardar el Proyecto Real Burger**
```bash
git remote add origin https://github.com/luciano-html/realburgerst.git
git add .
git commit -m "feat: implementación específica Real Burger"
git push origin main
```
