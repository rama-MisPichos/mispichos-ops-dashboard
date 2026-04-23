export type Petshop = {
  id: string;
  name: string;
  active: boolean;
};

export type OpsRowBase = {
  orderId: string;
  createdAt: string; // ISO
  customer: string;
  address: string;
  deliveryWindow?: "10-14" | "14-18" | "18-22";
  product: string;
  petshopId?: string; // undefined means "sin petshop" (caso estancado)
  petshopName?: string;
};

export type ReprogramarRow = OpsRowBase;

export type SinDespacharRow = OpsRowBase & {
  labelPrintedAt: string; // ISO
  waitHours: number;
};

export type EstancadoRow = OpsRowBase & {
  waitHours: number;
};

export type TimelineBucket = {
  t: string; // ISO day start
  total: number;
  transacciones: number;
  cancel: number;
  reprog: number;
  sindesp: number;
};

export type ManualCloseBucket = { t: string; count: number };

export type CapacityHourBucket = { hour: number; used: number };

export type CancellationReasonKey =
  | "mispichos_fault"
  | "no_payment"
  | "duplicate_purchase"
  | "petshop_fault"
  | "customer_regrets"

export type CancellationReasonBucket = {
  key: CancellationReasonKey;
  label: string;
  count: number;
};

export const CANCELLATION_REASONS: { key: CancellationReasonKey; label: string }[] = [
  { key: "mispichos_fault", label: "Culpa de MisPichos" },
  { key: "no_payment", label: "Falta de pago" },
  { key: "duplicate_purchase", label: "Duplicada" },
  { key: "petshop_fault", label: "Culpa de Petshop" },
  { key: "customer_regrets", label: "Cliente se arrepiente" },
];

export type PetshopMetrics = {
  petshopId: string;
  petshopName: string;

  // Required keys (as requested)
  total: number;
  delivered: number;
  transacciones: number;
  sindesp: number;
  d1: number;
  d1pct: number;
  d2: number;
  d2pct: number;
  reprog: number;
  cancel: number;
  cancelPct: number;
  split: number;
  splitPct: number;
  newClients: number;
  recurrentClients: number;
  newPct: number;
  recPct: number;
  /** Entregadas a tiempo (sobre creadas no canceladas) */
  onTimeN: number;
  /** Entregadas fuera de tiempo (sobre creadas no canceladas) */
  outTimeN: number;
  /** % entregadas a tiempo sobre (creadas - canceladas) */
  onTimePct: number;
  /** % entregadas fuera de tiempo sobre (creadas - canceladas) */
  outTimePct: number;

  // SL
  slPct: number;

  // Series
  manualCloseLast7: ManualCloseBucket[];
  cancelNewVsRec: { new: number; recurrent: number };
  cancelReasons: CancellationReasonBucket[];
  solutions: number;
  devoluciones: number;
  retiros: number;

  // Capacity
  capacityFlexHourly: CapacityHourBucket[];
  capacityFranjaHourly: CapacityHourBucket[];
};

export type OpsDashboardResponse = {
  now: string;
  range: { from: string; to: string };
  petshops: Petshop[];
  metricsByPetshop: PetshopMetrics[];
  timelineDaily: TimelineBucket[];
  reprogramarRows: ReprogramarRow[];
  sinDespacharRows: SinDespacharRow[];
  estancadosRows: EstancadoRow[];
  top3Petshops: { petshopId: string; petshopName: string; pct: number; orders: number }[];
  capacityLimits: { flexPerDay: number; franjaPerDay: number };
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round0(n: number) {
  return Math.round(n);
}

function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function iso(d: Date) {
  return d.toISOString();
}

function pick<T>(rnd: () => number, arr: T[]) {
  return arr[Math.floor(rnd() * arr.length)];
}

function distributeByWeights(total: number, weights: number[], rnd: () => number) {
  if (total <= 0) return weights.map(() => 0);
  const n = Math.max(1, weights.length);
  const safe = weights.map((w) => Math.max(0, w));
  const sum = safe.reduce((a, b) => a + b, 0) || n;
  const raw = safe.map((w) => (total * w) / sum);
  const floors = raw.map((x) => Math.floor(x));
  let remaining = Math.max(0, total - floors.reduce((a, b) => a + b, 0));

  // Largest remainder method with a tiny random tie-breaker.
  const order = raw
    .map((x, i) => ({ i, rem: x - Math.floor(x), tie: rnd() }))
    .sort((a, b) => (b.rem === a.rem ? b.tie - a.tie : b.rem - a.rem));

  const out = floors.slice();
  for (let k = 0; remaining > 0; k = (k + 1) % order.length) {
    out[order[k]!.i]! += 1;
    remaining -= 1;
  }

  return out;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pickDeliveryWindow(rnd: () => number): OpsRowBase["deliveryWindow"] {
  return pick(rnd, ["10-14", "14-18", "18-22"] as const);
}

function dateWithWindow(base: Date, win: OpsRowBase["deliveryWindow"], rnd: () => number) {
  const d = new Date(base);
  const [a0, b0] = (win ?? "14-18").split("-").map((x) => Number(x));
  const hour = a0 + Math.floor(rnd() * Math.max(1, b0 - a0));
  const minutes = [0, 5, 10, 15, 20, 22, 30, 35, 40, 45, 50, 55][Math.floor(rnd() * 12)] ?? 0;
  d.setHours(hour, minutes, 0, 0);
  return d;
}

function orderIdNumeric(seed: number) {
  return String(1424413 + seed);
}

function buildCapacityHourly(rnd: () => number, limitPerDay: number): CapacityHourBucket[] {
  // In real ops they rarely exceed capacity, so keep utilization under ~90% most days.
  const util = 0.55 + rnd() * 0.33; // 55%..88%
  const targetTotal = limitPerDay * util;

  const weights: number[] = [];
  for (let h = 0; h < 24; h++) {
    const wave = Math.sin(((h - 8) / 24) * Math.PI * 2) * 0.5 + 0.5; // 0..1
    const noise = 0.75 + rnd() * 0.7;
    weights.push(Math.max(0.05, wave * noise));
  }
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;

  const hourly: CapacityHourBucket[] = weights.map((w, hour) => ({ hour, used: (w / sumW) * targetTotal }));

  // Round to ints and keep sum close to target without exceeding limit.
  const rounded = hourly.map((b) => ({ ...b, used: Math.max(0, Math.floor(b.used)) }));
  let diff = Math.max(0, Math.floor(targetTotal) - rounded.reduce((a, b) => a + b.used, 0));
  while (diff > 0) {
    const h = Math.floor(rnd() * 24);
    rounded[h]!.used += 1;
    diff -= 1;
  }

  const sumRounded = rounded.reduce((a, b) => a + b.used, 0);
  const maxAllowed = Math.floor(limitPerDay * 0.93);
  if (sumRounded > maxAllowed) {
    const ratio = maxAllowed / sumRounded;
    return rounded.map((b) => ({ hour: b.hour, used: Math.floor(b.used * ratio) }));
  }

  return rounded;
}

export function getMockOpsDashboard(fromIso: string, toIso: string): OpsDashboardResponse {
  const rnd = mulberry32(99);
  const now = new Date();

  const petshops: Petshop[] = [
    { id: "farmapet_city", name: "Farmapet City", active: true },
    { id: "oh_my_dog", name: "Oh My Dog", active: true },
    { id: "poopy_food", name: "Poopy Food", active: true },
    { id: "petfy", name: "Petfy", active: true },
    { id: "mundo_silvestre", name: "Mundo Silvestre", active: true },
    { id: "veterinaria_juncal", name: "Veterinaria Juncal", active: true },
    { id: "puppis", name: "Puppis", active: true },
    { id: "selpy_pets", name: "Selpy Pets", active: true },
    { id: "leocan", name: "Leocan", active: true },
    { id: "beauty_pet_shop", name: "Beauty Pet Shop", active: true },
    // Cuando ningún petshop toma el pedido, se deriva a nosotros.
    { id: "mis_pichos", name: "Mis Pichos", active: true },
  ];

  const customers = [
    "Milagros Bello",
    "Juan Pérez",
    "María Gómez",
    "Sofía Luna",
    "Nicolás Rivas",
    "Florencia Paz",
    "Carolina Torres",
    "Pablo Molina",
  ];
  const partidos = ["San Fernando", "Tigre", "Vicente López", "San Isidro", "Tres de Febrero", "Morón", "Quilmes", "Avellaneda"];
  const streets = [
    "Av. Int. Adolfo Arnoldi 1544 Pasillo",
    "Av. Libertador 1200 Piso 3",
    "Uruguay 950",
    "Belgrano 220",
    "Rivadavia 1550",
    "Mitre 33",
    "San Martín 500",
  ];
  const products = [
    "Cepillo Gato y Perro Saca Pelo Cardina Mascotas Autolimpiante x Celeste Unidad",
    "Alimento balanceado 3kg",
    "Arena para gatos 8L",
    "Piedritas sanitarias 10kg",
    "Antipulgas y garrapatas (pipeta)",
    "Snack dental",
    "Correa regulable",
  ];

  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(new Date(toIso));

  const days: Date[] = [];
  for (let d = new Date(from); d.getTime() < to.getTime(); d = addDays(d, 1)) days.push(d);

  const metricsByPetshop: PetshopMetrics[] = [];
  const reprogramarRows: ReprogramarRow[] = [];
  const sinDespacharRows: SinDespacharRow[] = [];
  const estancadosRows: EstancadoRow[] = [];

  const capacityLimits = { flexPerDay: 400, franjaPerDay: 160 };

  // Build per-petshop metrics with plausible ranges
  for (const ps of petshops) {
    const baseTotal = round0(180 + rnd() * 220);
    const transacciones = round0(baseTotal * (0.55 + rnd() * 0.2));

    const sindesp = round0(baseTotal * (0.03 + rnd() * 0.06));
    const d1 = round0(baseTotal * (0.03 + rnd() * 0.05));
    const d2 = round0(baseTotal * (0.01 + rnd() * 0.03));
    const reprog = round0(baseTotal * (0.02 + rnd() * 0.05));
    const cancel = round0(baseTotal * (0.01 + rnd() * 0.04));
    // Estancados: son casos aislados y se derivan a Mis Pichos.
    const estancados = 0;

    const cancelPct = clamp((cancel / Math.max(1, baseTotal)) * 100, 0, 100);
    const d1pct = clamp((d1 / Math.max(1, baseTotal)) * 100, 0, 100);
    const d2pct = clamp((d2 / Math.max(1, baseTotal)) * 100, 0, 100);

    const split = round0(baseTotal * (0.01 + rnd() * 0.04));
    const splitPct = clamp((split / Math.max(1, baseTotal)) * 100, 0, 100);

    const newClients = round0(baseTotal * (0.22 + rnd() * 0.18));
    const recurrentClients = Math.max(0, baseTotal - newClients);
    const newPct = clamp((newClients / Math.max(1, newClients + recurrentClients)) * 100, 0, 100);
    const recPct = 100 - newPct;

    const eligible = Math.max(0, baseTotal - cancel);
    let delivered = round0(baseTotal * (0.86 + rnd() * 0.11)); // 86%..97% delivered (rough)
    delivered = Math.min(delivered, eligible);

    const lateShare = 0.04 + rnd() * 0.12; // 4%..16% of delivered are late
    const outTimeN = Math.min(delivered, round0(delivered * lateShare));
    const onTimeN = Math.max(0, delivered - outTimeN);

    const onTimePct = clamp((onTimeN / Math.max(1, eligible)) * 100, 0, 100);
    const outTimePct = clamp((outTimeN / Math.max(1, eligible)) * 100, 0, 100);

    const slPct = clamp((delivered / Math.max(1, baseTotal)) * 100, 0, 100);

    const manualCloseLast7: ManualCloseBucket[] = [];
    const last7Start = addDays(startOfDay(now), -6);
    for (let i = 0; i < 7; i++) {
      manualCloseLast7.push({ t: iso(addDays(last7Start, i)), count: round0(rnd() * 9) });
    }

    const cancelNewVsRec = {
      new: round0(cancel * (0.55 + rnd() * 0.2)),
      recurrent: Math.max(0, cancel - round0(cancel * (0.55 + rnd() * 0.2))),
    };

    const cancelReasonWeights = [1.1, 0.9, 1.4, 1.0, 0.7].map((w) => w * (0.85 + rnd() * 0.4));
    const cancelReasonCounts = distributeByWeights(cancel, cancelReasonWeights, rnd);
    const cancelReasons = CANCELLATION_REASONS.map((r0, i) => ({
      key: r0.key,
      label: r0.label,
      count: cancelReasonCounts[i] ?? 0,
    }));

    const solutions = round0(baseTotal * (0.01 + rnd() * 0.03));
    const devoluciones = round0(baseTotal * (0.01 + rnd() * 0.02));
    const retiros = round0(baseTotal * (0.005 + rnd() * 0.02));

    const capacityFlexHourly = buildCapacityHourly(rnd, capacityLimits.flexPerDay);
    const capacityFranjaHourly = buildCapacityHourly(rnd, capacityLimits.franjaPerDay);

    metricsByPetshop.push({
      petshopId: ps.id,
      petshopName: ps.name,
      total: baseTotal,
      delivered,
      transacciones,
      sindesp,
      d1,
      d1pct,
      d2,
      d2pct,
      reprog,
      cancel,
      cancelPct,
      split,
      splitPct,
      newClients,
      recurrentClients,
      newPct,
      recPct,
      onTimeN,
      outTimeN,
      onTimePct,
      outTimePct,
      slPct,
      manualCloseLast7,
      cancelNewVsRec,
      cancelReasons,
      solutions,
      devoluciones,
      retiros,
      capacityFlexHourly,
      capacityFranjaHourly,
    });

    // rows (bounded so UI isn't huge)
    for (let i = 0; i < Math.min(18, reprog); i++) {
      const win = pickDeliveryWindow(rnd);
      const baseDate = new Date(now.getTime() - (52 + rnd() * 120) * 60 * 60 * 1000);
      const createdAt = dateWithWindow(baseDate, win, rnd);
      const partido = pick(rnd, partidos);
      const address = `${pick(rnd, streets)} ${partido}`;
      reprogramarRows.push({
        orderId: orderIdNumeric(round0(rnd() * 8000)),
        createdAt: createdAt.toISOString(),
        customer: pick(rnd, customers),
        address,
        deliveryWindow: win,
        product: `1 x ${ps.name} ${pick(rnd, products)}`,
        petshopId: ps.id,
        petshopName: ps.name,
      });
    }

    for (let i = 0; i < Math.min(18, sindesp); i++) {
      const win = pickDeliveryWindow(rnd);
      const basePrinted = new Date(now.getTime() - (24 + rnd() * 18) * 60 * 60 * 1000);
      const printedAt = dateWithWindow(basePrinted, win, rnd);
      const waitHours = (now.getTime() - printedAt.getTime()) / (1000 * 60 * 60);
      const createdAt = dateWithWindow(new Date(now.getTime() - rnd() * 72 * 60 * 60 * 1000), win, rnd);
      const partido = pick(rnd, partidos);
      const address = `${pick(rnd, streets)} ${partido}`;
      sinDespacharRows.push({
        orderId: orderIdNumeric(1000 + round0(rnd() * 8000)),
        createdAt: createdAt.toISOString(),
        customer: pick(rnd, customers),
        address,
        deliveryWindow: win,
        product: `1 x ${ps.name} ${pick(rnd, products)}`,
        petshopId: ps.id,
        petshopName: ps.name,
        labelPrintedAt: printedAt.toISOString(),
        waitHours: round0(waitHours),
      });
    }

  }

  // Un único caso estancado derivado a Mis Pichos (representativo).
  {
    const mp = petshops.find((p) => p.id === "mis_pichos");
    const win = pickDeliveryWindow(rnd);
    const baseCreated = new Date(now.getTime() - (18 + rnd() * 36) * 60 * 60 * 1000);
    const createdAt = dateWithWindow(baseCreated, win, rnd);
    const waitHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    const partido = pick(rnd, partidos);
    const address = `${pick(rnd, streets)} ${partido}`;
    estancadosRows.push({
      orderId: orderIdNumeric(9000 + round0(rnd() * 8000)),
      createdAt: createdAt.toISOString(),
      customer: pick(rnd, customers),
      address,
      deliveryWindow: win,
      product: `Derivado (sin petshop) · ${pick(rnd, products)}`,
      petshopId: "mis_pichos",
      petshopName: mp?.name ?? "Mis Pichos",
      waitHours: round0(waitHours),
    });
  }

  estancadosRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Daily timeline (global)
  const totalByPetshopToday = metricsByPetshop.map((m) => ({ id: m.petshopId, name: m.petshopName, total: m.total }));
  const totalTodaySum = totalByPetshopToday.reduce((acc, x) => acc + x.total, 0);
  totalByPetshopToday.sort((a, b) => b.total - a.total);
  const top3Petshops = totalByPetshopToday.slice(0, 3).map((x) => ({
    petshopId: x.id,
    petshopName: x.name,
    pct: totalTodaySum ? round0((x.total / totalTodaySum) * 100) : 0,
    orders: x.total,
  }));

  const timelineDaily: TimelineBucket[] = days.map((d) => {
    const t = iso(startOfDay(d));
    const base = 480 + rnd() * 260;
    const total = round0(base);
    const transacciones = round0(base * (0.6 + rnd() * 0.12));
    const cancel = round0(base * (0.02 + rnd() * 0.02));
    const reprog = round0(base * (0.03 + rnd() * 0.02));
    const sindesp = round0(base * (0.04 + rnd() * 0.03));
    return { t, total, transacciones, cancel, reprog, sindesp };
  });

  return {
    now: now.toISOString(),
    range: { from: fromIso, to: toIso },
    petshops,
    metricsByPetshop,
    timelineDaily,
    reprogramarRows,
    sinDespacharRows,
    estancadosRows,
    top3Petshops,
    capacityLimits,
  };
}

