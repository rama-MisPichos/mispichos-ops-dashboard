# Métricas y KPIs del Dashboard Operativo — MisPichos

Documento de referencia para el equipo de negocio. Describe qué mide cada indicador, cómo se calcula, con qué se compara y cuándo se considera saludable o crítico.

---

## Índice

1. [Sección principal — En vivo](#1-sección-principal--en-vivo)
2. [Capacidad logística](#2-capacidad-logística)
3. [Demoras — 1ra y 2da vuelta](#3-demoras--1ra-y-2da-vuelta)
4. [Top 3 petshops](#4-top-3-petshops)
5. [Resumen operativo por petshop](#5-resumen-operativo-por-petshop)
6. [Cancelados](#6-cancelados)
7. [Spliteados](#7-transacciones-spliteadas)
8. [Soluciones / Devoluciones / Retiros](#8-soluciones--devoluciones--retiros)
9. [Estancados y cierres manuales](#9-estancados-y-cierres-manuales)
10. [Incidencias — tablas de registros](#10-incidencias--tablas-de-registros)
11. [Sistema de comparación de períodos](#11-sistema-de-comparación-de-períodos)
12. [Glosario de términos operativos](#12-glosario)

---

## 1. Sección principal — En vivo

Esta sección es la primera pantalla del dashboard. Muestra el estado agregado del período seleccionado.

### Total pedidos (órdenes)

| Campo | Detalle |
|---|---|
| **Qué mide** | Cantidad total de órdenes de compra creadas en el período |
| **Unidad** | Número absoluto |
| **Comparación** | Período anterior equivalente (ver sección 11) |
| **Color de fondo** | Verde si sube, rojo si baja (higher is better) |
| **Banda neutral** | ±1% — cambios menores no se colorean |

> Una orden puede contener una o varias transacciones (tickets). Total pedidos ≠ total transacciones.

---

### Transacciones (tickets)

| Campo | Detalle |
|---|---|
| **Qué mide** | Cantidad de tickets individuales procesados |
| **Unidad** | Número absoluto |
| **Relación** | Una orden puede tener múltiples transacciones. Spliteados se mide sobre transacciones, no sobre órdenes |

---

### GMV (Gross Merchandise Value)

| Campo | Detalle |
|---|---|
| **Qué mide** | Monto total vendido en el período (en ARS) |
| **Unidad** | Pesos argentinos |
| **Cálculo** | Suma del GMV reportado por cada petshop |

---

### On-time

| Campo | Detalle |
|---|---|
| **Qué mide** | % de entregas realizadas dentro del tiempo acordado |
| **Fórmula** | `onTimeN / (onTimeN + outTimeN) × 100` |
| **Umbral verde** | ≥ 90% |
| **Umbral amarillo** | 85% – 89% |
| **Umbral rojo** | < 85% |
| **Comparación** | Período anterior equivalente (higher is better) |
| **Banda neutral** | ±1% |

> `onTimeN` = entregas a tiempo. `outTimeN` = entregas fuera de tiempo. No incluye cancelados.

---

### Demorado sin despachar

| Campo | Detalle |
|---|---|
| **Qué mide** | Pedidos con etiqueta impresa hace más de 24hs que aún no fueron tomados por un driver |
| **Criterio** | `labelPrintedAt` existe + `driverTakenAt` no existe + más de 24hs transcurridas |
| **Umbral verde** | < 8% sobre total de pedidos |
| **Umbral amarillo** | 8% – 19% |
| **Umbral rojo** | ≥ 20% |
| **Comparación** | Período anterior equivalente (lower is better) |
| **Color en tabla** | Naranja si >24hs, rojo si >28hs |

---

### 1ra vuelta

| Campo | Detalle |
|---|---|
| **Qué mide** | Pedidos cuyo primer intento de entrega fue hace más de 24hs sin resolución |
| **Criterio** | `firstAttemptAt` existe + entre 24hs y 48hs transcurridas desde el intento |
| **Umbral verde** | < 8% sobre total |
| **Umbral amarillo** | 8% – 19% |
| **Umbral rojo** | ≥ 20% |
| **Comparación** | Período anterior equivalente (lower is better) |

---

### 2da vuelta

| Campo | Detalle |
|---|---|
| **Qué mide** | Pedidos cuyo segundo intento de entrega fue hace más de 48hs sin resolución |
| **Criterio** | `secondAttemptAt` existe + más de 48hs transcurridas |
| **Umbral verde** | < 8% sobre total |
| **Umbral amarillo** | 8% – 19% |
| **Umbral rojo** | ≥ 20% |
| **Comparación** | Período anterior equivalente (lower is better) |

---

### Cancelados

| Campo | Detalle |
|---|---|
| **Qué mide** | Cantidad de órdenes canceladas en el período |
| **Umbral verde** | < 2% sobre total de órdenes |
| **Umbral amarillo** | 2% – 3,9% |
| **Umbral rojo** | ≥ 4% |
| **Comparación** | Período anterior equivalente (lower is better) |

---

### Reprogramar

| Campo | Detalle |
|---|---|
| **Qué mide** | Pedidos programados para una fecha que ya superó las 48hs sin gestión |
| **Criterio** | `scheduledFor` existe + más de 48hs transcurridas desde esa fecha |
| **Umbral verde** | < 8% sobre total |
| **Umbral amarillo** | 8% – 19% |
| **Umbral rojo** | ≥ 20% |
| **Comparación** | Período anterior equivalente (lower is better) |

---

## 2. Capacidad logística

Muestra el uso actual de la capacidad disponible de despacho por tipo de servicio.

### Flex (14–22)

| Campo | Detalle |
|---|---|
| **Qué mide** | Pedidos asignados a la franja flexible 14–22hs vs el límite configurado por petshop |
| **Cálculo del límite** | Suma de `flexPerDay` de todos los petshops con `flexEnabled = true` |
| **Cálculo del usado** | Suma de los pedidos horarios asignados a franja flex |
| **Umbral naranja** | ≥ 90% del límite |
| **Umbral rojo** | ≥ 95% del límite |
| **Gráfico** | Línea horaria (0–23hs) del día actual. Hover muestra hora exacta, cantidad usada y % sobre límite |

---

### Franja corta (10–14, 14–18, 18–22)

| Campo | Detalle |
|---|---|
| **Qué mide** | Pedidos en franjas cortas vs el límite agregado habilitado |
| **Cálculo del límite** | Suma de `shortPerWindow × cantVentanasHabilitadas` por petshop |
| **Umbral naranja** | ≥ 90% del límite |
| **Umbral rojo** | ≥ 95% del límite |
| **Gráfico** | Línea horaria (0–23hs). Misma interactividad que Flex |

---

### Capacidad asignada próximos 7 días

Tabla que muestra, para los próximos días, cuánta capacidad ya está reservada (pedidos con fecha futura asignada) vs el límite disponible. Permite anticipar días de alta demanda.

---

## 3. Demoras — 1ra y 2da vuelta

Gráfico de barras comparativo por petshop que muestra la tasa de 1ra y 2da vuelta. Complementa los KPIs de la sección principal con el detalle por petshop.

| Vuelta | Criterio |
|---|---|
| 1ra vuelta | `firstAttemptAt` hace entre 24 y 48hs |
| 2da vuelta | `secondAttemptAt` hace más de 48hs |

---

## 4. Top 3 petshops

| Campo | Detalle |
|---|---|
| **Qué mide** | Los 3 petshops con mayor volumen de órdenes en el período |
| **Cálculo** | `orders / totalOrders × 100` para obtener el % de participación |
| **Fuente** | Campo `top3Petshops` del response de la API |

---

## 5. Resumen operativo por petshop

Tabla que muestra por fila cada petshop activo con las siguientes columnas:

| Columna | Qué muestra |
|---|---|
| **Creadas** | Total de órdenes en el período |
| **Entregadas** | Órdenes efectivamente entregadas |
| **On-time** | % entregas a tiempo + cantidad absoluta |
| **Out-time** | % entregas fuera de tiempo + cantidad absoluta |
| **Cancelados** | % cancelados + cantidad absoluta |
| **Progreso** | Barra de color basada en el % on-time del petshop |
| **Estado** | Badge OK / Revisar / Crítico basado en on-time |

### Umbrales Estado por petshop

| Estado | Condición |
|---|---|
| **OK** (verde) | On-time ≥ 90% |
| **Revisar** (naranja) | On-time entre 85% y 89% |
| **Crítico** (rojo) | On-time < 85% |

> La columna SL% fue eliminada del dashboard por decisión de negocio. El indicador vigente de performance de entrega es **On-time**.

---

## 6. Cancelados

### KPI de cancelados por petshop

Gráfico de barras con el % de cancelaciones de cada petshop. Mismo umbral que la sección principal (verde <2%, amarillo 2–4%, rojo ≥4%).

### Motivos de cancelación

Los registros de cancelados incluyen uno de los siguientes motivos:

| Motivo | Descripción |
|---|---|
| `mispichos_fault` | Culpa de MisPichos |
| `no_payment` | Falta de pago |
| `duplicate_purchase` | Compra duplicada |
| `petshop_fault` | Culpa del petshop |
| `customer_regrets` | Cliente se arrepiente |

### Monto cancelado (ARS)

Muestra el GMV perdido por cancelaciones. Se calcula como la suma de `amountArs` de cada cancelación en el período.

### Nuevos vs Recurrentes cancelados

Doughnut que divide los cancelados entre clientes nuevos y recurrentes, para identificar si el problema afecta más a la retención o a la adquisición.

---

## 7. Transacciones spliteadas

| Campo | Detalle |
|---|---|
| **Qué mide** | Transacciones que fueron divididas (split) entre múltiples proveedores o entregas |
| **Base de cálculo** | Sobre **transacciones**, no sobre órdenes |
| **Fórmula** | `split / transacciones × 100` |
| **Visualización** | Donut + barras por petshop |

> Los splits son normales en ciertos flujos. No tienen umbral de alerta configurado actualmente — se monitorean como tendencia.

---

## 8. Soluciones / Devoluciones / Retiros

Métricas de post-venta agrupadas en una sola sección.

| Métrica | Qué representa |
|---|---|
| **Soluciones** | Casos resueltos a favor del cliente (reenvío, reembolso, etc.) |
| **Devoluciones** | Productos devueltos por el cliente |
| **Retiros** | Retiros de productos desde el domicilio del cliente |

Se muestran como barras comparativas por petshop para identificar cuál genera más carga post-venta.

---

## 9. Estancados y cierres manuales

### Estancados

| Campo | Detalle |
|---|---|
| **Qué mide** | Pedidos asignados a MisPichos que no tienen un petshop asignado aún |
| **Criterio** | `misPichosAssignedAt` existe + `petchopAssignedAt` no existe |
| **Acción esperada** | Asignar el pedido manualmente a un petshop |

### Cierres manuales (últimos 7 días)

Gráfico de barras con la cantidad de pedidos cerrados manualmente por día en la última semana. Cada cierre incluye una nota del motivo.

Motivos frecuentes: cliente no responde, dirección inválida, pago pendiente, reasignación manual, stock no confirmado.

---

## 10. Incidencias — tablas de registros

Sección unificada con todas las listas operativas. Se navega con un selector desplegable:

| Tab | Qué muestra | Columnas clave |
|---|---|---|
| **Pedidos a reprogramar** | Pedidos con >48hs desde `scheduledFor` | #pedido, fecha, franja, cliente, domicilio, producto, petshop |
| **Demorado sin despachar** | Etiqueta impresa >24hs sin driver | + Horas de espera (naranja >24h, rojo >28h) |
| **Cancelados** | Todos los cancelados del período | + Motivo de cancelación |
| **Cerrados manualmente** | Cierres manuales | + Nota del cierre |
| **1ra vuelta (>24hs)** | Primer intento sin resolución | + Horas desde el intento (naranja ≥24h, rojo >36h) |
| **2da vuelta (>48hs)** | Segundo intento sin resolución | + Horas desde el intento (naranja ≥48h, rojo >72h) |

Cada tab tiene paginación de 5 registros por página y botones para copiar al portapapeles (formato Wpp / Mail) o descargar en Excel (.csv).

---

## 11. Sistema de comparación de períodos

El dashboard compara siempre el período actual con un período anterior equivalente. El texto de los indicadores muestra el resultado ("vs día ant.", "vs sem. ant.", etc.).

### Modos de comparación

| Modo | Período actual | Período comparado | Texto en pantalla |
|---|---|---|---|
| **Diario** (1 día seleccionado) | El día elegido | El día anterior | `vs día ant.` |
| **Personalizado** (N días) | El rango seleccionado | Los mismos N días antes | `vs período ant.` |
| **Semanal** | Desde el lunes de esta semana hasta hoy | La semana anterior completa | `vs sem. ant.` |
| **Quincenal** | Desde el lunes de hace 7 días hasta hoy | Las 2 semanas previas | `vs quincena ant.` |
| **Mensual** | Desde el 1ro del mes hasta hoy | El mes calendario anterior completo | `vs mes ant.` |

### Cómo usar el selector

El selector **"Comparar"** está en la barra superior del dashboard. Al seleccionar Semanal, Quincenal o Mensual, el rango de fechas del calendario se actualiza automáticamente. Si el usuario cambia el rango manualmente desde el calendario, el modo vuelve a "Diario".

### Cómo se calculan los deltas

```
delta% = ((valor_actual - valor_anterior) / |valor_anterior|) × 100
```

- Verde con flecha ↗ = mejora (según si el KPI es "higher is better" o "lower is better")
- Rojo con flecha ↘ = empeora
- Gris con flecha → = cambio menor al 1% (banda neutral)

### Dirección de mejora por KPI

| KPI | Mejora si... |
|---|---|
| Total pedidos | Sube |
| On-time | Sube |
| Demorado sin despachar | Baja |
| 1ra vuelta | Baja |
| 2da vuelta | Baja |
| Cancelados | Baja |
| Reprogramar | Baja |

---

## 12. Glosario

| Término | Definición |
|---|---|
| **Orden / Pedido** | Compra realizada por un cliente. Puede contener una o varias transacciones |
| **Transacción / Ticket** | Unidad de venta individual dentro de una orden |
| **GMV** | Gross Merchandise Value — monto total facturado en el período |
| **Franja Flex** | Ventana de entrega amplia: 14:00 a 22:00hs |
| **Franja corta** | Ventanas de entrega de 4hs: 10–14, 14–18, 18–22 |
| **On-time** | Entrega realizada dentro del tiempo acordado con el cliente |
| **Out-time** | Entrega fuera del tiempo acordado |
| **Split** | Transacción dividida entre múltiples proveedores o entregas |
| **Reprogramar** | Pedido que superó su fecha programada y requiere nueva asignación |
| **Demorado sin despachar** | Etiqueta generada pero driver no asignado en más de 24hs |
| **Estancado** | Pedido asignado a MisPichos sin petshop asignado aún |
| **1ra vuelta** | Primer intento de entrega fallido hace más de 24hs |
| **2da vuelta** | Segundo intento de entrega fallido hace más de 48hs |
| **Cierre manual** | Pedido cerrado de forma manual por operaciones con una nota |
| **Período anterior** | Rango de fechas equivalente al período actual, desplazado hacia atrás |
