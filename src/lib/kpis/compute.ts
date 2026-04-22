import { OperationsDataset, OrderSummary } from "@/lib/domain/models";

export type KpiStatus = "good" | "warn" | "bad" | "info";

export type KpiCard = {
  id: string;
  title: string;
  subtitle?: string;
  absolute: number;
  percent?: number; // 0..100
  status: KpiStatus;
  targetPercent?: number; // for progress bar reference
};

function hoursBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return (b - a) / (1000 * 60 * 60);
}

function safePercent(n: number, d: number) {
  if (d <= 0) return 0;
  return (n / d) * 100;
}

export function filterDatasetByPeriod(
  ds: OperationsDataset,
  fromIsoInclusive?: string,
  toIsoExclusive?: string,
): OperationsDataset {
  const from = fromIsoInclusive ? new Date(fromIsoInclusive).getTime() : undefined;
  const to = toIsoExclusive ? new Date(toIsoExclusive).getTime() : undefined;

  const orders = ds.orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    if (from !== undefined && t < from) return false;
    if (to !== undefined && t >= to) return false;
    return true;
  });

  const transactions = ds.transactions.filter((t0) => {
    const t = new Date(t0.createdAt).getTime();
    if (from !== undefined && t < from) return false;
    if (to !== undefined && t >= to) return false;
    return true;
  });

  return { ...ds, orders, transactions };
}

export function isReprogramar(order: OrderSummary, nowIso: string) {
  if (!order.scheduledFor) return false;
  return hoursBetween(order.scheduledFor, nowIso) > 48;
}

export function isDemoradoSinDespachar(order: OrderSummary, nowIso: string) {
  if (!order.labelPrintedAt) return false;
  if (order.driverTakenAt) return false;
  return hoursBetween(order.labelPrintedAt, nowIso) > 24;
}

export function isEstancado(order: OrderSummary) {
  return Boolean(order.misPichosAssignedAt) && !order.petchopAssignedAt;
}

export function isDemorado1raVuelta(order: OrderSummary, nowIso: string) {
  if (!order.firstAttemptAt) return false;
  return hoursBetween(order.firstAttemptAt, nowIso) > 24 && hoursBetween(order.firstAttemptAt, nowIso) <= 48;
}

export function isDemorado2daVuelta(order: OrderSummary, nowIso: string) {
  if (!order.secondAttemptAt) return false;
  return hoursBetween(order.secondAttemptAt, nowIso) > 48;
}

function statusByPercentBadHigh(p: number): KpiStatus {
  if (p >= 20) return "bad";
  if (p >= 8) return "warn";
  return "good";
}

export function computeOperationsKpis(ds: OperationsDataset): {
  cards: KpiCard[];
  lists: {
    reprogramar: OrderSummary[];
    sinDespachar: OrderSummary[];
  };
} {
  const nowIso = ds.now;
  const totalOrders = ds.orders.length;
  const totalTransactions = ds.transactions.length;

  const reprogramar = ds.orders.filter((o) => isReprogramar(o, nowIso));
  const sinDespachar = ds.orders.filter((o) => isDemoradoSinDespachar(o, nowIso));
  const estancados = ds.orders.filter((o) => isEstancado(o));
  const dem1 = ds.orders.filter((o) => isDemorado1raVuelta(o, nowIso));
  const dem2 = ds.orders.filter((o) => isDemorado2daVuelta(o, nowIso));

  const pctReprog = safePercent(reprogramar.length, totalOrders);
  const pctSinDesp = safePercent(sinDespachar.length, totalOrders);
  const pctEstanc = safePercent(estancados.length, totalOrders);
  const pctDem1 = safePercent(dem1.length, totalOrders);
  const pctDem2 = safePercent(dem2.length, totalOrders);

  const cards: KpiCard[] = [
    {
      id: "orders",
      title: "Pedidos (órdenes)",
      subtitle: "Total en la ventana actual",
      absolute: totalOrders,
      status: "info",
    },
    {
      id: "transactions",
      title: "Transacciones (tickets)",
      subtitle: "Total en la ventana actual",
      absolute: totalTransactions,
      status: "info",
    },
    {
      id: "reprogramar",
      title: "Reprogramar (>48hs)",
      subtitle: "Pedidos fuera de SLA",
      absolute: reprogramar.length,
      percent: pctReprog,
      status: statusByPercentBadHigh(pctReprog),
      targetPercent: 20,
    },
    {
      id: "sin_despachar",
      title: "Sin despachar (>24hs)",
      subtitle: "Etiqueta impresa, sin driver",
      absolute: sinDespachar.length,
      percent: pctSinDesp,
      status: statusByPercentBadHigh(pctSinDesp),
      targetPercent: 20,
    },
    {
      id: "estancados",
      title: "Estancados",
      subtitle: "MisPichos asignado, sin petchop",
      absolute: estancados.length,
      percent: pctEstanc,
      status: statusByPercentBadHigh(pctEstanc),
      targetPercent: 20,
    },
    {
      id: "demorado_vueltas",
      title: "Demorados (1ra/2da vuelta)",
      subtitle: "1ra >24hs, 2da >48hs",
      absolute: dem1.length + dem2.length,
      percent: safePercent(dem1.length + dem2.length, totalOrders),
      status: statusByPercentBadHigh(safePercent(dem1.length + dem2.length, totalOrders)),
      targetPercent: 20,
    },
    {
      id: "demorado_1ra",
      title: "Demorado 1ra vuelta",
      subtitle: "Más de 24hs",
      absolute: dem1.length,
      percent: pctDem1,
      status: statusByPercentBadHigh(pctDem1),
      targetPercent: 20,
    },
    {
      id: "demorado_2da",
      title: "Demorado 2da vuelta",
      subtitle: "Más de 48hs",
      absolute: dem2.length,
      percent: pctDem2,
      status: statusByPercentBadHigh(pctDem2),
      targetPercent: 20,
    },
  ];

  return {
    cards,
    lists: {
      reprogramar,
      sinDespachar,
    },
  };
}

