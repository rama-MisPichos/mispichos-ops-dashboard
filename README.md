# MisPichos Ops Dashboard (MVP)

Dashboard de Operaciones para toma de decisiones (KPIs + semáforos + drill-down), construido con Next.js y **datos mock** por ahora.

## Ejecutar

```bash
cd MisPichos-ops-dashboard
npm run dev
```

Luego abrir `http://localhost:3000`.

## Endpoint interno (mock)
- `GET /api/ops/summary`: devuelve cards + listas (reprogramar, sin despachar).

## Documentación

- `OPS_DASHBOARD_DOCUMENTACION.md`: definiciones de KPIs, fórmulas y umbrales de criticidad.

## Próximo paso (cuando conectemos al Core API)
Reemplazar `src/lib/data/mockOperationsData.ts` por un adaptador que consuma el Core API y normalice al modelo de `src/lib/domain/models.ts`.

