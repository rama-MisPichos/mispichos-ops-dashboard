"use client";

import { useState } from "react";
import type { OpsDashboardResponse } from "@/lib/data/mockOpsDashboard";

type Props = {
  data: OpsDashboardResponse | null;
  from: string;
  to: string;
};

function buildKpiSummary(data: OpsDashboardResponse, from: string, to: string) {
  const totalOrders = data.metricsByPetshop.reduce((s, m) => s + m.total, 0);
  const totalTransactions = data.metricsByPetshop.reduce((s, m) => s + m.transacciones, 0);
  const cancelados = data.metricsByPetshop.reduce((s, m) => s + m.cancel, 0);
  const spliteados = data.metricsByPetshop.reduce((s, m) => s + m.split, 0);
  const d1 = data.metricsByPetshop.reduce((s, m) => s + m.d1, 0);
  const d2 = data.metricsByPetshop.reduce((s, m) => s + m.d2, 0);
  const onTimeN = data.metricsByPetshop.reduce((s, m) => s + m.onTimeN, 0);
  const outTimeN = data.metricsByPetshop.reduce((s, m) => s + m.outTimeN, 0);
  const slBase = onTimeN + outTimeN;
  const slPct = slBase > 0 ? (onTimeN / slBase) * 100 : null;

  return {
    totalOrders,
    totalTransactions,
    reprogramar: {
      count: data.reprogramarRows.length,
      pct: totalOrders > 0 ? (data.reprogramarRows.length / totalOrders) * 100 : 0,
    },
    sinDespachar: { count: data.sinDespacharRows.length },
    estancados: { count: data.estancadosRows.length },
    demorado1ra: { count: d1 },
    demorado2da: { count: d2 },
    cancelados: {
      count: cancelados,
      pct: totalOrders > 0 ? (cancelados / totalOrders) * 100 : 0,
    },
    spliteados: {
      count: spliteados,
      pct: totalOrders > 0 ? (spliteados / totalOrders) * 100 : 0,
    },
    top3Petshops: data.top3Petshops.map((p) => ({
      name: p.petshopName,
      pct: p.pct,
      orders: p.orders,
    })),
    slPct,
    range: { from, to },
  };
}

export default function AiRecommendations({ data, from, to }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!data) return;
    setLoading(true);
    setError(null);
    setText(null);
    try {
      const summary = buildKpiSummary(data, from, to);
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Error al consultar la IA");
      } else {
        setText(json.text);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section" id="ai-recommendations" style={{ marginBottom: 0 }}>
      <div className="sectionHeader">
        <div>
          <h2>Asistente IA · Recomendaciones operativas</h2>
          <p>Análisis automático basado en los KPIs del período seleccionado</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={generate}
          disabled={loading || !data}
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          {loading ? "Analizando…" : text ? "Regenerar" : "Generar recomendaciones"}
        </button>
      </div>

      {!text && !loading && !error && (
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          Hacé click en "Generar recomendaciones" para que la IA analice los datos actuales y proponga acciones concretas.
        </p>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12 }}>
          <span className="pulseDot" aria-hidden="true" />
          Consultando IA…
        </div>
      )}

      {error && (
        <p style={{ color: "var(--bad)", fontSize: 12, margin: 0 }}>{error}</p>
      )}

      {text && (
        <div
          style={{
            background: "color-mix(in srgb, var(--surface) 60%, transparent)",
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            fontSize: 13,
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            marginTop: 4,
          }}
        >
          {text}
        </div>
      )}
    </section>
  );
}
