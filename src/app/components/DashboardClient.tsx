/**
 * `DashboardClient`
 * Componente principal del dashboard (client-side).
 *
 * Acá vive casi toda la UI y la lógica de presentación:
 * - filtros/estado (petshop + rango de fechas + tema)
 * - KPIs y comparaciones vs ayer (incluye deltas estables para el mock)
 * - accesos rápidos (desktop + mobile)
 * - tablas (copiar/descargar) y visualizaciones (tortas/barras/líneas)
 * - capacidad logística (cálculos, colores por umbral y modales)
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CancellationReasonBucket, OpsDashboardResponse, PetshopMetrics, SinDespacharRow } from "@/lib/data/mockOpsDashboard";
import AiRecommendations from "./AiRecommendations";

type QuickAccessItem = {
  topic: string;
  id: string; // DOM anchor id
  label: string;
};

const QUICK_ACCESS: QuickAccessItem[] = [
  { topic: "En vivo", id: "ops-live", label: "KPIs operativos" },
  { topic: "En vivo", id: "sl-live", label: "Service level (SL)" },
  { topic: "En vivo", id: "top3", label: "Top 3 petshops" },
  { topic: "Incidencias", id: "reprogramar", label: "Pedidos a reprogramar" },
  { topic: "Incidencias", id: "sin-despachar", label: "Demorado sin despachar" },
  { topic: "Operación", id: "demoras", label: "1ra/2da vuelta" },
  { topic: "Operación", id: "estancados", label: "Estancados / Cierres manuales" },
  { topic: "Riesgo", id: "cancelados", label: "Cancelados" },
  { topic: "Riesgo", id: "spliteados", label: "Pedidos spliteados" },
  { topic: "Post-venta", id: "soluciones", label: "Soluciones / Devoluciones / Retiros" },
  { topic: "Capacidad", id: "capacidad", label: "Capacidad logística" },
];

/**
 * Helper de fecha usado por el selector de rango + params de API.
 * Estandarizamos a yyyy-mm-dd para que el estado/URL sea estable.
 */
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

/**
 * Umbrales de estado para Service Level (visual / operativo).
 * Tratamos SL% como un “health metric” con OK / Revisar / Crítico.
 */
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

/**
 * Doughnut SVG liviano reutilizado en el dashboard.
 * Importante: el % se calcula como aValue/(aValue+bValue).
 * Si alguna “mini métrica” debe coincidir con el doughnut, tiene que usar
 * esa misma relación (ej: On-time = A tiempo / (A tiempo + Fuera de tiempo)).
 */
function Doughnut({
  aLabel,
  aValue,
  aColor,
  bLabel,
  bValue,
  bColor,
  legendLayout = "stack",
}: {
  aLabel: string;
  aValue: number;
  aColor: string;
  bLabel: string;
  bValue: number;
  bColor: string;
  legendLayout?: "stack" | "twoCol";
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
      <div className={`donutLegend ${legendLayout === "twoCol" ? "donutLegendTwoCol" : ""}`}>
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

function PieSplit({
  pct0,
  aLabel,
  aValue,
  aColor,
  bLabel,
  bValue,
  bColor,
}: {
  pct0: number; // 0..100 rounded
  aLabel: string;
  aValue: number;
  aColor: string;
  bLabel: string;
  bValue: number;
  bColor: string;
}) {
  const n = clamp(round0(pct0), 0, 100);
  return (
    <div className="pieWrap">
      <div
        className="pie"
        role="img"
        aria-label={`${aLabel} ${n}%`}
        style={{
          background: `conic-gradient(${aColor} 0 ${n}%, ${bColor} ${n}% 100%)`,
        }}
      />
      <div className="pieLegend">
        <div className="pieLegendItem">
          <span className="legendSwatch" style={{ background: aColor }} />
          <div className="pieLegendMain">
            <div className="pieLegendTop">
              <span>{aLabel}</span>
              <span className="mono">
                {n}% · {aValue.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        </div>
        <div className="pieLegendItem">
          <span className="legendSwatch" style={{ background: bColor }} />
          <div className="pieLegendMain">
            <div className="pieLegendTop">
              <span>{bLabel}</span>
              <span className="mono">
                {100 - n}% · {bValue.toLocaleString("es-AR")}
              </span>
            </div>
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
  items: { id: string; label: string; value: number; meta?: string }[];
  color: string;
  valueFormatter?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="vbars">
      {items.map((it) => (
        <div
          key={it.id}
          className="vbarItem"
          title={`${it.label}: ${valueFormatter ? valueFormatter(it.value) : it.value}${it.meta ? ` · ${it.meta}` : ""}`}
        >
          <div className="vbarValue mono">{valueFormatter ? valueFormatter(it.value) : it.value}</div>
          {it.meta ? <div className="vbarMeta mono">{it.meta}</div> : null}
          <div className="vbar">
            <div style={{ height: `${(it.value / max) * 100}%`, background: color, width: "100%" }} />
          </div>
          <div className="vbarUnder mono">
            {valueFormatter ? valueFormatter(it.value) : it.value}
            {it.meta ? ` · ${it.meta}` : ""}
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
  color = "var(--info)",
}: {
  points: { x: number; y: number }[];
  limit: number;
  color?: string;
}) {
  const w = 860;
  const h = 140;
  const pad = 10;
  const maxY = Math.max(limit, ...points.map((p0) => p0.y), 1);
  const maxX = Math.max(1, ...points.map((p0) => p0.x), 1);

  const d = points
    .map((p0, i) => {
      const x = pad + (p0.x * (w - pad * 2)) / maxX;
      const y = pad + (1 - p0.y / maxY) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const yLimit = pad + (1 - limit / maxY) * (h - pad * 2);
  const last = points[points.length - 1];
  const xLast = last ? pad + (last.x * (w - pad * 2)) / maxX : w - pad;
  const yLast = last ? pad + (1 - last.y / maxY) * (h - pad * 2) : h - pad;

  return (
    <svg className="lineMini" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Capacity line">
      <path d={`M${pad},${h - pad} L${w - pad},${h - pad}`} stroke="var(--border)" strokeWidth="1" fill="none" />
      <path d={`M${pad},${yLimit.toFixed(1)} L${w - pad},${yLimit.toFixed(1)}`} stroke="var(--bad)" strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      <path d={d} stroke={color} strokeWidth="2.5" fill="none" />
      {last ? (
        <>
          <circle cx={xLast} cy={yLast} r="3.5" fill={color} />
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

function htmlEscape(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toHtmlTable(headers: string[], rows: string[][]) {
  const thead = `<thead><tr>${headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c ?? "")}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  // Inline styles so it pastes nicely into mail clients.
  return `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:12px">${thead}${tbody}</table>`;
}

function dtLocalToMs(v: string) {
  // `datetime-local` returns a local date-time string (no timezone suffix).
  // `new Date()` interprets it as local time, which matches the UI expectation.
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function CopyActionButton({
  label,
  onCopy,
  className,
}: {
  label: string;
  onCopy: () => Promise<void> | void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, []);

  async function handleCopy() {
    await onCopy();
    setCopied(true);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className={`btn ${className ?? ""}`} onClick={handleCopy} type="button">
      {copied ? "Copiado!" : label}
    </button>
  );
}

function escapeMdCell(s: string) {
  return s.replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}

function toMarkdownTable(headers: string[], rows: string[][]) {
  const h = `| ${headers.map(escapeMdCell).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map((c) => escapeMdCell(c)).join(" | ")} |`);
  return [h, sep, ...body].join("\n");
}

function padRight(s: string, w: number) {
  if (s.length >= w) return s;
  return s + " ".repeat(w - s.length);
}

function clip(s: string, max: number) {
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return s.slice(0, Math.max(1, max - 1)) + "…";
}

function toFixedWidthTable(
  headers: string[],
  rows: string[][],
  opts?: { maxColWidths?: number[]; wrapInCodeBlock?: boolean },
) {
  const maxColWidths = opts?.maxColWidths ?? headers.map(() => 24);
  const wrap = opts?.wrapInCodeBlock ?? true;

  const clippedHeaders = headers.map((h, i) => clip(h, maxColWidths[i] ?? 24));
  const clippedRows = rows.map((r) => r.map((c, i) => clip(c ?? "", maxColWidths[i] ?? 24)));

  const widths = headers.map((_, i) => {
    const w0 = clippedHeaders[i]?.length ?? 0;
    const w1 = Math.max(0, ...clippedRows.map((r) => (r[i] ?? "").length));
    return Math.min(maxColWidths[i] ?? 24, Math.max(w0, w1));
  });

  const line = (cells: string[]) => cells.map((c, i) => padRight(c ?? "", widths[i] ?? 0)).join(" | ");
  const sep = widths.map((w) => "-".repeat(Math.max(3, w))).join("-|-");

  const out = [line(clippedHeaders), sep, ...clippedRows.map(line)].join("\n");
  return wrap ? "```" + "\n" + out + "\n" + "```" : out;
}

function csvEscape(s: string, sep: "," | ";" = ";") {
  const needsQuotes = s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(sep);
  const v = s.replaceAll('"', '""');
  return needsQuotes ? `"${v}"` : v;
}

function toCsv(headers: string[], rows: string[][], sep: "," | ";" = ";") {
  const lines = [
    headers.map((h) => csvEscape(h, sep)).join(sep),
    ...rows.map((r) => r.map((c) => csvEscape(c, sep)).join(sep)),
  ];
  // UTF-8 BOM helps Excel on Windows
  return "\uFEFF" + lines.join("\n");
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * El dashboard usa “vs ayer” en varios lugares.
 * Mostramos el % redondeado y mantenemos los colores consistentes con ese redondeo.
 */
function kpiDeltaText(deltaPct: number) {
  const sign = deltaPct >= 0 ? "+" : "";
  return `${sign}${round0(deltaPct)}% vs ayer`;
}

function deltaColor(deltaPct: number) {
  // Keep color consistent with what we display (rounded %).
  const r = round0(deltaPct);
  if (r > 0) return "var(--ok)";
  if (r < 0) return "var(--bad)";
  return "var(--muted)";
}

function deltaColorForMetric(deltaPct: number, mode: "higher_better" | "lower_better") {
  const r = round0(deltaPct);
  if (r === 0) return "var(--muted)";
  if (mode === "higher_better") return r > 0 ? "var(--ok)" : "var(--bad)";
  return r < 0 ? "var(--ok)" : "var(--bad)";
}

/**
 * Primitiva de UI para “vs ayer”: solo texto + flecha (sin “globito”),
 * porque la señal principal la da el color de fondo de la tarjeta completa.
 */
function DeltaPill({ deltaPct, mode = "higher_better" }: { deltaPct: number; mode?: "higher_better" | "lower_better" }) {
  const r = round0(deltaPct);
  const dir = r > 0 ? "up" : r < 0 ? "down" : "flat";
  const arrow = r > 0 ? "↗" : r < 0 ? "↘" : "→";
  return (
    <span className={`deltaText deltaText-${dir}`} style={{ color: deltaColorForMetric(deltaPct, mode) }}>
      <span className="deltaArrow" aria-hidden="true">
        {arrow}
      </span>
      <span>{kpiDeltaText(deltaPct)}</span>
    </span>
  );
}

function previousFromDelta(current: number, deltaPct: number) {
  const d = deltaPct / 100;
  if (!Number.isFinite(current) || !Number.isFinite(d)) return null;
  const denom = 1 + d;
  if (Math.abs(denom) < 1e-6) return null;
  return current / denom;
}

/**
 * Deltas estables (pseudo-aleatorios).
 * En modo mock/demo no tenemos “ayer” como serie real, pero necesitamos deltas
 * determinísticos que NO cambien al togglear el tema ni al re-renderizar.
 * La key debe incluir petshop/rango/métrica para que sea consistente por vista.
 */
function stableDeltaPctFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const r01 = (Math.abs(hash) % 1000) / 1000; // 0..0.999
  return (r01 - 0.45) * 18; // ~ -8.1% .. +9.9%
}

type DeltaBgTone = "ok" | "bad" | "neutral";

/**
 * Coloreo del fondo de KPIs basado en el “vs ayer”.
 * Mantenemos una banda neutral (ej: 1%) para que cambios chicos no “griten”
 * en verde/rojo y queden grises.
 */
function deltaBgTone(deltaPct: number, mode: "higher_better" | "lower_better", neutralAbsPct: number) {
  const r = round0(deltaPct);
  if (!Number.isFinite(r) || Math.abs(r) < neutralAbsPct) return "neutral";
  if (mode === "higher_better") return r > 0 ? "ok" : "bad";
  return r < 0 ? "ok" : "bad";
}

function deltaBgClass(t: DeltaBgTone) {
  return t === "ok" ? "kpiBgOk" : t === "bad" ? "kpiBgBad" : "kpiBgNeutral";
}

/**
 * Config por KPI para el fondo basado en delta.
 * Cada KPI puede tener su propio umbral neutral (comportamiento independiente).
 */
const KPI_DELTA_BG = {
  total: { mode: "higher_better" as const, neutralAbsPct: 1 },
  cancel: { mode: "lower_better" as const, neutralAbsPct: 1 },
  vuelta1: { mode: "lower_better" as const, neutralAbsPct: 1 },
  vuelta2: { mode: "lower_better" as const, neutralAbsPct: 1 },
  demSinDespachar: { mode: "lower_better" as const, neutralAbsPct: 1 },
  reprog: { mode: "lower_better" as const, neutralAbsPct: 1 },
  onTime: { mode: "higher_better" as const, neutralAbsPct: 1 },
  sl: { mode: "higher_better" as const, neutralAbsPct: 1 },
};

function WindowPill({ win }: { win?: "10-14" | "14-18" | "18-22" | "14-22" | null }) {
  if (!win) return <span className="sub">—</span>;
  const colorVar =
    win === "10-14" ? "var(--cap1014)" : win === "14-18" ? "var(--cap1418)" : win === "18-22" ? "var(--cap1822)" : "var(--capFlex)";
  return (
    <span className="windowPill mono" style={{ ["--wColor" as never]: colorVar }}>
      {win}
    </span>
  );
}

type KpiTone = "ok" | "warn" | "bad" | "neutral";

function toneColor(t: KpiTone) {
  if (t === "ok") return "var(--ok)";
  if (t === "warn") return "var(--warn)";
  if (t === "bad") return "var(--bad)";
  return "var(--muted)";
}

function toneByRate(rate01: number, warnAt: number, badAt: number): KpiTone {
  if (!Number.isFinite(rate01) || rate01 <= 0) return "ok";
  if (rate01 >= badAt) return "bad";
  if (rate01 >= warnAt) return "warn";
  return "ok";
}

function usageColor(p: number) {
  if (p > 0.9) return "var(--bad)";
  if (p >= 0.7) return "var(--warn)";
  return "var(--ok)";
}

function sumHours(hourly: { hour: number; used: number }[], fromHour: number, toHourExclusive: number) {
  let acc = 0;
  for (const b of hourly) {
    if (b.hour >= fromHour && b.hour < toHourExclusive) acc += b.used;
  }
  return acc;
}

function fillHours24(hourly: { hour: number; used: number }[]) {
  const map = new Map<number, number>();
  for (const b of hourly) map.set(b.hour, (map.get(b.hour) ?? 0) + (b.used ?? 0));
  const out: { hour: number; used: number }[] = [];
  for (let h = 0; h < 24; h++) out.push({ hour: h, used: map.get(h) ?? 0 });
  return out;
}

function sumDailyUsed(metrics: { capacityFlexDaily?: { t: string; used: number }[]; capacityFranjaDaily?: { t: string; used: number }[] }[], key: "flex" | "franja") {
  const map = new Map<string, number>();
  for (const m0 of metrics) {
    const arr = key === "flex" ? (m0.capacityFlexDaily ?? []) : (m0.capacityFranjaDaily ?? []);
    for (const b of arr) map.set(b.t, (map.get(b.t) ?? 0) + (b.used ?? 0));
  }
  return Array.from(map.entries())
    .map(([t, used]) => ({ t, used }))
    .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
}

function nearCapacityClass(used: number, limit: number) {
  if (limit <= 0) return "";
  const p = used / limit;
  if (p >= 0.95) return "capNear capNearMax";
  if (p >= 0.9) return "capNear capNearWarn";
  return "";
}

function nearCapacityPctClass(pct0: number) {
  const p = pct0 / 100;
  if (p >= 0.95) return "capNearMax";
  if (p >= 0.9) return "capNearWarn";
  return "";
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
  const [reprogramarFromDt, setReprogramarFromDt] = useState("");
  const [reprogramarToDt, setReprogramarToDt] = useState("");
  const [sinDespacharFromDt, setSinDespacharFromDt] = useState("");
  const [sinDespacharToDt, setSinDespacharToDt] = useState("");

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
    const delivered = sum((m) => m.delivered);
    const transacciones = sum((m) => m.transacciones);
    const demSinDespachar = sum((m) => m.demSinDespachar);
    const vuelta1 = sum((m) => m.vuelta1);
    const vuelta2 = sum((m) => m.vuelta2);
    const reprog = sum((m) => m.reprog);
    const cancel = sum((m) => m.cancel);
    const split = sum((m) => m.split);
    const newClients = sum((m) => m.newClients);
    const recurrentClients = sum((m) => m.recurrentClients);
    const onTimeN = sum((m) => m.onTimeN);
    const outTimeN = sum((m) => m.outTimeN);
    const eligible = Math.max(0, total - cancel);

    const slPct = pct(delivered, total);

    return {
      petshopId: "ALL",
      petshopName: "Vista global",
      total,
      delivered,
      transacciones,
      demSinDespachar,
      vuelta1,
      vuelta1pct: pct(vuelta1, total),
      vuelta2,
      vuelta2pct: pct(vuelta2, total),
      reprog,
      cancel,
      cancelPct: pct(cancel, total),
      split,
      // Spliteados se mide sobre transacciones (no sobre órdenes).
      splitPct: pct(split, transacciones),
      newClients,
      recurrentClients,
      newPct: pct(newClients, newClients + recurrentClients),
      recPct: pct(recurrentClients, newClients + recurrentClients),
      onTimeN,
      outTimeN,
      onTimePct: pct(onTimeN, eligible),
      outTimePct: pct(outTimeN, eligible),
      slPct,
    };
  }, [data?.metricsByPetshop]);

  const metricsSelected = useMemo(() => {
    if (!data) return null;
    if (petshopId === "ALL") return metricsAll;
    const m = data.metricsByPetshop.find((x) => x.petshopId === petshopId);
    return m ?? null;
  }, [data, metricsAll, petshopId]);

  /**
   * SL (prom.) en la tarjeta superior:
   * - En vista ALL: mostramos el promedio simple del SL% de todos los petshops
   *   (mismos valores que se ven en la tabla de SL).
   * - Con petshop seleccionado: mostramos el SL% propio de ese petshop.
   */
  const slPctAvgAll = useMemo(() => {
    const list = data?.metricsByPetshop ?? [];
    if (!list.length) return null;
    const avg = list.reduce((acc, m) => acc + (m.slPct ?? 0), 0) / list.length;
    return avg;
  }, [data?.metricsByPetshop]);

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
    return data.top3Petshops;
  }, [data]);

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

  const reprogramarRowsFiltered = useMemo(() => {
    const fromMs = dtLocalToMs(reprogramarFromDt);
    const toMs = dtLocalToMs(reprogramarToDt);
    return reprogramarRows
      .filter((r) => {
        const t = new Date(r.createdAt).getTime();
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
        return true;
      })
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // más antiguos arriba
  }, [reprogramarFromDt, reprogramarRows, reprogramarToDt]);

  const sinDespacharRowsFiltered = useMemo(() => {
    const fromMs = dtLocalToMs(sinDespacharFromDt);
    const toMs = dtLocalToMs(sinDespacharToDt);
    return sinDespacharRows
      .filter((r) => {
        const t = new Date(r.labelPrintedAt).getTime();
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
        return true;
      })
      .slice()
      .sort((a, b) => new Date(a.labelPrintedAt).getTime() - new Date(b.labelPrintedAt).getTime()); // más antiguos arriba
  }, [sinDespacharFromDt, sinDespacharRows, sinDespacharToDt]);

  const reprogramarPages = useMemo(
    () => Math.max(1, Math.ceil(reprogramarRowsFiltered.length / PAGE_SIZE)),
    [reprogramarRowsFiltered.length],
  );
  const sinDespacharPages = useMemo(
    () => Math.max(1, Math.ceil(sinDespacharRowsFiltered.length / PAGE_SIZE)),
    [sinDespacharRowsFiltered.length],
  );

  useEffect(() => {
    setReprogramarPage(0);
    setSinDespacharPage(0);
  }, [petshopId, from, to]);

  useEffect(() => {
    setReprogramarPage(0);
  }, [reprogramarFromDt, reprogramarToDt]);

  useEffect(() => {
    setSinDespacharPage(0);
  }, [sinDespacharFromDt, sinDespacharToDt]);

  useEffect(() => {
    setReprogramarPage((p) => Math.min(p, reprogramarPages - 1));
  }, [reprogramarPages]);

  useEffect(() => {
    setSinDespacharPage((p) => Math.min(p, sinDespacharPages - 1));
  }, [sinDespacharPages]);

  const reprogramarRowsView = useMemo(() => {
    const start = reprogramarPage * PAGE_SIZE;
    return reprogramarRowsFiltered.slice(start, start + PAGE_SIZE);
  }, [reprogramarPage, reprogramarRowsFiltered]);

  const sinDespacharRowsView = useMemo(() => {
    const start = sinDespacharPage * PAGE_SIZE;
    return sinDespacharRowsFiltered.slice(start, start + PAGE_SIZE);
  }, [sinDespacharPage, sinDespacharRowsFiltered]);

  const estancadosRows = useMemo(() => {
    if (!data) return [];
    const rows = data.estancadosRows;
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.petshopId === petshopId);
  }, [data, petshopId]);

  const estancadosRowsView = useMemo(() => estancadosRows.slice(0, 5), [estancadosRows]);

  const vuelta1Bars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, valuePct: m.vuelta1pct, count: m.vuelta1 }))
      .sort((a, b) => b.valuePct - a.valuePct);
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const vuelta2Bars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, valuePct: m.vuelta2pct, count: m.vuelta2 }))
      .sort((a, b) => b.valuePct - a.valuePct);
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const cancelPctBars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, value: round0(m.cancelPct), meta: m.cancel.toLocaleString("es-AR") }))
      .sort((a, b) => b.value - a.value);
    if (petshopId === "ALL") return rows;
    return rows.filter((r) => r.id === petshopId);
  }, [data, petshopId]);

  const splitPctBars = useMemo(() => {
    if (!data) return [];
    const rows = data.metricsByPetshop
      .map((m) => ({ id: m.petshopId, label: m.petshopName, value: round0(m.splitPct), meta: m.split.toLocaleString("es-AR") }))
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

  const cancelReasonsBars = useMemo(() => {
    if (!data) return [];

    const list: CancellationReasonBucket[] =
      petshopId === "ALL"
        ? (() => {
            const totals = new Map<string, { label: string; count: number }>();
            for (const m of data.metricsByPetshop) {
              for (const r0 of m.cancelReasons ?? []) {
                const prev = totals.get(r0.key) ?? { label: r0.label, count: 0 };
                totals.set(r0.key, { label: prev.label, count: prev.count + (r0.count ?? 0) });
              }
            }
            return Array.from(totals.entries()).map(([key, v]) => ({ key: key as CancellationReasonBucket["key"], label: v.label, count: v.count }));
          })()
        : data.metricsByPetshop.find((m) => m.petshopId === petshopId)?.cancelReasons ?? [];

    const totalCancel = Math.max(0, list.reduce((acc, x) => acc + (x.count ?? 0), 0));
    const rows = list
      .map((x) => ({
        id: x.key,
        label: x.label,
        valuePct: pct(x.count ?? 0, totalCancel),
        count: x.count ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    return rows.slice(0, 6);
  }, [data, petshopId]);

  const capacity = useMemo(() => {
    if (!data || !metricsSelected) return null;

    const active = data.petshops.filter((p0) => p0.active);
    const selectedPetshops = petshopId === "ALL" ? active : active.filter((p0) => p0.id === petshopId);
    const selectedIds = new Set(selectedPetshops.map((p0) => p0.id));
    const selectedMetrics = data.metricsByPetshop.filter((m0) => selectedIds.has(m0.petshopId));

    const sumHourly = (get: (m0: (typeof selectedMetrics)[number]) => { hour: number; used: number }[]) => {
      const map = new Map<number, number>();
      for (const m0 of selectedMetrics) {
        for (const b of get(m0) ?? []) map.set(b.hour, (map.get(b.hour) ?? 0) + (b.used ?? 0));
      }
      return Array.from(map.entries())
        .map(([hour, used]) => ({ hour, used }))
        .sort((a, b) => a.hour - b.hour);
    };

    const flexUsed = selectedMetrics.reduce((acc, m0) => acc + m0.capacityFlexHourly.reduce((a, b) => a + (b.used ?? 0), 0), 0);
    const franjaUsed = selectedMetrics.reduce((acc, m0) => acc + m0.capacityFranjaHourly.reduce((a, b) => a + (b.used ?? 0), 0), 0);

    const flexLimit = selectedPetshops.reduce((acc, p0) => acc + (p0.capacity.flexEnabled ? p0.capacity.flexPerDay : 0), 0);
    const franjaLimit = selectedPetshops.reduce((acc, p0) => {
      const nEnabled = (["10-14", "14-18", "18-22"] as const).filter((w) => p0.capacity.shortEnabled[w]).length;
      return acc + p0.capacity.shortPerWindow * nEnabled;
    }, 0);

    return {
      flex: {
        used: flexUsed,
        limit: flexLimit,
        hourly: sumHourly((m0) => m0.capacityFlexHourly),
        daily: sumDailyUsed(selectedMetrics, "flex"),
      },
      franja: {
        used: franjaUsed,
        limit: franjaLimit,
        hourly: sumHourly((m0) => m0.capacityFranjaHourly),
        daily: sumDailyUsed(selectedMetrics, "franja"),
      },
    };
  }, [data, metricsSelected, petshopId]);

  const capacityByPetshop = useMemo(() => {
    if (!data) return [];
    const psById = new Map(data.petshops.filter((p0) => p0.active).map((p0) => [p0.id, p0] as const));
    return data.metricsByPetshop
      .filter((m0) => psById.has(m0.petshopId))
      .map((m0) => {
        const ps = psById.get(m0.petshopId)!;
        const used1014 = sumHours(m0.capacityFranjaHourly, 10, 14);
        const used1418 = sumHours(m0.capacityFranjaHourly, 14, 18);
        const used1822 = sumHours(m0.capacityFranjaHourly, 18, 22);
        const flex1422 = sumHours(m0.capacityFlexHourly, 14, 22);
        return {
          id: m0.petshopId,
          label: m0.petshopName,
          used1014,
          used1418,
          used1822,
          flex1422,
          limits: ps.capacity,
        };
      })
      .sort((a, b) => (b.used1014 + b.used1418 + b.used1822) - (a.used1014 + a.used1418 + a.used1822));
  }, [data]);

  const shortCapacityRows = useMemo(() => {
    return capacityByPetshop.map((p0) => {
      const limitPerWindow = p0.limits.shortPerWindow;
      return {
        id: p0.id,
        label: p0.label,
        limitPerWindow,
        shortEnabled: p0.limits.shortEnabled,
        used1014: p0.used1014,
        used1418: p0.used1418,
        used1822: p0.used1822,
      };
    });
  }, [capacityByPetshop]);

  const shortCapacityPctRows = useMemo(() => {
    return shortCapacityRows.map((r) => ({
      id: r.id,
      label: r.label,
      shortEnabled: r.shortEnabled,
      p1014: r.shortEnabled["10-14"] ? round0(pct(r.used1014, Math.max(1, r.limitPerWindow))) : 0,
      p1418: r.shortEnabled["14-18"] ? round0(pct(r.used1418, Math.max(1, r.limitPerWindow))) : 0,
      p1822: r.shortEnabled["18-22"] ? round0(pct(r.used1822, Math.max(1, r.limitPerWindow))) : 0,
    }));
  }, [shortCapacityRows]);

  const flexCapacityRows = useMemo(() => {
    return capacityByPetshop
      .map((p0) => {
        const limit = p0.limits.flexEnabled ? p0.limits.flexPerDay : 0;
        const used = p0.flex1422 ?? 0;
        return { id: p0.id, label: p0.label, flexEnabled: p0.limits.flexEnabled, used, limit };
      })
      .sort((a, b) => b.used - a.used);
  }, [capacityByPetshop]);

  const flexCapacityPctRows = useMemo(() => {
    return flexCapacityRows.map((r) => ({
      id: r.id,
      label: r.label,
      flexEnabled: r.flexEnabled,
      pct0: r.flexEnabled && r.limit > 0 ? round0(pct(r.used, r.limit)) : 0,
    }));
  }, [flexCapacityRows]);

  const globalSplitBadge = useMemo(() => {
    const list = data?.metricsByPetshop ?? [];
    const total = list.reduce((acc, m) => acc + m.transacciones, 0);
    const split = list.reduce((acc, m) => acc + m.split, 0);
    return { split, pct: round0(pct(split, total)) };
  }, [data?.metricsByPetshop]);

  const splitSummary = useMemo(() => {
    if (!metricsSelected) return null;
    if (petshopId === "ALL")
      return { split: globalSplitBadge.split, pct0: globalSplitBadge.pct, total: metricsAll?.transacciones ?? metricsSelected.transacciones };
    return { split: metricsSelected.split ?? 0, pct0: round0(metricsSelected.splitPct ?? 0), total: metricsSelected.transacciones ?? 0 };
  }, [globalSplitBadge.pct, globalSplitBadge.split, metricsAll?.transacciones, metricsSelected, petshopId]);

  const viewPillText = petshopId === "ALL" ? "Vista global" : activePetshop?.name ?? "Petshop";

  const [totalDeltaPct, setTotalDeltaPct] = useState<number | null>(null);

  const favoritesStorageKey = "opsQuickAccess:favorites:v1";
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const qaDockStorageKey = "opsQuickAccess:dockOpen:v1";
  const [qaDockOpen, setQaDockOpen] = useState(false);
  const [shortCapacityOpen, setShortCapacityOpen] = useState(false);
  const [flexCapacityOpen, setFlexCapacityOpen] = useState(false);
  const [topbarHidden, setTopbarHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const themeStorageKey = "opsTheme:v1";
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(favoritesStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        setFavoriteIds(parsed);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(qaDockStorageKey);
      if (raw === "1") setQaDockOpen(true);
      if (raw === "0") setQaDockOpen(false);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(qaDockStorageKey, qaDockOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [qaDockOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteIds));
    } catch {
      // ignore
    }
  }, [favoriteIds]);

  useEffect(() => {
    // Stable mock delta: changes only when context changes, not on re-renders (e.g. theme toggle)
    if (!metricsSelected) {
      setTotalDeltaPct(null);
      return;
    }
    // Keep it deterministic-ish and stable for a given context
    const key = `${petshopId}|${from}|${to}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    const r01 = (Math.abs(hash) % 1000) / 1000; // 0..0.999
    const delta = (r01 - 0.4) * 20;
    setTotalDeltaPct(delta);
  }, [metricsSelected, petshopId, from, to]);

  const quickAccessByTopic = useMemo(() => {
    const map = new Map<string, QuickAccessItem[]>();
    for (const item of QUICK_ACCESS) {
      const list = map.get(item.topic) ?? [];
      list.push(item);
      map.set(item.topic, list);
    }
    return Array.from(map.entries());
  }, []);

  const favoriteItems = useMemo(() => {
    const idx = new Map(QUICK_ACCESS.map((x) => [x.id, x]));
    return favoriteIds.map((id) => idx.get(id)).filter(Boolean) as QuickAccessItem[];
  }, [favoriteIds]);

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToAndClose(id: string) {
    scrollToId(id);
    setQuickAccessOpen(false);
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const syncMobile = () => {
      isMobileRef.current = mq.matches;
      setIsMobile(mq.matches);
      if (!mq.matches) setTopbarHidden(false);
    };
    syncMobile();

    // Safari compatibility for matchMedia listeners
    const hasAddEvent = typeof (mq as MediaQueryList).addEventListener === "function";
    const add = hasAddEvent ? "addEventListener" : "addListener";
    const remove = hasAddEvent ? "removeEventListener" : "removeListener";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mq as any)[add]("change", syncMobile);

    lastScrollYRef.current = window.scrollY || 0;

    const onScroll = () => {
      if (!isMobileRef.current) return;
      if (quickAccessOpen) return;

      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const y = window.scrollY || 0;
        const prev = lastScrollYRef.current;
        const delta = y - prev;

        if (Math.abs(delta) < 6) return;

        if (delta > 0) {
          if (y > 60) setTopbarHidden(true);
        } else {
          setTopbarHidden(false);
        }

        lastScrollYRef.current = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mq as any)[remove]("change", syncMobile);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [quickAccessOpen]);

  useEffect(() => {
    try {
      // Always start in light mode on page load.
      setTheme("light");
      document.documentElement.dataset.theme = "light";
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(themeStorageKey, theme);
      document.documentElement.dataset.theme = theme;
    } catch {
      // ignore
    }
  }, [theme]);

  return (
    <main className="container">
      <div className={`topbar ${topbarHidden ? "topbarHidden" : ""}`}>
        <div className="title">
          <h1>Operaciones · MisPichos</h1>
          <p className="topbarMeta">
            <span className="pulseDot" aria-hidden="true" /> Última actualización: {now ? now.toLocaleString("es-AR") : "—"}{" "}
            {loading ? "· actualizando…" : ""}
          </p>
        </div>
        <div className="chipRow">
          <button
            type="button"
            className="btn quickAccessMobileBtn"
            onClick={() => (isMobile ? setQuickAccessOpen(true) : setQaDockOpen((v) => !v))}
            aria-label={isMobile ? "Abrir accesos" : qaDockOpen ? "Ocultar accesos" : "Mostrar accesos"}
            title={isMobile ? "Accesos" : qaDockOpen ? "Ocultar accesos" : "Mostrar accesos"}
          >
            {isMobile ? "Accesos" : qaDockOpen ? "Accesos ▾" : "Accesos ▸"}
          </button>
          <button
            type="button"
            className={`themeToggle ${theme === "dark" ? "isDark" : "isLight"}`}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          >
            <span className="themeToggleIcon" aria-hidden="true">
              {theme === "dark" ? "🌙" : "☀️"}
            </span>
            <span className="themeToggleText">{theme === "dark" ? "Oscuro" : "Claro"}</span>
          </button>
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

      {quickAccessOpen ? (
        <div className="qaModal" role="dialog" aria-modal="true" aria-label="Accesos rápidos" onClick={() => setQuickAccessOpen(false)}>
          <div className="qaModalPanel" onClick={(e) => e.stopPropagation()}>
            <div className="qaModalHeader">
              <div className="qaModalTitle">Accesos</div>
              <button type="button" className="btn btnIcon" onClick={() => setQuickAccessOpen(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>

            <div className="quickAccessBlock" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
              <div className="quickAccessBlockTitle">Mis accesos</div>
              {favoriteItems.length ? (
                <div className="quickAccessList">
                  {favoriteItems.map((it) => (
                    <button key={`fav-m-${it.id}`} type="button" className="quickAccessItem" onClick={() => goToAndClose(it.id)}>
                      <span className="quickAccessItemLabel">{it.label}</span>
                      <span className="quickAccessItemStar" aria-hidden="true">
                        ★
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="quickAccessEmpty">Marcá ★ en un tópico para fijarlo acá.</div>
              )}
            </div>

            {quickAccessByTopic.map(([topic, items]) => (
              <div key={`m-${topic}`} className="quickAccessBlock">
                <div className="quickAccessBlockTitle">{topic}</div>
                <div className="quickAccessList">
                  {items.map((it) => {
                    const isFav = favoriteIds.includes(it.id);
                    return (
                      <div key={`m-${it.id}`} className="quickAccessRow">
                        <button type="button" className="quickAccessItem" onClick={() => goToAndClose(it.id)}>
                          <span className="quickAccessItemLabel">{it.label}</span>
                        </button>
                        <button
                          type="button"
                          className={`quickAccessFavBtn ${isFav ? "isOn" : ""}`}
                          onClick={() => toggleFavorite(it.id)}
                          aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                          title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                        >
                          ★
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`dashboardLayout ${qaDockOpen ? "" : "qaClosed"}`}>
        <aside className="quickAccess" aria-label="Accesos rápidos">
          <div className="quickAccessCard">
            <div className="quickAccessTitleRow">
              <div className="quickAccessTitle">Accesos</div>
              <button type="button" className="btn btnIcon quickAccessClose" onClick={() => setQaDockOpen(false)} aria-label="Cerrar accesos" title="Cerrar">
                ×
              </button>
            </div>

            <div className="quickAccessBlock">
              <div className="quickAccessBlockTitle">Mis accesos</div>
              {favoriteItems.length ? (
                <div className="quickAccessList">
                  {favoriteItems.map((it) => (
                    <button key={`fav-${it.id}`} type="button" className="quickAccessItem" onClick={() => scrollToId(it.id)}>
                      <span className="quickAccessItemLabel">{it.label}</span>
                      <span className="quickAccessItemStar" aria-hidden="true">
                        ★
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="quickAccessEmpty">Marcá ★ en un tópico para fijarlo acá.</div>
              )}
            </div>

            {quickAccessByTopic.map(([topic, items]) => (
              <div key={topic} className="quickAccessBlock">
                <div className="quickAccessBlockTitle">{topic}</div>
                <div className="quickAccessList">
                  {items.map((it) => {
                    const isFav = favoriteIds.includes(it.id);
                    return (
                      <div key={it.id} className="quickAccessRow">
                        <button type="button" className="quickAccessItem" onClick={() => scrollToId(it.id)}>
                          <span className="quickAccessItemLabel">{it.label}</span>
                        </button>
                        <button
                          type="button"
                          className={`quickAccessFavBtn ${isFav ? "isOn" : ""}`}
                          onClick={() => toggleFavorite(it.id)}
                          aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                          title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                        >
                          ★
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="dashboardMain">
          <AiRecommendations data={data} from={from} to={to} />

          <section className="section" id="ops-live">
        <div className="sectionHeader">
          <div>
            <h2>Órdenes de transacción (en vivo)</h2>
            <p>KPIs operativos y distribución</p>
          </div>
        </div>

        <div className="kpiRow">
          <div
            className={`kpiMain ${
              metricsSelected && totalDeltaPct != null
                ? deltaBgClass(deltaBgTone(totalDeltaPct, KPI_DELTA_BG.total.mode, KPI_DELTA_BG.total.neutralAbsPct))
                : "kpiBgNeutral"
            }`}
          >
            <div className="kpiLabel">Total pedidos</div>
            <div className="kpiValueRow">
              <div className="kpiValue">{metricsSelected ? metricsSelected.total.toLocaleString("es-AR") : "—"}</div>
              <div className="kpiDeltaRight">
                {metricsSelected && totalDeltaPct != null ? <DeltaPill deltaPct={totalDeltaPct} mode="higher_better" /> : <span className="sub">—</span>}
              </div>
            </div>
            <div className="kpiSub">
              {metricsSelected && totalDeltaPct != null ? (
                (() => {
                  const prev = previousFromDelta(metricsSelected.total ?? 0, totalDeltaPct);
                  return prev != null ? <span className="mono">Anterior: {round0(prev).toLocaleString("es-AR")}</span> : <span>—</span>;
                })()
              ) : (
                "—"
              )}
            </div>
            <div className="kpiDivider" />
            <div className="kpiDetail">
              <span className="kpiDetailLabel">Transacciones</span>
              <span className="mono">{metricsSelected ? metricsSelected.transacciones.toLocaleString("es-AR") : "—"}</span>
            </div>

            <div className="kpiMiniGrid" aria-label="Indicadores generales">
              {(() => {
                // Mismo % que el doughnut "Entregas a tiempo": A tiempo / (A tiempo + Fuera de tiempo)
                const onTimePct =
                  metricsSelected != null ? pct(metricsSelected.onTimeN ?? 0, (metricsSelected.onTimeN ?? 0) + (metricsSelected.outTimeN ?? 0)) : null;
                const dOnTime = stableDeltaPctFor(`${petshopId}|${from}|${to}|onTimePct`);
                const slPct = petshopId === "ALL" ? slPctAvgAll : metricsSelected?.slPct ?? null;
                const dSl = stableDeltaPctFor(`${petshopId}|${from}|${to}|${petshopId === "ALL" ? "slPctAvg" : "slPct"}`);

                return (
                  <>
                    <div className={`kpiMiniBox ${deltaBgClass(deltaBgTone(dOnTime, KPI_DELTA_BG.onTime.mode, KPI_DELTA_BG.onTime.neutralAbsPct))}`}>
                      <div className="kpiMiniLabel">On-time</div>
                      <div className="kpiMiniRow">
                        <div className="kpiMiniValue mono">{onTimePct != null ? formatPct0(onTimePct) : "—"}</div>
                        <div className="kpiMiniDelta">{onTimePct != null ? <DeltaPill deltaPct={dOnTime} mode="higher_better" /> : <span className="sub">—</span>}</div>
                      </div>
                    </div>

                    <div className={`kpiMiniBox ${deltaBgClass(deltaBgTone(dSl, KPI_DELTA_BG.sl.mode, KPI_DELTA_BG.sl.neutralAbsPct))}`}>
                      <div className="kpiMiniLabel">{petshopId === "ALL" ? "Service level (prom.)" : "Service level"}</div>
                      <div className="kpiMiniRow">
                        <div className="kpiMiniValue mono">{slPct != null ? formatPct0(slPct) : "—"}</div>
                        <div className="kpiMiniDelta">{slPct != null ? <DeltaPill deltaPct={dSl} mode="higher_better" /> : <span className="sub">—</span>}</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="kpiSmallGrid">
            <div
              className={`kpiSmall ${
                metricsSelected
                  ? deltaBgClass(
                      deltaBgTone(
                        stableDeltaPctFor(`${petshopId}|${from}|${to}|cancel`),
                        KPI_DELTA_BG.cancel.mode,
                        KPI_DELTA_BG.cancel.neutralAbsPct
                      )
                    )
                  : "kpiBgNeutral"
              }`}
            >
              <div className="kpiLabel">Cancelados</div>
              {metricsSelected ? (
                (() => {
                  const d = stableDeltaPctFor(`${petshopId}|${from}|${to}|cancel`);
                  const prev = previousFromDelta(metricsSelected.cancel ?? 0, d);
                  return (
                    <>
                      <div className="kpiValueRow">
                        <div className="kpiValue">{metricsSelected.cancel}</div>
                        <div className="kpiDeltaRight">{prev != null ? <DeltaPill deltaPct={d} mode="lower_better" /> : <span className="sub">—</span>}</div>
                      </div>
                      <div className="kpiSub">{prev != null ? <span className="mono">Anterior: {round0(prev).toLocaleString("es-AR")}</span> : "—"}</div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="kpiValueRow">
                    <div className="kpiValue">—</div>
                    <div className="kpiDeltaRight">
                      <span className="sub">—</span>
                    </div>
                  </div>
                  <div className="kpiSub">—</div>
                </>
              )}
            </div>
            <div
              className={`kpiSmall ${
                metricsSelected
                  ? deltaBgClass(
                      deltaBgTone(
                        stableDeltaPctFor(`${petshopId}|${from}|${to}|vuelta1`),
                        KPI_DELTA_BG.vuelta1.mode,
                        KPI_DELTA_BG.vuelta1.neutralAbsPct
                      )
                    )
                  : "kpiBgNeutral"
              }`}
            >
              <div className="kpiLabel">1ra vuelta</div>
              {metricsSelected ? (
                (() => {
                  const d = stableDeltaPctFor(`${petshopId}|${from}|${to}|vuelta1`);
                  const prev = previousFromDelta(metricsSelected.vuelta1 ?? 0, d);
                  return (
                    <>
                      <div className="kpiValueRow">
                        <div className="kpiValue">{metricsSelected.vuelta1}</div>
                        <div className="kpiDeltaRight">{prev != null ? <DeltaPill deltaPct={d} mode="lower_better" /> : <span className="sub">—</span>}</div>
                      </div>
                      <div className="kpiSub">{prev != null ? <span className="mono">Anterior: {round0(prev).toLocaleString("es-AR")}</span> : "—"}</div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="kpiValueRow">
                    <div className="kpiValue">—</div>
                    <div className="kpiDeltaRight">
                      <span className="sub">—</span>
                    </div>
                  </div>
                  <div className="kpiSub">—</div>
                </>
              )}
            </div>
            <div
              className={`kpiSmall ${
                metricsSelected
                  ? deltaBgClass(
                      deltaBgTone(
                        stableDeltaPctFor(`${petshopId}|${from}|${to}|vuelta2`),
                        KPI_DELTA_BG.vuelta2.mode,
                        KPI_DELTA_BG.vuelta2.neutralAbsPct
                      )
                    )
                  : "kpiBgNeutral"
              }`}
            >
              <div className="kpiLabel">2da vuelta</div>
              {metricsSelected ? (
                (() => {
                  const d = stableDeltaPctFor(`${petshopId}|${from}|${to}|vuelta2`);
                  const prev = previousFromDelta(metricsSelected.vuelta2 ?? 0, d);
                  return (
                    <>
                      <div className="kpiValueRow">
                        <div className="kpiValue">{metricsSelected.vuelta2}</div>
                        <div className="kpiDeltaRight">{prev != null ? <DeltaPill deltaPct={d} mode="lower_better" /> : <span className="sub">—</span>}</div>
                      </div>
                      <div className="kpiSub">{prev != null ? <span className="mono">Anterior: {round0(prev).toLocaleString("es-AR")}</span> : "—"}</div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="kpiValueRow">
                    <div className="kpiValue">—</div>
                    <div className="kpiDeltaRight">
                      <span className="sub">—</span>
                    </div>
                  </div>
                  <div className="kpiSub">—</div>
                </>
              )}
            </div>
            <div
              className={`kpiSmall kpiSmallWide ${
                metricsSelected
                  ? deltaBgClass(
                      deltaBgTone(
                        stableDeltaPctFor(`${petshopId}|${from}|${to}|demSinDespachar`),
                        KPI_DELTA_BG.demSinDespachar.mode,
                        KPI_DELTA_BG.demSinDespachar.neutralAbsPct
                      )
                    )
                  : "kpiBgNeutral"
              }`}
            >
              <div className="kpiLabel">Demorado sin despachar</div>
              {metricsSelected ? (
                (() => {
                  const d = stableDeltaPctFor(`${petshopId}|${from}|${to}|demSinDespachar`);
                  const prev = previousFromDelta(metricsSelected.demSinDespachar ?? 0, d);
                  return (
                    <>
                      <div className="kpiValueRow">
                        <div className="kpiValue">{metricsSelected.demSinDespachar}</div>
                        <div className="kpiDeltaRight">{prev != null ? <DeltaPill deltaPct={d} mode="lower_better" /> : <span className="sub">—</span>}</div>
                      </div>
                      <div className="kpiSub">{prev != null ? <span className="mono">Anterior: {round0(prev).toLocaleString("es-AR")}</span> : "—"}</div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="kpiValueRow">
                    <div className="kpiValue">—</div>
                    <div className="kpiDeltaRight">
                      <span className="sub">—</span>
                    </div>
                  </div>
                  <div className="kpiSub">—</div>
                </>
              )}
            </div>
            <div
              className={`kpiSmall kpiSmallWide ${
                metricsSelected
                  ? deltaBgClass(
                      deltaBgTone(
                        stableDeltaPctFor(`${petshopId}|${from}|${to}|reprog`),
                        KPI_DELTA_BG.reprog.mode,
                        KPI_DELTA_BG.reprog.neutralAbsPct
                      )
                    )
                  : "kpiBgNeutral"
              }`}
            >
              <div className="kpiLabel">Reprogramar</div>
              {metricsSelected ? (
                (() => {
                  const d = stableDeltaPctFor(`${petshopId}|${from}|${to}|reprog`);
                  const prev = previousFromDelta(metricsSelected.reprog ?? 0, d);
                  return (
                    <>
                      <div className="kpiValueRow">
                        <div className="kpiValue">{metricsSelected.reprog}</div>
                        <div className="kpiDeltaRight">{prev != null ? <DeltaPill deltaPct={d} mode="lower_better" /> : <span className="sub">—</span>}</div>
                      </div>
                      <div className="kpiSub">{prev != null ? <span className="mono">Anterior: {round0(prev).toLocaleString("es-AR")}</span> : "—"}</div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="kpiValueRow">
                    <div className="kpiValue">—</div>
                    <div className="kpiDeltaRight">
                      <span className="sub">—</span>
                    </div>
                  </div>
                  <div className="kpiSub">—</div>
                </>
              )}
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
              legendLayout="twoCol"
            />
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Entregas a tiempo</div>
            </div>
            <p className="sub">
              {metricsSelected
                ? `Sobre creadas no canceladas: ${Math.max(0, metricsSelected.total - metricsSelected.cancel).toLocaleString("es-AR")}`
                : "—"}
            </p>
            <Doughnut
              aLabel="A tiempo"
              aValue={metricsSelected?.onTimeN ?? 0}
              aColor="var(--ok)"
              bLabel="Fuera de tiempo"
              bValue={metricsSelected?.outTimeN ?? 0}
              bColor="var(--bad)"
              legendLayout="twoCol"
            />
          </div>
        </div>
          </section>

      <section className="section" id="sl-live">
        <div className="sectionHeader">
          <div>
            <h2>Service level (SL) en tiempo real</h2>
            <p>SL = % entregadas sobre creadas</p>
          </div>
        </div>
        <div className="tableScroll">
          {isMobile ? (
            <table>
              <thead>
                <tr>
                  <th>Petshop</th>
                  <th>SL %</th>
                  <th>Estado</th>
                  <th>Creadas</th>
                  <th>Entregadas</th>
                  <th>Progreso</th>
                </tr>
              </thead>
              <tbody>
                {slRows.map((r) => (
                  <tr key={r.petshopId}>
                    <td>{r.petshopName}</td>
                    <td style={{ color: r.slPct >= 90 ? "var(--ok)" : r.slPct >= 85 ? "var(--warn)" : "var(--bad)" }}>
                      {formatPct0(r.slPct)}
                    </td>
                    <td>
                      <span className={badgeClassBySl(r.slPct)}>{slStatus(r.slPct)}</span>
                    </td>
                    <td className="mono">{r.total.toLocaleString("es-AR")}</td>
                    <td className="mono">{r.delivered.toLocaleString("es-AR")}</td>
                    <td>
                      <SlProgress slPct={r.slPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Petshop</th>
                  <th>Creadas</th>
                  <th>Entregadas</th>
                  <th>SL %</th>
                  <th>Progreso</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {slRows.map((r) => (
                  <tr key={r.petshopId}>
                    <td>{r.petshopName}</td>
                    <td className="mono">{r.total.toLocaleString("es-AR")}</td>
                    <td className="mono">{r.delivered.toLocaleString("es-AR")}</td>
                    <td style={{ color: r.slPct >= 90 ? "var(--ok)" : r.slPct >= 85 ? "var(--warn)" : "var(--bad)" }}>
                      {formatPct0(r.slPct)}
                    </td>
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
          )}
        </div>
      </section>

      <section className="section" id="top3">
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
              {isMobile ? (
                <div className="top3Main">
                  <div className="top3Name">{t0.petshopName}</div>
                  <div className="bar" aria-hidden="true">
                    <div style={{ width: `${clamp(t0.pct, 0, 100)}%`, background: "var(--info)" }} />
                  </div>
                  <div className="top3MetaRow">
                    <div className="mono">{formatPct0(t0.pct)}</div>
                    <div className="mono">{t0.orders.toLocaleString("es-AR")} pedidos</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="top3Main">
                    <div className="top3Name">{t0.petshopName}</div>
                    <div className="bar" aria-hidden="true">
                      <div style={{ width: `${clamp(t0.pct, 0, 100)}%`, background: "var(--info)" }} />
                    </div>
                  </div>
                  <div className="top3Pct">
                    <div className="mono">{formatPct0(t0.pct)}</div>
                    <div className="sub mono">{t0.orders.toLocaleString("es-AR")} pedidos</div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="reprogramar">
        <div className="sectionHeader">
          <div>
            <h2>Pedidos a reprogramar</h2>
            <p>Superaron 48hs sin gestión</p>
          </div>
        </div>
        <div className="sectionToolbar">
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
                {reprogramarRowsFiltered.length} · {reprogramarPage + 1}/{reprogramarPages}
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
            <div className="dtRange" aria-label="Filtro por fecha y hora">
              <input
                className="dtInput"
                type="datetime-local"
                value={reprogramarFromDt}
                onChange={(e) => setReprogramarFromDt(e.target.value)}
                aria-label="Desde"
              />
              <span className="sub">→</span>
              <input
                className="dtInput"
                type="datetime-local"
                value={reprogramarToDt}
                onChange={(e) => setReprogramarToDt(e.target.value)}
                aria-label="Hasta"
              />
              {(reprogramarFromDt || reprogramarToDt) && (
                <button className="btn btnIcon" type="button" onClick={() => (setReprogramarFromDt(""), setReprogramarToDt(""))} title="Limpiar filtro">
                  ×
                </button>
              )}
            </div>
            <CopyActionButton
              label="Wpp"
              className="btnPanelAction"
              onCopy={async () => {
                const headers = ["#pedido", "fecha", "franja"];
                const rows = reprogramarRows.map((r) => [
                  r.orderId,
                  new Date(r.createdAt).toLocaleDateString("es-AR"),
                  r.deliveryWindow ?? "",
                ]);
                await navigator.clipboard.writeText(toFixedWidthTable(headers, rows, { maxColWidths: [9, 10, 7], wrapInCodeBlock: false }));
              }}
            />
            <CopyActionButton
              label="Mail"
              className="btnPanelAction"
              onCopy={async () => {
                const headers = ["#pedido", "fecha y hora", "franja", "cliente", "domicilio", "producto", "petshop"];
                const rows = reprogramarRows.map((r) => [
                  r.orderId,
                  new Date(r.createdAt).toLocaleString("es-AR"),
                  r.deliveryWindow ?? "",
                  r.customer,
                  r.address,
                  r.product,
                  r.petshopName ?? "",
                ]);
                const text = toFixedWidthTable(headers, rows, { maxColWidths: [9, 19, 7, 18, 22, 26, 16], wrapInCodeBlock: true });
                const html = toHtmlTable(headers, rows);
                // Prefer HTML for mail clients; keep text fallback.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ClipboardItemCtor: any = (window as any).ClipboardItem;
                if (ClipboardItemCtor && navigator.clipboard?.write) {
                  await navigator.clipboard.write([new ClipboardItemCtor({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
                } else {
                  await navigator.clipboard.writeText(text);
                }
              }}
            />
            <button
              className="btn btnPanelAction"
              type="button"
              onClick={() => {
                const headers = ["pedido", "fecha_y_hora", "franja", "cliente", "domicilio", "producto", "petshop"];
                const rows = reprogramarRows.map((r) => [
                  r.orderId,
                  new Date(r.createdAt).toLocaleString("es-AR"),
                  r.deliveryWindow ?? "",
                  r.customer,
                  r.address,
                  r.product,
                  r.petshopName ?? "",
                ]);
                downloadTextFile(`pedidos_a_reprogramar_${from}_${to}.csv`, toCsv(headers, rows, ";"), "text/csv;charset=utf-8");
              }}
            >
              Descargar Excel
            </button>
          </div>
        </div>
        <div className="tableScroll">
          <table className="tableFixed">
            <colgroup>
              <col style={{ width: "92px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "64px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "260px" }} />
              <col style={{ width: "320px" }} />
              <col style={{ width: "160px" }} />
            </colgroup>
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
                  <td className="franjaCell">
                    <WindowPill win={r.deliveryWindow ?? null} />
                  </td>
                  <td className="truncate">{r.customer}</td>
                  <td className="truncate">{r.address}</td>
                  <td className="truncate">{r.product}</td>
                  <td className="truncate">{r.petshopName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" id="sin-despachar">
        <div className="sectionHeader">
          <div>
            <h2>Demorado sin despachar</h2>
            <p>Etiqueta impresa &gt;24hs sin driver</p>
          </div>
        </div>
        <div className="sectionToolbar">
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
                {sinDespacharRowsFiltered.length} · {sinDespacharPage + 1}/{sinDespacharPages}
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
            <div className="dtRange" aria-label="Filtro por fecha y hora">
              <input
                className="dtInput"
                type="datetime-local"
                value={sinDespacharFromDt}
                onChange={(e) => setSinDespacharFromDt(e.target.value)}
                aria-label="Desde"
              />
              <span className="sub">→</span>
              <input
                className="dtInput"
                type="datetime-local"
                value={sinDespacharToDt}
                onChange={(e) => setSinDespacharToDt(e.target.value)}
                aria-label="Hasta"
              />
              {(sinDespacharFromDt || sinDespacharToDt) && (
                <button className="btn btnIcon" type="button" onClick={() => (setSinDespacharFromDt(""), setSinDespacharToDt(""))} title="Limpiar filtro">
                  ×
                </button>
              )}
            </div>
            <CopyActionButton
              label="Wpp"
              className="btnPanelAction"
              onCopy={async () => {
                const headers = ["#pedido", "fecha", "franja"];
                const rows = sinDespacharRows.map((r) => [
                  r.orderId,
                  new Date(r.labelPrintedAt).toLocaleDateString("es-AR"),
                  r.deliveryWindow ?? "",
                ]);
                await navigator.clipboard.writeText(toFixedWidthTable(headers, rows, { maxColWidths: [9, 10, 7], wrapInCodeBlock: false }));
              }}
            />
            <CopyActionButton
              label="Mail"
              className="btnPanelAction"
              onCopy={async () => {
                const headers = ["#pedido", "etiqueta impresa", "franja", "cliente", "domicilio", "producto", "petshop", "horas espera"];
                const rows = sinDespacharRows.map((r) => [
                  r.orderId,
                  new Date(r.labelPrintedAt).toLocaleString("es-AR"),
                  r.deliveryWindow ?? "",
                  r.customer,
                  r.address,
                  r.product,
                  r.petshopName ?? "",
                  `${round0(r.waitHours)}h`,
                ]);
                const text = toFixedWidthTable(headers, rows, { maxColWidths: [9, 19, 7, 18, 22, 26, 16, 11], wrapInCodeBlock: true });
                const html = toHtmlTable(headers, rows);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ClipboardItemCtor: any = (window as any).ClipboardItem;
                if (ClipboardItemCtor && navigator.clipboard?.write) {
                  await navigator.clipboard.write([new ClipboardItemCtor({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
                } else {
                  await navigator.clipboard.writeText(text);
                }
              }}
            />
            <button
              className="btn btnPanelAction"
              type="button"
              onClick={() => {
                const headers = ["pedido", "etiqueta_impresa", "franja", "cliente", "domicilio", "producto", "petshop", "horas_espera"];
                const rows = sinDespacharRows.map((r) => [
                  r.orderId,
                  new Date(r.labelPrintedAt).toLocaleString("es-AR"),
                  r.deliveryWindow ?? "",
                  r.customer,
                  r.address,
                  r.product,
                  r.petshopName ?? "",
                  String(round0(r.waitHours)),
                ]);
                downloadTextFile(`demorado_sin_despachar_${from}_${to}.csv`, toCsv(headers, rows, ";"), "text/csv;charset=utf-8");
              }}
            >
              Descargar Excel
            </button>
          </div>
        </div>
        <div className="tableScroll">
          <table className="tableFixed">
            <colgroup>
              <col style={{ width: "92px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "64px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "280px" }} />
              <col style={{ width: "340px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
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
                    <td className="franjaCell">
                      <WindowPill win={r.deliveryWindow ?? null} />
                    </td>
                    <td className="truncate">{r.customer}</td>
                    <td className="truncate">{r.address}</td>
                    <td className="truncate">{r.product}</td>
                    <td style={{ color, fontWeight: 500 }}>{round0(r.waitHours)}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" id="demoras">
        <div className="sectionHeader">
          <div>
            <h2>1ra vuelta y 2da vuelta</h2>
            <p>Porcentaje por petshop</p>
          </div>
        </div>
        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">1ra vuelta</div>
            </div>
            <BarList items={vuelta1Bars} color="var(--warn)" />
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">2da vuelta</div>
            </div>
            <BarList items={vuelta2Bars} color="color-mix(in srgb, var(--bad) 75%, transparent)" />
          </div>
        </div>
      </section>

      <section className="section" id="estancados">
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

      <section className="section" id="cancelados">
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
            <VerticalBars items={cancelPctBars} color="var(--bad)" valueFormatter={(n) => `${n}%`} />
            <div className="kpiDivider" />
            <div className="miniHeader" style={{ marginTop: 10 }}>
              <div className="miniTitle">Motivos de cancelación</div>
              <div className="sub">{petshopId === "ALL" ? "Vista global" : "Petshop seleccionado"}</div>
            </div>
            {cancelReasonsBars.length ? (
              <BarList items={cancelReasonsBars} color="color-mix(in srgb, var(--bad) 70%, transparent)" />
            ) : (
              <div className="sub">—</div>
            )}
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

      <section className="section" id="spliteados">
        <div className="sectionHeader">
          <div>
            <h2>Transacciones spliteadas</h2>
            <p>Transacciones con 2+ compras asignadas a distintos petshops</p>
          </div>
        </div>
        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Total spliteados</div>
              <span className="pill badgeInfo">{splitSummary ? `${splitSummary.pct0}%` : "—"}</span>
            </div>
            <div className="kpi">
              <div>
                <div className="value mono">{splitSummary ? splitSummary.split.toLocaleString("es-AR") : "—"}</div>
                <div className="sub">
                  {splitSummary ? `sobre ${splitSummary.total.toLocaleString("es-AR")} transacciones` : "—"}
                </div>
              </div>
            </div>
            {splitSummary ? (
              <div style={{ marginTop: 10 }}>
                <div className="bar" aria-hidden="true">
                  <div style={{ width: `${clamp(splitSummary.pct0, 0, 100)}%`, background: "var(--info)" }} />
                </div>
              </div>
            ) : null}

            {splitSummary ? (
              <div style={{ marginTop: 12 }}>
                <PieSplit
                  pct0={splitSummary.pct0}
                  aLabel="Spliteados"
                  aValue={splitSummary.split}
                  aColor="var(--info)"
                  bLabel="No spliteados"
                  bValue={Math.max(0, splitSummary.total - splitSummary.split)}
                  bColor="color-mix(in srgb, var(--muted) 28%, var(--surface2))"
                />
              </div>
            ) : null}
          </div>

          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">% spliteados por petshop</div>
            </div>
            <VerticalBars items={splitPctBars} color="var(--info)" valueFormatter={(n) => `${n}%`} />
          </div>
        </div>
      </section>

      <section className="section" id="soluciones">
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

      <section className="section" id="capacidad">
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
              {capacity ? (
                <div className="utilRight">
                  <div className="utilPct" style={{ color: usageColor(capacity.flex.used / capacity.flex.limit) }}>
                    {formatPct0(pct(capacity.flex.used, capacity.flex.limit))}
                  </div>
                  <div className="sub mono">
                    {capacity.flex.used}/{capacity.flex.limit}
                  </div>
                </div>
              ) : (
                <div className="sub">—</div>
              )}
            </div>
            {capacity ? (
              <>
                <div className="bar" aria-hidden="true">
                  <div
                    style={{
                      width: `${clamp((capacity.flex.used / capacity.flex.limit) * 100, 0, 100)}%`,
                      background: usageColor(capacity.flex.used / capacity.flex.limit),
                    }}
                  />
                </div>
                <LineMini
                  points={(capacity.flex.daily?.length ? capacity.flex.daily : []).map((x, i) => ({ x: i, y: x.used }))}
                  limit={round0(capacity.flex.limit)}
                  color="var(--capFlex)"
                />
                <div className="utilMeta">
                  <span className="utilChip utilChipLimit">
                    <span className="utilChipSwatch utilChipSwatchLimit" aria-hidden="true" />
                    <span className="utilChipLabel">Capacidad</span>
                    <span className="utilChipValue">{round0(capacity.flex.limit)}</span>
                  </span>
                  <span className="utilChip utilChipUsed">
                    <span className="utilChipSwatch utilChipSwatchUsed" aria-hidden="true" />
                    <span className="utilChipLabel">Usado</span>
                    <span className="utilChipValue">{round0(capacity.flex.used)}</span>
                  </span>
                  <span className="utilChip utilChipRemain">
                    <span className="utilChipSwatch utilChipSwatchRemain" aria-hidden="true" />
                    <span className="utilChipLabel">Restante</span>
                    <span className="utilChipValue">{Math.max(0, round0(capacity.flex.limit - capacity.flex.used))}</span>
                  </span>
                </div>
              </>
            ) : null}
          </div>
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Franja corta</div>
              {capacity ? (
                <div className="utilRight">
                  <div className="utilPct" style={{ color: usageColor(capacity.franja.used / capacity.franja.limit) }}>
                    {formatPct0(pct(capacity.franja.used, capacity.franja.limit))}
                  </div>
                  <div className="sub mono">
                    {capacity.franja.used}/{capacity.franja.limit}
                  </div>
                </div>
              ) : (
                <div className="sub">—</div>
              )}
            </div>
            {capacity ? (
              <>
                <div className="bar" aria-hidden="true">
                  <div
                    style={{
                      width: `${clamp((capacity.franja.used / capacity.franja.limit) * 100, 0, 100)}%`,
                      background: usageColor(capacity.franja.used / capacity.franja.limit),
                    }}
                  />
                </div>
                <LineMini
                  points={(capacity.franja.daily?.length ? capacity.franja.daily : []).map((x, i) => ({ x: i, y: x.used }))}
                  limit={round0(capacity.franja.limit)}
                  color="var(--cap1418)"
                />
                <div className="utilMeta">
                  <span className="utilChip utilChipLimit">
                    <span className="utilChipSwatch utilChipSwatchLimit" aria-hidden="true" />
                    <span className="utilChipLabel">Capacidad</span>
                    <span className="utilChipValue">{round0(capacity.franja.limit)}</span>
                  </span>
                  <span className="utilChip utilChipUsed">
                    <span className="utilChipSwatch utilChipSwatchUsed" aria-hidden="true" />
                    <span className="utilChipLabel">Usado</span>
                    <span className="utilChipValue">{round0(capacity.franja.used)}</span>
                  </span>
                  <span className="utilChip utilChipRemain">
                    <span className="utilChipSwatch utilChipSwatchRemain" aria-hidden="true" />
                    <span className="utilChipLabel">Restante</span>
                    <span className="utilChipValue">{Math.max(0, round0(capacity.franja.limit - capacity.franja.used))}</span>
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="twoCol">
          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Flex (14–22) por petshop</div>
              <div className="sub">% de uso por petshop (usado / capacidad)</div>
            </div>
            {flexCapacityPctRows.length ? (
              <>
                <button type="button" className="chartButton" onClick={() => setFlexCapacityOpen(true)} aria-label="Ver usado vs capacidad Flex por petshop">
                  <div className="flexUtilHeader">
                    <span className="shortUtilHLabel">Petshop</span>
                    <span className="shortUtilHWin" style={{ color: "var(--capFlex)" }}>
                      14–22
                    </span>
                  </div>
                  <div className="flexUtilList">
                    {flexCapacityPctRows.map((r) => (
                      <div key={r.id} className="flexUtilRow">
                        <div className="shortUtilLabel truncate" title={r.label}>
                          {r.label}
                        </div>
                        <div className="shortUtilCell">
                          {r.flexEnabled ? (
                            <div className={`shortUtilBar ${nearCapacityPctClass(r.pct0)}`} style={{ ["--c" as never]: "var(--capFlex)", ["--p" as never]: `${clamp(r.pct0, 0, 100)}%` }}>
                              {r.pct0}%
                            </div>
                          ) : (
                            <div className="shortUtilBar" style={{ ["--c" as never]: "var(--ok)", ["--p" as never]: `0%` }}>
                              OFF
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <div className="sub">—</div>
            )}
          </div>

          <div className="miniCard">
            <div className="miniHeader">
              <div className="miniTitle">Franja corta por petshop</div>
              <div className="sub">% de uso por franja (usado / capacidad por ventana)</div>
            </div>
            {shortCapacityPctRows.length ? (
              <>
                <button type="button" className="chartButton" onClick={() => setShortCapacityOpen(true)} aria-label="Ver usado vs capacidad franja corta por petshop">
                  <div className="shortUtilHeader">
                    <span className="shortUtilHLabel">Petshop</span>
                    <span className="shortUtilHWin" style={{ color: "var(--cap1014)" }}>
                      10–14
                    </span>
                    <span className="shortUtilHWin" style={{ color: "var(--cap1418)" }}>
                      14–18
                    </span>
                    <span className="shortUtilHWin" style={{ color: "var(--cap1822)" }}>
                      18–22
                    </span>
                  </div>
                  <div className="shortUtilList">
                    {shortCapacityPctRows.map((r) => (
                      <div key={r.id} className="shortUtilRow">
                        <div className="shortUtilLabel truncate" title={r.label}>
                          {r.label}
                        </div>
                        <div className="shortUtilCell">
                          <div className={`shortUtilBar ${nearCapacityPctClass(r.p1014)}`} style={{ ["--c" as never]: "var(--cap1014)", ["--p" as never]: `${clamp(r.p1014, 0, 100)}%` }}>
                            {r.shortEnabled["10-14"] ? `${r.p1014}%` : "OFF"}
                          </div>
                        </div>
                        <div className="shortUtilCell">
                          <div className={`shortUtilBar ${nearCapacityPctClass(r.p1418)}`} style={{ ["--c" as never]: "var(--cap1418)", ["--p" as never]: `${clamp(r.p1418, 0, 100)}%` }}>
                            {r.shortEnabled["14-18"] ? `${r.p1418}%` : "OFF"}
                          </div>
                        </div>
                        <div className="shortUtilCell">
                          <div className={`shortUtilBar ${nearCapacityPctClass(r.p1822)}`} style={{ ["--c" as never]: "var(--cap1822)", ["--p" as never]: `${clamp(r.p1822, 0, 100)}%` }}>
                            {r.shortEnabled["18-22"] ? `${r.p1822}%` : "OFF"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <div className="sub">—</div>
            )}
          </div>
        </div>

        {shortCapacityOpen ? (
          <div className="qaModal" role="dialog" aria-modal="true" aria-label="Franja corta · usado vs capacidad">
            <div className="qaModalPanel">
              <div className="qaModalHeader">
                <div className="qaModalTitle">Franja corta · usado vs capacidad</div>
                <button type="button" className="btn btnIcon" onClick={() => setShortCapacityOpen(false)} aria-label="Cerrar">
                  ✕
                </button>
              </div>
              <div className="tableScroll">
                <table>
                  <thead>
                    <tr>
                      <th>Petshop</th>
                      <th>10–14</th>
                      <th>14–18</th>
                      <th>18–22</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortCapacityRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.label}</td>
                        <td className={`mono ${r.shortEnabled["10-14"] ? nearCapacityClass(r.used1014, r.limitPerWindow) : ""}`}>
                          {r.shortEnabled["10-14"] ? `${r.used1014}/${r.limitPerWindow}` : "OFF"}
                        </td>
                        <td className={`mono ${r.shortEnabled["14-18"] ? nearCapacityClass(r.used1418, r.limitPerWindow) : ""}`}>
                          {r.shortEnabled["14-18"] ? `${r.used1418}/${r.limitPerWindow}` : "OFF"}
                        </td>
                        <td className={`mono ${r.shortEnabled["18-22"] ? nearCapacityClass(r.used1822, r.limitPerWindow) : ""}`}>
                          {r.shortEnabled["18-22"] ? `${r.used1822}/${r.limitPerWindow}` : "OFF"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {flexCapacityOpen ? (
          <div className="qaModal" role="dialog" aria-modal="true" aria-label="Flex (14–22) · usado vs capacidad">
            <div className="qaModalPanel">
              <div className="qaModalHeader">
                <div className="qaModalTitle">Flex (14–22) · usado vs capacidad</div>
                <button type="button" className="btn btnIcon" onClick={() => setFlexCapacityOpen(false)} aria-label="Cerrar">
                  ✕
                </button>
              </div>
              <div className="tableScroll">
                <table>
                  <thead>
                    <tr>
                      <th>Petshop</th>
                      <th>14–22</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flexCapacityRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.label}</td>
                        <td className={`mono ${r.flexEnabled ? nearCapacityClass(r.used, r.limit) : ""}`}>{r.flexEnabled ? `${r.used}/${r.limit}` : "OFF"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </section>
        </div>
      </div>
    </main>
  );
}

