"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OpsDashboardResponse, PetshopMetrics, SinDespacharRow } from "@/lib/data/mockOpsDashboard";

function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round0(n: number) {
  return Math.round(n);
}

function pct(n: number, d: number) {
  return d <= 0 ? 0 : (n / d) * 100;
}

function formatPct0(n: number) {
  return `${round0(n)}%`;
}

function badgeClassBySl(slPct: number) {
  if (slPct >= 90) return "pill badgeOk";
  if (slPct >= 85) return "pill badgeWarn";
  return "pill badgeBad";
}

function slStatus(slPct: number) {
  if (slPct >= 90) return "OK";
  if (slPct >= 85) return "Revisar";
  return "Crítico";
}

function SlProgress({ slPct }: { slPct: number }) {
  const w = clamp(slPct, 0, 100);
  const color = slPct >= 90 ? "var(--ok)" : slPct >= 85 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="bar" aria-hidden="true">
      <div style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

function Doughnut({
  aLabel,
  aValue,
  aColor,
  bLabel,
  bValue,
  bColor,
}: {
  aLabel: string;
  aValue: number;
  aColor: string;
  bLabel: string;
  bValue: number;
  bColor: string;
}) {
  const total = Math.max(1, aValue + bValue);
  const aPct = aValue / total;

  const r = 42;
  const c = 2 * Math.PI * r;
  const aStroke = c * aPct;

  return (
    <div className="donutWrap">
      <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Doughnut">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={aColor}
          strokeWidth="14"
          strokeDasharray={`${aStroke} ${c - aStroke}`}
          strokeDashoffset={c * 0.25}
          strokeLinecap="butt"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={bColor}
          strokeWidth="14"
          strokeDasharray={`${c - aStroke} ${aStroke}`}
          strokeDashoffset={c * 0.25 - aStroke}
          strokeLinecap="butt"
        />
      </svg>
      <div className="donutLegend">
        <div className="donutLegendItem">
          <span className="legendSwatch" style={{ background: aColor }} />
          <div>
            <div className="legendTop">
              <span>{aLabel}</span>
              <span className="mono">{aValue}</span>
            </div>
            <div className="sub">{formatPct0((aValue / total) * 100)}</div>
          </div>
        </div>
        <div className="donutLegendItem">
          <span className="legendSwatch" style={{ background: bColor }} />
          <div>
            <div className="legendTop">
              <span>{bLabel}</span>
              <span className="mono">{bValue}</span>
            </div>
            <div className="sub">{formatPct0((bValue / total) * 100)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarList({
  items,
  color,
}: {
  items: { id: string; label: string; valuePct: number; count?: number }[];
  color: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.valuePct));
  return (
    <div className="barList">
      {items.map((it) => (
        <div key={it.id} className="barRow">
          <div className="barRowLabel">{it.label}</div>
          <div className="barRowBar">
            <div style={{ width: `${(it.valuePct / max) * 100}%`, background: color }}>
              <span className="mono">
                {formatPct0(it.valuePct)}
                {typeof it.count === "number" ? ` · ${it.count.toLocaleString("es-AR")}` : ""}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VerticalBars({
  items,
  color,
  valueFormatter,
}: {
  items: { id: string; label: string; value: number }[];
  color: string;
  valueFormatter?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="vbars">
      {items.map((it) => (
        <div key={it.id} className="vbarItem" title={`${it.label}: ${valueFormatter ? valueFormatter(it.value) : it.value}`}>
          <div className="vbarValue mono">{valueFormatter ? valueFormatter(it.value) : it.value}</div>
          <div className="vbar">
            <div style={{ height: `${(it.value / max) * 100}%`, background: color }} />
          </div>
          <div className="vbarLabel">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function StackedBars({
  items,
  series,
}: {
  items: { id: string; label: string; values: Record<string, number> }[];
  series: { key: string; label: string; color: string }[];
}) {
  const max = Math.max(1, ...items.map((it) => series.reduce((acc, s) => acc + (it.values[s.key] ?? 0), 0)));
  return (
    <div className="stackedBars">
      {items.map((it) => (
        <div key={it.id} className="stackedRow">
          <div className="stackedLabel">{it.label}</div>
          <div className="stackedBar">
            {series.map((s) => {
              const v = it.values[s.key] ?? 0;
              return (
              <div
                key={s.key}
                style={{
                  width: `${(v / max) * 100}%`,
                  background: s.color,
                }}
                title={`${s.label}: ${v}`}
              >
                <span className="stackedVal mono">{v}</span>
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineMini({
  points,
  limit,
}: {
  points: { x: number; y: number }[];
  limit: number;
}) {
  const w = 860;
  const h = 140;
  const pad = 10;
  const maxY = Math.max(limit, ...points.map((p0) => p0.y), 1);

  const d = points
    .map((p0, i) => {
      const x = pad + (p0.x * (w - pad * 2)) / 23;
      const y = pad + (1 - p0.y / maxY) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const yLimit = pad + (1 - limit / maxY) * (h - pad * 2);
  const last = points[points.length - 1];
  const xLast = last ? pad + (last.x * (w - pad * 2)) / 23 : w - pad;
  const yLast = last ? pad + (1 - last.y / maxY) * (h - pad * 2) : h - pad;

  return (
    <svg className="lineMini" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Capacity line">
      <path d={`M${pad},${h - pad} L${w - pad},${h - pad}`} stroke="var(--border)" strokeWidth="1" fill="none" />
      <path d={`M${pad},${yLimit.toFixed(1)} L${w - pad},${yLimit.toFixed(1)}`} stroke="var(--bad)" strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      <path d={d} stroke="var(--info)" strokeWidth="2.5" fill="none" />
      {last ? (
        <>
          <circle cx={xLast} cy={yLast} r="3.5" fill="var(--info)" />
          <text x={xLast - 6} y={yLast - 8} textAnchor="end" fontSize="11" fill="var(--muted)" className="mono">
            {round0(last.y)}
          </text>
          <text x={w - pad} y={yLimit - 6} textAnchor="end" fontSize="11" fill="var(--bad)" className="mono">
            {round0(limit)}
          </text>
        </>
      ) : null}
    </svg>
  );
}

function CopyButton({ getTsv }: { getTsv: () => string }) {
  const [copied, setCopied] = useState(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, []);

  async function onCopy() {
    await navigator.clipboard.writeText(getTsv());
    setCopied(true);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="btn" onClick={onCopy} type="button">
      {copied ? "Copiado!" : "Copiar registros"}
    </button>
  );
}

function kpiDeltaText(deltaPct: number) {
  const sign = deltaPct >= 0 ? "+" : "";
  return `${sign}${round0(deltaPct)}% vs ayer`;
}

export default function DashboardClient() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => ymd(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => ymd(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)));
  const [petshopId, setPetshopId] = useState<string>("ALL");

  const [data, setData] = useState<OpsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const PAGE_SIZE = 5;
  const [reprogramarPage, setReprogramarPage] = useState(0);
  const [sinDespacharPage, setSinDespacharPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const fromIso = new Date(`${from}T00:00:00`).toISOString();
        const toIso = new Date(`${to}T00:00:00`).toISOString();
        const d: OpsDashboardResponse = await fetch(
          `/api/ops/dashboard?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        ).then((r) => r.json());
        if (cancelled) return;
        setData(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const now = data?.now ? new Date(data.now) : null;

  const petshops = data?.petshops?.filter((p0) => p0.active) ?? [];
  const activePetshop = petshopId === "ALL" ? null : petshops.find((p0) => p0.id === petshopId) ?? null;

  const metricsAll = useMemo(() => {
    const list = data?.metricsByPetshop ?? [];
    if (!list.length) return null;
    const sum = (f: (m: PetshopMetrics) => number) => list.reduce((acc, m) => acc + (f(m) ?? 0), 0);
    const total = sum((m) => m.total);
    const transacciones = sum((m) => m.transacciones);
    const sindesp = sum((m) => m.sindesp);
    const d1 = sum((m) => m.d1);
    const d2 = sum((m) => m.d2);
    const reprog = sum((m) => m.reprog);
    const cancel = sum((m) => m.cancel);
    const split = sum((m) => m.split);
    const newClients = sum((m) => m.newClients);
    const recurrentClients = sum((m) => m.recurrentClients);
    const onTimeN = sum((m) => m.onTimeN);
    const outTimeN = sum((m) => m.outTimeN);

    const slPct = total ? pct(sum((m) => (m.slPct * m.total) / 100), total) : 0;
    const onTimePctSl = total ? pct(sum((m) => (m.onTimePctSl * m.total) / 100), total) : 0;
    const inFullPct = total ? pct(sum((m) => (m.inFullPct * m.total) / 100), total) : 0;

    return {
      petshopId: "ALL",
      petshopName: "Vista global",
      total,
      transacciones,
      sindesp,
      d1,
      d1pct: pct(d1, total),
      d2,
      d2pct: pct(d2, total),
      reprog,
      cancel,
      cancelPct: pct(cancel, total),
      split,
      splitPct: pct(split, total),
      newClients,
      recurrentClients,
      newPct: pct(newClients, newClients + recurrentClients),
      recPct: pct(recurrentClients, newClients + recurrentClients),
      onTimeN,
      outTimeN,
      onTimePct: pct(onTimeN, onTimeN + outTimeN),
      outTimePct: pct(outTimeN, onTimeN + outTimeN),
      slPct,
      onTimePctSl,
      inFullPct,
    };
  }, [data?.metricsByPetshop]);

  const metricsSelected = useMemo(() => {
    if (!data) return null;
    if (petshopId === "ALL") return metricsAll;
    const m = data.metricsByPetshop.find((x) => x.petshopId === petshopId);
    return m ?? null;
  }, [data, metricsAll, petshopId]);

  const slRows = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop.map((m) => ({
      ...m,
      status: slStatus(m.slPct),
    }));
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.petshopId === petshopId);
  }, [data, petshopId]);

  const top3 = useMemo(() => {
    if (!data) return [];
    if (petshopId === "ALL") return data.top3Petshops;
    const m = data.metricsByPetshop.find((x) => x.petshopId === petshopId);
    return m ? [{ petshopId: m.petshopId, petshopName: m.petshopName, pct: 100 }] : [];
  }, [data, petshopId]);

  const reprogramarRows = useMemo(() => {
    if (!data) return [];
    const rows = data.reprogramarRows;
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.petshopId === petshopId);
  }, [data, petshopId]);

  const sinDespacharRows = useMemo(() => {
    if (!data) return [];
    const rows = data.sinDespacharRows;
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.petshopId === petshopId);
  }, [data, petshopId]);

  const reprogramarPages = useMemo(() => Math.max(1, Math.ceil(reprogramarRows.length / PAGE_SIZE)), [reprogramarRows.length]);
  const sinDespacharPages = useMemo(() => Math.max(1, Math.ceil(sinDespacharRows.length / PAGE_SIZE)), [sinDespacharRows.length]);

  useEffect(() => {
    setReprogramarPage(0);
    setSinDespacharPage(0);
  }, [petshopId, from, to]);

  useEffect(() => {
    setReprogramarPage((p) => Math.min(p, reprogramarPages - 1));
  }, [reprogramarPages]);

  useEffect(() => {
    setSinDespacharPage((p) => Math.min(p, sinDespacharPages - 1));
  }, [sinDespacharPages]);

  const reprogramarRowsView = useMemo(() => {
    const start = reprogramarPage * PAGE_SIZE;
    return reprogramarRows.slice(start, start + PAGE_SIZE);
  }, [reprogramarPage, reprogramarRows]);

  const sinDespacharRowsView = useMemo(() => {
    const start = sinDespacharPage * PAGE_SIZE;
    return sinDespacharRows.slice(start, start + PAGE_SIZE);
  }, [sinDespacharPage, sinDespacharRows]);

  const estancadosRows = useMemo(() => {
    if (!data) return [];
    const rows = data.estancadosRows;
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.petshopId === petshopId);
  }, [data, petshopId]);

  const estancadosRowsView = useMemo(() => estancadosRows.slice(0, 5), [estancadosRows]);

  const d1Bars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, valuePct: m.d1pct, count: m.d1 }))
      .sort((a, b) => b.valuePct - a.valuePct);
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const d2Bars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, valuePct: m.d2pct, count: m.d2 }))
      .sort((a, b) => b.valuePct - a.valuePct);
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const cancelPctBars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, value: round0(m.cancelPct) }))
      .sort((a, b) => b.value - a.value);
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const splitPctBars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, value: round0(m.splitPct) }))
      .sort((a, b) => b.value - a.value);
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const solutionsStack = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop.map((m) => ({
      id: m.petshopId,
      label: m.petshopName,
      values: { sol: m.solutions, dev: m.devoluciones, ret: m.retiros },
    }));
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const manualCloseBars = useMemo(() => {
    if (!data) return [];
    if (petshopId === "ALL") {
      const totals = new Map<string, number>();
      for (const m of data.metricsByPetshop) {
        for (const b of m.manualCloseLast7 ?? []) {
          totals.set(b.t, (totals.get(b.t) ?? 0) + (b.count ?? 0));
        }
      }
      return Array.from(totals.entries())
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .slice(-5)
        .map(([t, count]) => ({ id: t, label: ymd(new Date(t)).slice(5), value: count }));
    }
    const list = data.metricsByPetshop.find((m) => m.petshopId === petshopId)?.manualCloseLast7 ?? [];
    return list.slice(-5).map((b) => ({ id: b.t, label: ymd(new Date(b.t)).slice(5), value: b.count }));
  }, [data, petshopId]);

  const capacity = useMemo(() => {
    if (!data || !metricsSelected) return null;
    const limits = data.capacityLimits;
    const m =
      petshopId === "ALL"
        ? data.metricsByPetshop[0]
        : data.metricsByPetshop.find((x) => x.petshopId === petshopId) ?? data.metricsByPetshop[0];
    const flexUsed = m.capacityFlexHourly.reduce((acc, x) => acc + x.used, 0);
    const franjaUsed = m.capacityFranjaHourly.reduce((acc, x) => acc + x.used, 0);
    return {
      flex: { used: flexUsed, limit: limits.flexPerDay, hourly: m.capacityFlexHourly },
      franja: { used: franjaUsed, limit: limits.franjaPerDay, hourly: m.capacityFranjaHourly },
    };
  }, [data, metricsSelected, petshopId]);

  const globalSplitBadge = useMemo(() => {
    const list = data?.metricsByPetshop ?? [];
    const total = list.reduce((acc, m) => acc + m.total, 0);
    const split = list.reduce((acc, m) => acc + m.split, 0);
    return { split, pct: round0(pct(split, total)) };
  }, [data?.metricsByPetshop]);

  const viewPillText = petshopId === "ALL" ? "Vista global" : activePetshop?.name ?? "Petshop";

  return (
    <main className="container">
      <div className="topbar">
        <div className="title">
          <h1>Operaciones · MisPichos</h1>
          <p className="topbarMeta">
            <span className="pulseDot" aria-hidden="true" /> Última actualización: {now ? now.toLocaleString("es-AR") : "—"}{" "}
            {loading ? "· actualizando…" : ""}
          </p>
        </div>
        <div className="chipRow">
          <label className="chip">
            <span>Petshop</span>
            <select className="selectInput" value={petshopId} onChange={(e) => setPetshopId(e.target.value)}>
              <option value="ALL">Todos los petshops</option>
              {petshops.map((p0) => (
                <option key={p0.id} value={p0.id}>
                  {p0.name}
                </option>
              ))}
            </select>
            <span className="pill badgeInfo">{viewPillText}</span>
          </label>
          <label className="chip">
            <span>Desde</span>
            <input className="dateInput" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="chip">
            <span>Hasta</span>
            <input className="dateInput" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="section">
        <div className="sectionHeader">
          <div>
            <h2>Órdenes de transacción (en vivo)</h2>
            <p>KPIs operativos y distribución</p>
          </div>
        </div>

        <div className="kpiRow">
          <div className="kpiMain">
            <div className="kpiLabel">Total pedidos</div>
            <div className="kpiValue">{metricsSelected ? metricsSelected.total.toLocaleString("es-AR") : "—"}</div>
            <div className="kpiSub">{metricsSelected ? kpiDeltaText((Math.random() - 0.4) * 20) : "—"}</div>
            <div className="kpiDivider" />
            <div className="kpiDetail">
              <span className="kpiDetailLabel">Transacciones</span>
              <span className="mono">{metricsSelected ? metricsSelected.transacciones.toLocaleString("es-AR") : "—"}</span>
            </div>
          </div>

          <div className="kpiSmallGrid">
            <div className="kpiSmall">
              <div className="kpiLabel">Sin despachar</div>
              <div className="kpiValue">{metricsSelected ? metricsSelected.sindesp : "—"}</div>
            </div>
            <div className="kpiSmall">
              <div className="kpiLabel">Demorados 1ra vuelta</div>
              <div className="kpiValue">{metricsSelected ? `${metricsSelected.d1} (${formatPct0(metricsSelected.d1pct)})` : "—"}</div>
            </div>
            <div className="kpiSmall">
              <div className="kpiLabel">Demorados 2da vuelta</div>
              <div className="kpiValue">{metricsSelected ? `${metricsSelected.d2} (${formatPct0(metricsSelected.d2pct)})` : "—"}</div>
            </div>
            <div className="kpiSmall">
              <div className="kpiLabel">Reprogramar</div>
              <div className="kpiValue">{metricsSelected ? metricsSelected.reprog : "—"}</div>
            </div>
            <div className="kpiSmall">
              <div className="kpiLabel">Cancelados</div>
              <div className="kpiValue">{metricsSelected ? `${metricsSelected.cancel} (${formatPct0(metricsSelected.cancelPct)})` : "—"}</div>
            </div>
          </div>
        </div>

        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Clientes nuevos vs recurrentes</div>
            </div>
            <Doughnut
              aLabel="Nuevos"
              aValue={metricsSelected?.newClients ?? 0}
              aColor="var(--info)"
              bLabel="Recurrentes"
              bValue={metricsSelected?.recurrentClients ?? 0}
              bColor="var(--muted)"
            />
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">On time vs Out of time</div>
            </div>
            <Doughnut
              aLabel="On time"
              aValue={metricsSelected?.onTimeN ?? 0}
              aColor="var(--ok)"
              bLabel="Out of time"
              bValue={metricsSelected?.outTimeN ?? 0}
              bColor="var(--bad)"
            />
          </div>
        </div>
      </div>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Service level (SL) en tiempo real</h2>
            <p>Una fila por petshop</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Petshop</th>
              <th>SL %</th>
              <th>On time %</th>
              <th>In full %</th>
              <th>Progreso</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {slRows.map((r) => (
              <tr key={r.petshopId}>
                <td>{r.petshopName}</td>
                <td style={{ color: r.slPct >= 90 ? "var(--ok)" : r.slPct >= 85 ? "var(--warn)" : "var(--bad)" }}>
                  {formatPct0(r.slPct)}
                </td>
                <td>{formatPct0(r.onTimePctSl)}</td>
                <td>{formatPct0(r.inFullPct)}</td>
                <td>
                  <SlProgress slPct={r.slPct} />
                </td>
                <td>
                  <span className={badgeClassBySl(r.slPct)}>{slStatus(r.slPct)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Top 3 petshops del día</h2>
            <p>Share de pedidos</p>
          </div>
        </div>
        <div className="top3">
          {top3.map((t0, i) => (
            <div key={t0.petshopId} className="top3Item">
              <div className="rankCircle" data-rank={i + 1}>
                {i + 1}
              </div>
              <div className="top3Main">
                <div className="top3Name">{t0.petshopName}</div>
                <div className="bar" aria-hidden="true">
                  <div style={{ width: `${clamp(t0.pct, 0, 100)}%`, background: "var(--info)" }} />
                </div>
              </div>
              <div className="top3Pct mono">{formatPct0(t0.pct)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Pedidos a reprogramar</h2>
            <p>Superaron 48hs sin gestión</p>
          </div>
          <div className="sectionActions">
            <div className="pager">
              <button
                className="btn btnIcon"
                type="button"
                onClick={() => setReprogramarPage((p) => Math.max(0, p - 1))}
                disabled={reprogramarPage <= 0}
                aria-label="Página anterior"
                title="Anterior"
              >
                ←
              </button>
              <span className="sub mono">
                {reprogramarRows.length} · {reprogramarPage + 1}/{reprogramarPages}
              </span>
              <button
                className="btn btnIcon"
                type="button"
                onClick={() => setReprogramarPage((p) => Math.min(reprogramarPages - 1, p + 1))}
                disabled={reprogramarPage >= reprogramarPages - 1}
                aria-label="Página siguiente"
                title="Siguiente"
              >
                →
              </button>
            </div>
            <CopyButton
              getTsv={() => {
                const header = ["#pedido", "fecha_y_hora", "franja", "cliente", "domicilio", "producto", "petshop"].join("\t");
                const lines = reprogramarRows.map((r) =>
                  [
                    r.orderId,
                    new Date(r.createdAt).toLocaleString("es-AR"),
                    r.deliveryWindow ?? "",
                    r.customer,
                    r.address,
                    r.product,
                    r.petshopName ?? "",
                  ].join("\t"),
                );
                return [header, ...lines].join("\n");
              }}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#pedido</th>
              <th>Fecha y hora</th>
              <th>Franja</th>
              <th>Cliente</th>
              <th>Domicilio</th>
              <th>Producto</th>
              <th>Petshop</th>
            </tr>
          </thead>
          <tbody>
            {reprogramarRowsView.map((r) => (
              <tr key={`${r.orderId}-${r.createdAt}`} data-ps={r.petshopId ?? ""}>
                <td className="mono">{r.orderId}</td>
                <td>{new Date(r.createdAt).toLocaleString("es-AR")}</td>
                <td className="mono">{r.deliveryWindow ?? "—"}</td>
                <td>{r.customer}</td>
                <td>{r.address}</td>
                <td>{r.product}</td>
                <td>{r.petshopName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Demorado sin despachar</h2>
            <p>Etiqueta impresa &gt;24hs sin driver</p>
          </div>
          <div className="sectionActions">
            <div className="pager">
              <button
                className="btn btnIcon"
                type="button"
                onClick={() => setSinDespacharPage((p) => Math.max(0, p - 1))}
                disabled={sinDespacharPage <= 0}
                aria-label="Página anterior"
                title="Anterior"
              >
                ←
              </button>
              <span className="sub mono">
                {sinDespacharRows.length} · {sinDespacharPage + 1}/{sinDespacharPages}
              </span>
              <button
                className="btn btnIcon"
                type="button"
                onClick={() => setSinDespacharPage((p) => Math.min(sinDespacharPages - 1, p + 1))}
                disabled={sinDespacharPage >= sinDespacharPages - 1}
                aria-label="Página siguiente"
                title="Siguiente"
              >
                →
              </button>
            </div>
            <CopyButton
              getTsv={() => {
                const header = ["#pedido", "etiqueta_impresa", "franja", "cliente", "domicilio", "producto", "petshop", "horas_espera"].join("\t");
                const lines = sinDespacharRows.map((r) =>
                  [
                    r.orderId,
                    new Date(r.labelPrintedAt).toLocaleString("es-AR"),
                    r.deliveryWindow ?? "",
                    r.customer,
                    r.address,
                    r.product,
                    r.petshopName ?? "",
                    `${round0(r.waitHours)}h`,
                  ].join("\t"),
                );
                return [header, ...lines].join("\n");
              }}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#pedido</th>
              <th>Etiqueta impresa</th>
              <th>Franja</th>
              <th>Cliente</th>
              <th>Domicilio</th>
              <th>Producto</th>
              <th>Horas de espera</th>
            </tr>
          </thead>
          <tbody>
            {sinDespacharRowsView.map((r: SinDespacharRow) => {
              const color = r.waitHours > 28 ? "var(--bad)" : r.waitHours >= 24 ? "var(--warn)" : "var(--muted)";
              return (
                <tr key={`${r.orderId}-${r.labelPrintedAt}`}>
                  <td className="mono">{r.orderId}</td>
                  <td>{new Date(r.labelPrintedAt).toLocaleString("es-AR")}</td>
                  <td className="mono">{r.deliveryWindow ?? "—"}</td>
                  <td>{r.customer}</td>
                  <td>{r.address}</td>
                  <td>{r.product}</td>
                  <td style={{ color, fontWeight: 500 }}>{round0(r.waitHours)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Demoras 1ra vuelta y 2da vuelta</h2>
            <p>Porcentaje por petshop</p>
          </div>
        </div>
        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">1ra vuelta</div>
            </div>
            <BarList items={d1Bars} color="var(--warn)" />
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">2da vuelta</div>
            </div>
            <BarList items={d2Bars} color="color-mix(in srgb, var(--bad) 75%, transparent)" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Estancados y Cerrados manualmente</h2>
            <p>Casos aislados + cierres manuales</p>
          </div>
        </div>
        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Estancados</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#pedido</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Petshop</th>
                  <th>Horas de espera</th>
                </tr>
              </thead>
              <tbody>
                {estancadosRowsView.map((r) => {
                  const color = r.waitHours > 30 ? "var(--bad)" : r.waitHours >= 20 ? "var(--warn)" : "var(--muted)";
                  return (
                    <tr key={`${r.orderId}-${r.createdAt}`}>
                      <td className="mono">{r.orderId}</td>
                      <td>{new Date(r.createdAt).toLocaleString("es-AR")}</td>
                      <td>{r.customer}</td>
                      <td>{r.petshopName ?? "—"}</td>
                      <td style={{ color, fontWeight: 500 }}>{round0(r.waitHours)}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Pedidos cerrados manualmente</div>
              <div className="sub">Últimos 7 días</div>
            </div>
            <VerticalBars items={manualCloseBars} color="var(--purple)" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Cancelados</h2>
            <p>Estado operativo</p>
          </div>
        </div>
        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">% cancelados por petshop</div>
            </div>
            <div className="note">Motivos: pendiente integración con Wizard</div>
            <VerticalBars items={cancelPctBars} color="var(--bad)" valueFormatter={(n) => `${n}%`} />
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Clientes cancelados — nuevos vs recurrentes</div>
            </div>
            <div className="note noteWarn">Integración con Wizard pendiente</div>
            <Doughnut
              aLabel="Nuevos"
              aValue={round0((metricsSelected?.cancel ?? 0) * 0.6)}
              aColor="var(--warn)"
              bLabel="Recurrentes"
              bValue={round0((metricsSelected?.cancel ?? 0) * 0.4)}
              bColor="var(--muted)"
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>
              Pedidos spliteados{" "}
              <span className="pill badgeInfo">
                {globalSplitBadge.split} · {globalSplitBadge.pct}%
              </span>
            </h2>
            <p>Órdenes con 2+ pedidos de distintos petshops</p>
          </div>
        </div>
        <VerticalBars items={splitPctBars} color="var(--info)" valueFormatter={(n) => `${n}%`} />
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Soluciones, devoluciones y retiros</h2>
            <p>Por petshop</p>
          </div>
        </div>
        <div className="legendRow">
          <div className="legendItem">
            <span className="legendSwatch" style={{ background: "var(--info)" }} />
            Solución
          </div>
          <div className="legendItem">
            <span className="legendSwatch" style={{ background: "var(--warn)" }} />
            Devolución
          </div>
          <div className="legendItem">
            <span className="legendSwatch" style={{ background: "var(--bad)" }} />
            Retiro
          </div>
        </div>
        <StackedBars
          items={solutionsStack}
          series={[
            { key: "sol", label: "Solución", color: "var(--info)" },
            { key: "dev", label: "Devolución", color: "var(--warn)" },
            { key: "ret", label: "Retiro", color: "var(--bad)" },
          ]}
        />
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <h2>Capacidad logística</h2>
            <p>Límites configurables</p>
          </div>
        </div>
        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Flex</div>
              <div className="sub">{capacity ? `${capacity.flex.used}/${capacity.flex.limit}` : "—"}</div>
            </div>
            {capacity ? (
              <>
                <div className="bar" aria-hidden="true">
                  <div
                    style={{
                      width: `${clamp((capacity.flex.used / capacity.flex.limit) * 100, 0, 100)}%`,
                      background:
                        capacity.flex.used / capacity.flex.limit > 0.9
                          ? "var(--bad)"
                          : capacity.flex.used / capacity.flex.limit >= 0.7
                            ? "var(--warn)"
                            : "var(--ok)",
                    }}
                  />
                </div>
                <LineMini points={capacity.flex.hourly.map((x) => ({ x: x.hour, y: x.used }))} limit={round0(capacity.flex.limit / 24)} />
              </>
            ) : null}
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Franja corta</div>
              <div className="sub">{capacity ? `${capacity.franja.used}/${capacity.franja.limit}` : "—"}</div>
            </div>
            {capacity ? (
              <>
                <div className="bar" aria-hidden="true">
                  <div
                    style={{
                      width: `${clamp((capacity.franja.used / capacity.franja.limit) * 100, 0, 100)}%`,
                      background:
                        capacity.franja.used / capacity.franja.limit > 0.9
                          ? "var(--bad)"
                          : capacity.franja.used / capacity.franja.limit >= 0.7
                            ? "var(--warn)"
                            : "var(--ok)",
                    }}
                  />
                </div>
                <LineMini
                  points={capacity.franja.hourly.map((x) => ({ x: x.hour, y: x.used }))}
                  limit={round0(capacity.franja.limit / 24)}
                />
              </>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

