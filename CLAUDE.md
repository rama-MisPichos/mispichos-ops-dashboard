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
| `src/app/components/DashboardClient.tsx` | Toda la UI (~3500 líneas). Componente "god" client-side |
| `src/lib/data/mockOpsDashboard.ts` | Mock + **tipos principales** (`OpsDashboardResponse`, `PetshopMetrics`, `ReprogramarRow`, etc.) |
| `src/app/globals.css` | Todos los estilos. Variables de tema, layout, componentes |
| `src/app/api/ops/dashboard/route.ts` | Único endpoint activo del dashboard |
| `src/app/api/ai/recommendations/route.ts` | POST con KPIs → prompt a Gemini → texto de recomendaciones |
| `src/app/components/AiRecommendations.tsx` | UI del asistente IA |
| `src/lib/domain/models.ts` + `src/lib/kpis/compute.ts` | Código legado (API `/summary` ya no se usa en la UI principal) |

### Patrones importantes en DashboardClient

**Fechas:** `from`/`to` se guardan como `YYYY-MM-DD`. `to` es **exclusivo** (se le suma 1 día al enviar a la API). Las fechas draft del date picker usan `draftFromYmd`/`draftToYmdInclusive` (inclusive).

**Filtro de petshop:** `petshopId === "ALL"` significa vista global (se suman todos los petshops). El selector `metricsSelected` es el `useMemo` que devuelve las métricas del petshop activo o la suma global.

**KPI thresholds:** definidos inline con `toneByRate(rate01, warnAt, badAt)` y `toneByHighIsBad`/`toneByLowIsBad`. Para cambiar umbrales, buscar el KPI específico en `DashboardClient.tsx`.

**Deltas vs ayer:** en mock no hay serie real de "ayer". Se usa `stableDeltaPctFor(key)` — hash determinístico de la key `petshopId|from|to|metrica` — para que los deltas sean estables por contexto sin cambiar en re-renders. `KPI_DELTA_BG` configura el modo (higher/lower better) y la banda neutral por KPI.

**Paginación:** `PAGE_SIZE = 5` para todas las tablas. Cada tabla tiene su propio estado de página. Las cuatro tablas de incidencias (reprogramar, sinDespachar, cancelados, cerradosManual) comparten una sola sección con selector `incidenciasTab`.

**Copiar/exportar:** `toFixedWidthTable` para Wpp, `toHtmlTable` para Mail (con fallback a texto plano), `toCsv` + `downloadTextFile` para Excel.

**Sidebar de accesos rápidos:** en desktop usa `qaDockOpen` (panel lateral) con animación vía `qaAnimClass` (`"qaEntering"` / `"qaExiting"`). En mobile usa `quickAccessOpen` (modal). Estado persistido en `localStorage` bajo la key `opsQuickAccess:dockOpen:v1`.

**LocalStorage keys:**
- `opsTheme:v1` — tema (dark/light)
- `opsQuickAccess:dockOpen:v1` — sidebar abierto/cerrado
- `opsQuickAccess:favorites:v1` — IDs de accesos favoritos (JSON array)

### Secciones del dashboard (IDs de anclaje)
`ops-live` → `capacidad` → `demoras` → `top3` → `sl-live` → `cancelados` → `spliteados` → `soluciones` → `estancados` → `incidencias`
