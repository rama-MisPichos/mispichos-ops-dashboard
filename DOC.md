# Ops Dashboard · Documentación de KPIs (Mis Pichos)

Este archivo documenta **qué significa cada KPI**, **cómo se calcula**, **de dónde sale el dato** y cuáles son los **umbrales de criticidad por color** (verde/naranja/rojo).

La idea es que cualquier persona (Ops, Producto, Data o Ingeniería) pueda entender el tablero sin abrir el código.

---

## Convenciones

- **Rango de fechas**: el dashboard trabaja con un rango `from`/`to` (ISO) que se envía a `GET /api/ops/dashboard`.
- **Petshop seleccionado**:
  - `ALL`: vista global (suma/agrupación de todos los petshops).
  - Un `petshopId`: vista filtrada.
- **Colores (criticidad)**:
  - **Verde**: OK.
  - **Naranja**: advertencia / revisar.
  - **Rojo**: crítico.
- **Nota sobre “%”**:
  - Cuando veas “\(x%\)” puede ser:
    - **Porcentaje sobre “Total pedidos”** (creadas), o
    - **Porcentaje sobre “Elegibles”** (creadas – canceladas), según el KPI.

---

## Fuentes de datos (hoy)

Por ahora, el tablero usa un **mock** para generar data (hasta integrar APIs reales).

- **Endpoint**: `GET /api/ops/dashboard?from=<iso>&to=<iso>`
- **Implementación mock**: `src/lib/data/mockOpsDashboard.ts`
- **UI principal**: `src/app/components/DashboardClient.tsx`

Cuando se conecte a datos reales, este documento debería mantenerse igual y solamente cambiará la fuente.

---

## KPIs · Órdenes de transacción (en vivo)

Esta sección muestra el estado operativo “en el momento” para el petshop seleccionado (o global).

### Total pedidos

- **Definición**: cantidad total de pedidos creados en el rango.
- **Campo**: `total`
- **Cálculo**: proviene directo del backend (hoy mock).

#### % vs ayer (delta)

- **Definición**: variación porcentual vs el día anterior.
- **Estado actual**: en el mock/UI está simulado.
- **Color**:
  - **Verde** si delta > 0
  - **Rojo** si delta < 0
  - **Gris** si delta = 0

> Al integrar datos reales, definir: ¿“ayer” es el día calendario anterior o “últimas 24h”?

---

### Transacciones

- **Definición**: pedidos que son “de transacción” (subset de `total`).
- **Campo**: `transacciones`
- **Cálculo**: proviene directo del backend (hoy mock).
- **Nota**: el criterio exacto de “transacción” lo define negocio (ej: canal, tipo de pedido, etc.).

---

### Sin despachar

- **Definición**: pedidos con etiqueta impresa/pendientes que todavía no fueron despachados.
- **Campo**: `sindesp`
- **Criticidad**: cuanto mayor el ratio, peor.
- **Ratio**: `sindesp / total`
- **Umbrales actuales (editables)**:
  - **Verde**: < 3%
  - **Naranja**: ≥ 3% y < 6%
  - **Rojo**: ≥ 6%
- **Dónde se cambia**: `DashboardClient.tsx` → `toneByRate(..., warnAt, badAt)` del KPI “Sin despachar”.

---

### Demorados 1ra vuelta (D1)

- **Definición**: pedidos demorados en la primera vuelta (primer intento/primera etapa operativa).
- **Campos**:
  - `d1` (cantidad)
  - `d1pct` (porcentaje sobre `total`)
- **Cálculo de porcentaje**: `d1pct = (d1 / total) * 100`
- **Criticidad**: cuanto mayor, peor.
- **Umbrales actuales (editables)**:
  - **Verde**: < 3%
  - **Naranja**: ≥ 3% y < 6%
  - **Rojo**: ≥ 6%
- **Dónde se cambia**: `DashboardClient.tsx` → KPI “Demorados 1ra vuelta”.

---

### Demorados 2da vuelta (D2)

- **Definición**: pedidos demorados en la segunda vuelta (reintentos/segunda etapa operativa).
- **Campos**:
  - `d2` (cantidad)
  - `d2pct` (porcentaje sobre `total`)
- **Cálculo de porcentaje**: `d2pct = (d2 / total) * 100`
- **Criticidad**: cuanto mayor, peor.
- **Umbrales actuales (editables)**:
  - **Verde**: < 1.5%
  - **Naranja**: ≥ 1.5% y < 3%
  - **Rojo**: ≥ 3%
- **Dónde se cambia**: `DashboardClient.tsx` → KPI “Demorados 2da vuelta”.

---

### Reprogramar

- **Definición**: pedidos que superaron 48hs sin gestión y requieren reprogramación.
- **Campo**: `reprog`
- **Criticidad**: cuanto mayor el ratio, peor.
- **Ratio**: `reprog / total`
- **Umbrales actuales (editables)**:
  - **Verde**: < 2%
  - **Naranja**: ≥ 2% y < 4%
  - **Rojo**: ≥ 4%
- **Dónde se cambia**: `DashboardClient.tsx` → KPI “Reprogramar”.

---

### Cancelados

- **Definición**: pedidos cancelados en el rango.
- **Campos**:
  - `cancel` (cantidad)
  - `cancelPct` (porcentaje sobre `total`)
- **Cálculo de porcentaje**: `cancelPct = (cancel / total) * 100`
- **Criticidad**: cuanto mayor, peor.
- **Umbrales actuales (editables)**:
  - **Verde**: < 2%
  - **Naranja**: ≥ 2% y < 4%
  - **Rojo**: ≥ 4%
- **Dónde se cambia**: `DashboardClient.tsx` → KPI “Cancelados”.

---

## Motivos de cancelación

- **Definición**: distribución de los cancelados por “motivo”.
- **Motivos**: preconfigurados.
- **Fuente**: por petshop se entrega `cancelReasons[]`.
- **Vista global**: se agregan (suman) los conteos de todos los petshops.

### Motivos configurados (hoy)

Se pueden editar en `src/lib/data/mockOpsDashboard.ts` (constante `CANCELLATION_REASONS`).

- Cliente no estaba
- Dirección incorrecta
- Sin stock
- Pago rechazado
- Petshop cerrado
- Error operativo

---

## Estancados (casos aislados)

- **Definición**: pedidos “aislados” que quedan trabados y requieren intervención.
- **Regla operativa**: cuando **ningún petshop toma el pedido**, se deriva a **Mis Pichos**.
- **Estado actual (mock)**: se genera **un único registro** estancado y queda asignado a **Mis Pichos** con producto `Derivado (sin petshop) · ...`.

---

## Service level (SL)

### SL %

- **Definición**: porcentaje de entregadas sobre creadas.
- **Fórmula**: `SL = (delivered / total) * 100`
- **Campos**:
  - `delivered`
  - `total`
  - `slPct`
- **Estados (tabla SL)**:
  - **OK**: SL ≥ 90
  - **Revisar**: SL ≥ 85 y < 90
  - **Crítico**: SL < 85

> Si la definición de SL cambia (por ejemplo excluyendo canceladas), documentarlo acá y actualizar el backend/UI.

---

## Entregas a tiempo

- **Definición**: entregas “a tiempo” vs “fuera de tiempo”.
- **Base de comparación**: **creadas no canceladas**.
- **Campos**:
  - `onTimeN`, `outTimeN`
  - `onTimePct`, `outTimePct`
- **Elegibles**: `eligible = total - cancel`
- **Fórmulas**:
  - `onTimePct = (onTimeN / eligible) * 100`
  - `outTimePct = (outTimeN / eligible) * 100`

---

## Capacidad logística

### Flex / Franja corta

- **Definición**: utilización vs límite diario.
- **Campos**:
  - Límites: `capacityLimits.flexPerDay`, `capacityLimits.franjaPerDay`
  - Uso horario: `capacityFlexHourly[]`, `capacityFranjaHourly[]`
- **Interpretación**: cuanto más cerca del límite, peor.
- **Colores actuales** (utilización):
  - **Verde**: < 70%
  - **Naranja**: ≥ 70% y ≤ 90%
  - **Rojo**: > 90%

---

## Dónde editar umbrales de criticidad (rápido)

Hoy los umbrales están definidos “inline” en `src/app/components/DashboardClient.tsx` dentro de cada KPI.

Helpers usados:

- `toneByRate(rate01, warnAt, badAt)`:
  - `rate01`: ratio entre 0 y 1 (por ejemplo `cancelPct / 100` o `cancel/total`)
  - `warnAt`: umbral donde empieza Naranja
  - `badAt`: umbral donde empieza Rojo

Recomendación futura: mover todos los umbrales a un objeto único (por ejemplo `KPI_THRESHOLDS`) para editar todo desde un solo lugar.

---

## Checklist para mantener esta documentación actualizada

Cuando se agregue o cambie un KPI:

- Actualizar **Definición**
- Actualizar **Fórmula**
- Confirmar **denominador** (total vs elegibles)
- Actualizar **umbrales y colores**
- Agregar **ejemplo operativo** si es un KPI “nuevo” o poco obvio

