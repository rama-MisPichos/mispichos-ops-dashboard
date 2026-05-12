# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev      # servidor de desarrollo en localhost:3000
npm run build    # build de producción
npm run lint     # ESLint con next lint
```

No hay test suite. TypeScript se verifica con `npx tsc --noEmit`.

## Qué es este proyecto

Dashboard de operaciones para MisPichos (empresa de delivery de productos para mascotas en Argentina). Muestra KPIs logísticos en tiempo real: pedidos, service level, cancelados, capacidad, demoras, etc. Actualmente usa **datos mock** hasta que se integre el Core API real.

Requiere `GEMINI_API_KEY` en `.env.local` para el módulo de recomendaciones IA (usa Gemini 2.0 Flash Lite).

## Arquitectura

### Stack
- Next.js 16 (App Router), React 19, TypeScript — sin CSS modules ni Tailwind
- Todo el estilo vive en `src/app/globals.css` con CSS custom properties (`--surface`, `--bad`, `--warn`, etc.)
- Sin librerías de charts: todos los gráficos (Doughnut, VerticalBars, BarList, LineMini, etc.) son componentes inline en `DashboardClient.tsx`

### Flujo de datos
```
GET /api/ops/dashboard?from=&to=
  → getMockOpsDashboard() en mockOpsDashboard.ts
  → devuelve OpsDashboardResponse
  → DashboardClient lo consume con fetch en useEffect([from, to])
  → metricsByPetshop[] se agrega/filtra vía useMemo según petshopId seleccionado
```

**Para integrar el Core API real:** reemplazar `src/lib/data/mockOpsDashboard.ts` con un adaptador que devuelva `OpsDashboardResponse`. El contrato de tipos no debe cambiar.

### Archivos clave

| Archivo | Rol |
|---|---|
| `src/app/components/DashboardClient.tsx` | Toda la UI (~4200 líneas). Componente "god" client-side |
| `src/lib/data/mockOpsDashboard.ts` | Mock + **tipos principales** (`OpsDashboardResponse`, `PetshopMetrics`, `ReprogramarRow`, `VueltaRow`, etc.) |
| `src/app/globals.css` | Todos los estilos. Variables de tema, layout, componentes |
| `src/app/api/ops/dashboard/route.ts` | Único endpoint activo del dashboard |
| `src/app/api/ai/recommendations/route.ts` | POST con KPIs → prompt a Gemini → texto de recomendaciones |
| `src/app/components/AiRecommendations.tsx` | UI del asistente IA |
| `src/lib/domain/models.ts` + `src/lib/kpis/compute.ts` | Código legado (API `/summary` ya no se usa en la UI principal) |

### Patrones importantes en DashboardClient

**Fechas:** `from`/`to` se guardan como `YYYY-MM-DD`. `to` es **exclusivo** (se le suma 1 día al enviar a la API). Las fechas draft del date picker usan `draftFromYmd`/`draftToYmdInclusive` (inclusive).

**Filtro de petshop:** `petshopId === "ALL"` significa vista global (se suman todos los petshops). El selector `metricsSelected` es el `useMemo` que devuelve las métricas del petshop activo o la suma global.

**KPI thresholds:** definidos inline con `toneByRate(rate01, warnAt, badAt)` y `toneByHighIsBad`/`toneByLowIsBad`. Para cambiar umbrales, buscar el KPI específico en `DashboardClient.tsx`.

**Deltas / comparación de períodos:** el sistema tiene dos capas:
1. `stableDeltaPctFor(key)` — hash determinístico usado como fallback mock (nunca debe quedar como única fuente cuando haya datos reales).
2. **Datos reales del período anterior** — `activePrevPeriod` calcula `prevFrom`/`prevTo` y se hace un segundo fetch a la misma API. Los deltas se calculan como `((current - prev) / |prev|) * 100`. `KPI_DELTA_BG` configura el modo (higher/lower better) y la banda neutral por KPI.

**Modos de comparación (`compareMode`):** selector "Comparar" en el chipRow con 4 opciones:
- `"daily"` — período previo = misma ventana de días desplazada hacia atrás (1 día → "vs día ant.", N días → "vs período ant.")
- `"weekly"` — esta semana (desde el lunes) vs la semana anterior. Auto-setea `from`/`to`.
- `"biweekly"` — las últimas 2 semanas vs las 2 semanas previas. Auto-setea `from`/`to`.
- `"monthly"` — este mes calendario vs el mes anterior. Auto-setea `from`/`to`.

Cuando el usuario cambia el rango manualmente desde el calendario, `compareMode` se resetea a `"daily"`. `presetPeriod` calcula los rangos para weekly/biweekly/monthly; `activePrevPeriod` los unifica con daily y es el que dispara el fetch de `prevData`. `prevMetricsAll` y `prevMetricsSelected` replican la misma lógica de agregación que `metricsAll`/`metricsSelected` pero sobre `prevData`. `DeltaPill` acepta `vsLabel` opcional (default `"ayer"`) que se propaga desde `activePrevPeriod.vsLabel`.

**Service Level eliminado:** la columna SL% fue removida del dashboard por decisión de negocio. Quedan `onTimeTone`, `onTimeStatus`, `badgeClassByOnTime` y `SlProgress` (ahora basado en on-time %). Las funciones `slTone`/`slStatus`/`badgeClassBySl` ya no existen.

**Paginación:** `PAGE_SIZE = 5` para todas las tablas. Cada tabla tiene su propio estado de página. Las tablas de incidencias (reprogramar, sinDespachar, cancelados, cerradosManual, vuelta1, vuelta2) comparten una sola sección con selector `incidenciasTab`.

**Tipos de incidencias disponibles en `incidenciasTab`:** `"reprogramar" | "sinDespachar" | "cancelados" | "cerradosManual" | "vuelta1" | "vuelta2"`. Los rows de vuelta (`VueltaRow`) tienen `attemptAt` (timestamp del intento) y `waitHours`. 1ra vuelta = intento hace 24–48hs; 2da vuelta = intento hace >48hs. Colores de horas: vuelta1 warn≥24h bad>36h; vuelta2 warn≥48h bad>72h.

**Gráfico de capacidad horaria (`LineHourly`):** reemplaza al anterior `LineMini` (que usaba datos diarios). Usa `capacity.flex.hourly` / `capacity.franja.hourly` rellenados con `fillHours24()`. Tiene hover interactivo (tooltip con hora y % usado), marcador de hora actual, área fill y etiquetas en eje X cada ~4 horas.

**Copiar/exportar:** `toFixedWidthTable` para Wpp, `toHtmlTable` para Mail (con fallback a texto plano), `toCsv` + `downloadTextFile` para Excel.

**Sidebar de accesos rápidos:** en desktop usa `qaDockOpen` (panel lateral) con animación vía `qaAnimClass` (`"qaEntering"` / `"qaExiting"`). Funciones `openQaSidebar` / `closeQaSidebar` / `toggleQaSidebar` manejan el timer de animación con `qaTimerRef`. En mobile usa `quickAccessOpen` (modal). El botón `qaToggleBtn` está en el topbar, antes del título. Estado persistido en `localStorage` bajo la key `opsQuickAccess:dockOpen:v1`.

**Autenticación:** login básico vía `DASHBOARD_USER` / `DASHBOARD_PASSWORD` en `.env.local`. El endpoint `/api/auth/login` valida credenciales. Sin esas variables el fallback es `ops` / `mispichos2025`.

**LocalStorage keys:**
- `opsTheme:v1` — tema (dark/light)
- `opsQuickAccess:dockOpen:v1` — sidebar abierto/cerrado
- `opsQuickAccess:favorites:v1` — IDs de accesos favoritos (JSON array)

### Secciones del dashboard (IDs de anclaje)
`ops-live` → `capacidad` → `demoras` → `top3` → `sl-live` → `cancelados` → `spliteados` → `soluciones` → `estancados` → `incidencias`

### Integración con Core API real
Reemplazar la llamada a `getMockOpsDashboard()` en `src/app/api/ops/dashboard/route.ts` por un adaptador que devuelva `OpsDashboardResponse`. El contrato de tipos **no debe cambiar**.

**Invariantes (el adaptador debe cumplirlas):** ver `validateOpsDashboardResponse` y `validatePetshopMetrics` en `src/lib/data/opsDashboardValidate.ts`. Resumen por petshop: `newClients + recurrentClients === total`; `newTransactions + recurrentTransactions === transacciones`; `onTimeN + outTimeN === delivered`; `onTimeTx + outTimeTx === transacciones`; `onTimeShort1014N + … + onTimeFlex1422N === onTimeN`; `sum(cancelReasons.count) === cancel`; `cancelNewVsRec.new + recurrent === cancel`; `delivered <= total - cancel`. A nivel global: cada serie en `timelineDaily[]` debe sumar la suma del mismo campo en `metricsByPetshop[]` (el mock reparte por día con los mismos pesos para correlación). En desarrollo, llamar `validateOpsDashboardResponse(data)` antes del `NextResponse.json` y loguear o fallar si hay errores.

**Mock:** `getMockOpsDashboard(from, to)` usa semilla `fnv1a32(from|to)` (datos reproducibles por rango). Las filas de incidencias usan `deliveryWindow` acorde a `petshops[].capacity` del mismo petshop.

Campos clave por orden de prioridad de integración:
1. `metricsByPetshop[]` — agrega todos los KPIs de la sección superior
2. `reprogramarRows`, `sinDespacharRows`, `canceladosRows`, `cerradosManualmenteRows`, `vuelta1Rows`, `vuelta2Rows` — tablas de incidencias
3. `capacity` (a través de `capacityFlexHourly`, `capacityFranjaHourly`, `capacityAssignedNext7`) — sección de capacidad
4. `petshops[]` — selector de petshop y capacidad configurada
