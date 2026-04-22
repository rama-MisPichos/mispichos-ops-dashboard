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

export type PetshopMetrics = {
  petshopId: string;
  petshopName: string;

  // Required keys (as requested)
  total: number;
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
  onTimeN: number;
  outTimeN: number;
  onTimePct: number;
  outTimePct: number;

  // SL
  slPct: number;
  onTimePctSl: number;
  inFullPct: number;

  // Series
  manualCloseLast7: ManualCloseBucket[];
  cancelNewVsRec: { new: number; recurrent: number };
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
  top3Petshops: { petshopId: string; petshopName: string; pct: number }[];
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

  // Build per-petshop metrics with plausible ranges
  for (const ps of petshops) {
    const baseTotal = round0(180 + rnd() * 220);
    const transacciones = round0(baseTotal * (0.55 + rnd() * 0.2));

    const sindesp = round0(baseTotal * (0.03 + rnd() * 0.06));
    const d1 = round0(baseTotal * (0.03 + rnd() * 0.05));
    const d2 = round0(baseTotal * (0.01 + rnd() * 0.03));
    const reprog = round0(baseTotal * (0.02 + rnd() * 0.05));
    const cancel = round0(baseTotal * (0.01 + rnd() * 0.04));
    const estancados = round0(baseTotal * (0.01 + rnd() * 0.035));

    const cancelPct = clamp((cancel / Math.max(1, baseTotal)) * 100, 0, 100);
    const d1pct = clamp((d1 / Math.max(1, baseTotal)) * 100, 0, 100);
    const d2pct = clamp((d2 / Math.max(1, baseTotal)) * 100, 0, 100);

    const split = round0(baseTotal * (0.01 + rnd() * 0.04));
    const splitPct = clamp((split / Math.max(1, baseTotal)) * 100, 0, 100);

    const newClients = round0(baseTotal * (0.22 + rnd() * 0.18));
    const recurrentClients = Math.max(0, baseTotal - newClients);
    const newPct = clamp((newClients / Math.max(1, newClients + recurrentClients)) * 100, 0, 100);
    const recPct = 100 - newPct;

    const outTimeN = round0(baseTotal * (0.08 + rnd() * 0.12));
    const onTimeN = Math.max(0, baseTotal - outTimeN);
    const onTimePct = clamp((onTimeN / Math.max(1, baseTotal)) * 100, 0, 100);
    const outTimePct = 100 - onTimePct;

    const inFullPct = clamp(92 + rnd() * 6 - (cancelPct * 0.6), 70, 100);
    const slPct = clamp(onTimePct * 0.7 + inFullPct * 0.3, 0, 100);

    const manualCloseLast7: ManualCloseBucket[] = [];
    const last7Start = addDays(startOfDay(now), -6);
    for (let i = 0; i < 7; i++) {
      manualCloseLast7.push({ t: iso(addDays(last7Start, i)), count: round0(rnd() * 9) });
    }

    const cancelNewVsRec = {
      new: round0(cancel * (0.55 + rnd() * 0.2)),
      recurrent: Math.max(0, cancel - round0(cancel * (0.55 + rnd() * 0.2))),
    };

    const solutions = round0(baseTotal * (0.01 + rnd() * 0.03));
    const devoluciones = round0(baseTotal * (0.01 + rnd() * 0.02));
    const retiros = round0(baseTotal * (0.005 + rnd() * 0.02));

    const capacityFlexHourly: CapacityHourBucket[] = [];
    const capacityFranjaHourly: CapacityHourBucket[] = [];
    for (let h = 0; h < 24; h++) {
      const wave = Math.sin(((h - 8) / 24) * Math.PI * 2) * 0.5 + 0.5;
      capacityFlexHourly.push({ hour: h, used: round0(wave * (20 + rnd() * 40)) });
      capacityFranjaHourly.push({ hour: h, used: round0(wave * (10 + rnd() * 22)) });
    }

    metricsByPetshop.push({
      petshopId: ps.id,
      petshopName: ps.name,
      total: baseTotal,
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
      onTimePctSl: onTimePct,
      inFullPct,
      manualCloseLast7,
      cancelNewVsRec,
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

    for (let i = 0; i < Math.min(14, estancados); i++) {
      const win = pickDeliveryWindow(rnd);
      const baseCreated = new Date(now.getTime() - (10 + rnd() * 60) * 60 * 60 * 1000);
      const createdAt = dateWithWindow(baseCreated, win, rnd);
      const waitHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      const partido = pick(rnd, partidos);
      const address = `${pick(rnd, streets)} ${partido}`;
      estancadosRows.push({
        orderId: orderIdNumeric(2000 + round0(rnd() * 8000)),
        createdAt: createdAt.toISOString(),
        customer: pick(rnd, customers),
        address,
        deliveryWindow: win,
        product: `1 x ${ps.name} ${pick(rnd, products)}`,
        petshopId: ps.id,
        petshopName: ps.name,
        waitHours: round0(waitHours),
      });
    }
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
    capacityLimits: { flexPerDay: 400, franjaPerDay: 160 },
  };
}

