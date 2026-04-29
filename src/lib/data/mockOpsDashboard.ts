export type Petshop = {
  id: string;
  name: string;
  active: boolean;
  capacity: {
    flexEnabled: boolean;
    flexPerDay: number;
    shortPerWindow: number;
    shortEnabled: { "10-14": boolean; "14-18": boolean; "18-22": boolean };
  };
};

export type OpsRowBase = {
  orderId: string;
  createdAt: string; // ISO
  customer: string;
  address: string;
  /** Franja corta o Flex (14–22) */
  deliveryWindow?: "10-14" | "14-18" | "18-22" | "14-22";
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

export type CerradoManualRow = OpsRowBase & {
  closedAt: string; // ISO
  /** Motivo/resumen del cierre manual */
  note: string;
};

export type CanceladoRow = OpsRowBase & {
  canceledAt: string; // ISO
  reason: string;
  /** Monto estimado del pedido cancelado (ARS) */
  amountArs: number;
};

export type TimelineBucket = {
  t: string; // ISO day start
  total: number;
  transacciones: number;
  cancel: number;
  reprog: number;
  demSinDespachar: number;
};

export type ManualCloseBucket = { t: string; count: number };

export type CapacityHourBucket = { hour: number; used: number };

export type CapacityDayBucket = { t: string; used: number };

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
  /** GMV del período (monto total vendido) */
  gmv: number;
  demSinDespachar: number;
  vuelta1: number;
  vuelta1pct: number;
  vuelta2: number;
  vuelta2pct: number;
  reprog: number;
  cancel: number;
  cancelPct: number;
  split: number;
  splitPct: number;
  newClients: number;
  recurrentClients: number;
  newPct: number;
  recPct: number;
  /** Transacciones asociadas a "Nuevos" (aprox. en mock) */
  newTransactions: number;
  /** Transacciones asociadas a "Recurrentes" (aprox. en mock) */
  recurrentTransactions: number;
  /** Entregadas a tiempo (sobre creadas no canceladas) */
  onTimeN: number;
  /** Entregadas fuera de tiempo (sobre creadas no canceladas) */
  outTimeN: number;
  /** Transacciones a tiempo (aprox. en mock) */
  onTimeTx: number;
  /** Transacciones fuera de tiempo (aprox. en mock) */
  outTimeTx: number;
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
  capacityFlexDaily: CapacityDayBucket[];
  capacityFranjaDaily: CapacityDayBucket[];

  /**
   * Asignaciones ya hechas por día (hoy + próximos 5 días).
   * Representa pedidos ya “reservados” para una franja futura.
   */
  capacityAssignedNext7: {
    dayOffset: number; // 0 = hoy, 1 = mañana, ...
    t: string; // ISO day start (local)
    flexEnabled: boolean;
    shortEnabled: { "10-14": boolean; "14-18": boolean; "18-22": boolean };
    flexUsed1422: number;
    shortUsed1014: number;
    shortUsed1418: number;
    shortUsed1822: number;
  }[];
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
  cerradosManualmenteRows: CerradoManualRow[];
  canceladosRows: CanceladoRow[];
  top3Petshops: { petshopId: string; petshopName: string; pct: number; orders: number }[];
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
  // Incluye Flex (14–22) para que también aparezca en registros.
  // (No afecta KPIs; es solo el "tag" de la fila.)
  return pick(rnd, ["10-14", "14-18", "18-22", "14-22"] as const);
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

function buildHourlyForHours(rnd: () => number, hours: number[], targetTotal: number): CapacityHourBucket[] {
  if (!hours.length) return [];
  const safeTarget = Math.max(0, targetTotal);

  const weights = hours.map((h) => {
    const wave = Math.sin(((h - 12) / 24) * Math.PI * 2) * 0.5 + 0.5; // 0..1
    const noise = 0.75 + rnd() * 0.7;
    return Math.max(0.08, wave * noise);
  });
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = hours.map((h, i) => ({ hour: h, used: (safeTarget * (weights[i] ?? 0)) / sumW }));

  const rounded = raw.map((b) => ({ hour: b.hour, used: Math.max(0, Math.floor(b.used)) }));
  let diff = Math.max(0, Math.floor(safeTarget) - rounded.reduce((a, b) => a + b.used, 0));
  while (diff > 0) {
    const k = Math.floor(rnd() * rounded.length);
    rounded[k]!.used += 1;
    diff -= 1;
  }
  return rounded;
}

export function getMockOpsDashboard(fromIso: string, toIso: string): OpsDashboardResponse {
  const rnd = mulberry32(99);
  const now = new Date();

  const petshops: Petshop[] = [
    {
      id: "farmapet_city",
      name: "Farmapet City",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 140, shortPerWindow: 20, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
    {
      id: "oh_my_dog",
      name: "Oh My Dog",
      active: true,
      capacity: { flexEnabled: false, flexPerDay: 0, shortPerWindow: 18, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
    {
      id: "poopy_food",
      name: "Poopy Food",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 90, shortPerWindow: 16, shortEnabled: { "10-14": true, "14-18": false, "18-22": true } },
    },
    {
      id: "petfy",
      name: "Petfy",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 120, shortPerWindow: 22, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
    {
      id: "mundo_silvestre",
      name: "Mundo Silvestre",
      active: true,
      capacity: { flexEnabled: false, flexPerDay: 0, shortPerWindow: 14, shortEnabled: { "10-14": true, "14-18": true, "18-22": false } },
    },
    {
      id: "veterinaria_juncal",
      name: "Veterinaria Juncal",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 70, shortPerWindow: 12, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
    {
      id: "puppis",
      name: "Puppis",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 160, shortPerWindow: 26, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
    {
      id: "selpy_pets",
      name: "Selpy Pets",
      active: true,
      capacity: { flexEnabled: false, flexPerDay: 0, shortPerWindow: 20, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
    {
      id: "leocan",
      name: "Leocan",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 85, shortPerWindow: 16, shortEnabled: { "10-14": true, "14-18": false, "18-22": false } },
    },
    {
      id: "beauty_pet_shop",
      name: "Beauty Pet Shop",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 60, shortPerWindow: 14, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
    // Cuando ningún petshop toma el pedido, se deriva a nosotros.
    {
      id: "mis_pichos",
      name: "Mis Pichos",
      active: true,
      capacity: { flexEnabled: true, flexPerDay: 200, shortPerWindow: 30, shortEnabled: { "10-14": true, "14-18": true, "18-22": true } },
    },
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
  const cerradosManualmenteRows: CerradoManualRow[] = [];
  const canceladosRows: CanceladoRow[] = [];

  // Build per-petshop metrics with plausible ranges
  for (const ps of petshops) {
    const baseTotal = round0(180 + rnd() * 220);
    const transacciones = round0(baseTotal * (0.55 + rnd() * 0.2));
    const avgTicket = 8500 + rnd() * 14000; // ARS, aproximación para mock
    const gmv = round0(transacciones * avgTicket);

    const demSinDespachar = round0(baseTotal * (0.03 + rnd() * 0.06));
    const vuelta1 = round0(baseTotal * (0.03 + rnd() * 0.05));
    const vuelta2 = round0(baseTotal * (0.01 + rnd() * 0.03));
    const reprog = round0(baseTotal * (0.02 + rnd() * 0.05));
    const cancel = round0(baseTotal * (0.01 + rnd() * 0.04));
    // Estancados: son casos aislados y se derivan a Mis Pichos.
    const estancados = 0;

    const cancelPct = clamp((cancel / Math.max(1, baseTotal)) * 100, 0, 100);
    const vuelta1pct = clamp((vuelta1 / Math.max(1, baseTotal)) * 100, 0, 100);
    const vuelta2pct = clamp((vuelta2 / Math.max(1, baseTotal)) * 100, 0, 100);

    // "Spliteados" es sobre transacciones (tickets), no sobre compras/órdenes.
    // Una transacción cuenta como spliteada si tiene 2+ compras asignadas a 2+ petshops distintos.
    // En el mock lo aproximamos como una fracción de las transacciones del petshop.
    const split = Math.min(transacciones, round0(transacciones * (0.01 + rnd() * 0.06)));
    const splitPct = clamp((split / Math.max(1, transacciones)) * 100, 0, 100);

    const newClients = round0(baseTotal * (0.22 + rnd() * 0.18));
    const recurrentClients = Math.max(0, baseTotal - newClients);
    const newPct = clamp((newClients / Math.max(1, newClients + recurrentClients)) * 100, 0, 100);
    const recPct = 100 - newPct;
    // En el modelo real esto debería venir del sistema de pagos/CRM.
    // En el mock repartimos transacciones en la misma proporción que el split Nuevos/Recurrentes.
    const newTransactions = Math.min(transacciones, round0(transacciones * (newClients / Math.max(1, newClients + recurrentClients))));
    const recurrentTransactions = Math.max(0, transacciones - newTransactions);

    const eligible = Math.max(0, baseTotal - cancel);
    let delivered = round0(baseTotal * (0.86 + rnd() * 0.11)); // 86%..97% delivered (rough)
    delivered = Math.min(delivered, eligible);

    const lateShare = 0.04 + rnd() * 0.12; // 4%..16% of delivered are late
    const outTimeN = Math.min(delivered, round0(delivered * lateShare));
    const onTimeN = Math.max(0, delivered - outTimeN);
    const onTimeRatio = onTimeN / Math.max(1, onTimeN + outTimeN);
    const onTimeTx = Math.min(transacciones, round0(transacciones * onTimeRatio));
    const outTimeTx = Math.max(0, transacciones - onTimeTx);

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

    // Capacity (por petshop)
    const shortLimitPerWindow = ps.capacity.shortPerWindow;
    const enabledShortWins = (["10-14", "14-18", "18-22"] as const).filter((w) => ps.capacity.shortEnabled[w]);
    const shortLimitTotal = shortLimitPerWindow * enabledShortWins.length;

    const flexLimit = ps.capacity.flexEnabled ? ps.capacity.flexPerDay : 0;

    // In real ops they rarely exceed capacity, so keep utilization under ~90% most days.
    const utilShort = 0.55 + rnd() * 0.38; // 55%..93%
    const utilFlex = 0.5 + rnd() * 0.38; // 50%..88%

    const usedShortTotal = Math.min(shortLimitTotal, round0(shortLimitTotal * utilShort));
    const usedFlexTotal = ps.capacity.flexEnabled ? Math.min(flexLimit, round0(flexLimit * utilFlex)) : 0;

    // Distribute franja corta only among enabled windows.
    const shortWeights = enabledShortWins.map(() => 0.8 + rnd() * 0.6);
    const shortUsedByWin = distributeByWeights(usedShortTotal, shortWeights, rnd);
    const used1014 = enabledShortWins.includes("10-14") ? shortUsedByWin[enabledShortWins.indexOf("10-14")] ?? 0 : 0;
    const used1418 = enabledShortWins.includes("14-18") ? shortUsedByWin[enabledShortWins.indexOf("14-18")] ?? 0 : 0;
    const used1822 = enabledShortWins.includes("18-22") ? shortUsedByWin[enabledShortWins.indexOf("18-22")] ?? 0 : 0;

    const hours1014 = [10, 11, 12, 13];
    const hours1418 = [14, 15, 16, 17];
    const hours1822 = [18, 19, 20, 21];
    const flexHours = [14, 15, 16, 17, 18, 19, 20, 21];

    const capacityFranjaHourly = [
      ...(ps.capacity.shortEnabled["10-14"] ? buildHourlyForHours(rnd, hours1014, used1014) : []),
      ...(ps.capacity.shortEnabled["14-18"] ? buildHourlyForHours(rnd, hours1418, used1418) : []),
      ...(ps.capacity.shortEnabled["18-22"] ? buildHourlyForHours(rnd, hours1822, used1822) : []),
    ]
      .slice()
      .sort((a, b) => a.hour - b.hour);

    const capacityFlexHourly = ps.capacity.flexEnabled ? buildHourlyForHours(rnd, flexHours, usedFlexTotal) : [];

    // Daily history (lets UI compare closeness to capacity each day)
    const capacityFranjaDaily: CapacityDayBucket[] = days.map((d0) => {
      // Keep it stable-ish across days with light drift
      const drift = 0.82 + rnd() * 0.22; // 82%..104%
      const used = Math.min(shortLimitTotal, round0(usedShortTotal * drift));
      return { t: iso(startOfDay(d0)), used };
    });
    const capacityFlexDaily: CapacityDayBucket[] = days.map((d0) => {
      if (!ps.capacity.flexEnabled) return { t: iso(startOfDay(d0)), used: 0 };
      const drift = 0.82 + rnd() * 0.22;
      const used = Math.min(flexLimit, round0(usedFlexTotal * drift));
      return { t: iso(startOfDay(d0)), used };
    });

    // Asignaciones futuras (hoy + 5 días). Para "hoy" usamos lo mismo que el hourly,
    // y para días futuros generamos reservas con tendencia a ser menores cuanto más lejos.
    const capacityAssignedNext7 = Array.from({ length: 6 }, (_, dayOffset) => {
      const t = iso(startOfDay(addDays(now, dayOffset)));
      if (dayOffset === 0) {
        return {
          dayOffset,
          t,
          flexEnabled: ps.capacity.flexEnabled,
          shortEnabled: ps.capacity.shortEnabled,
          flexUsed1422: usedFlexTotal,
          shortUsed1014: used1014,
          shortUsed1418: used1418,
          shortUsed1822: used1822,
        };
      }

      // En la práctica, cuanto más futuro, menos reservas (y puede haber ventanas apagadas por día).
      const flexEnabledDay = ps.capacity.flexEnabled ? rnd() > (0.08 + dayOffset * 0.04) : false; // más lejos, más chance de OFF
      const shortEnabledDay = {
        "10-14": ps.capacity.shortEnabled["10-14"] ? rnd() > (0.06 + dayOffset * 0.035) : false,
        "14-18": ps.capacity.shortEnabled["14-18"] ? rnd() > (0.06 + dayOffset * 0.035) : false,
        "18-22": ps.capacity.shortEnabled["18-22"] ? rnd() > (0.06 + dayOffset * 0.035) : false,
      };

      const enabledShortWinsDay = (["10-14", "14-18", "18-22"] as const).filter((w) => shortEnabledDay[w]);
      const shortLimitTotalDay = shortLimitPerWindow * enabledShortWinsDay.length;

      // Reservas futuras graduales (realista):
      // hoy suele ser el día más cargado; mañana un poco menos; y va bajando.
      // Usamos el "hoy" como baseline (usedShortTotal / usedFlexTotal) y aplicamos un factor decreciente.
      const decayByOffset = [1, 0.86, 0.72, 0.58, 0.45, 0.34][dayOffset] ?? 0.34;
      const jitter = 0.88 + rnd() * 0.22; // 88%..110% (variación suave)

      // Si se apagan ventanas para ese día, el total potencial baja con ellas.
      const dayShortBaseline = Math.max(0, usedShortTotal);
      const dayFlexBaseline = Math.max(0, usedFlexTotal);

      const futureShortTotalRaw = round0(dayShortBaseline * decayByOffset * jitter);
      const futureFlexTotalRaw = round0(dayFlexBaseline * decayByOffset * jitter);

      const futureShortTotal = shortLimitTotalDay ? Math.min(shortLimitTotalDay, Math.max(0, futureShortTotalRaw)) : 0;
      const futureFlexTotal = flexEnabledDay && flexLimit ? Math.min(flexLimit, Math.max(0, futureFlexTotalRaw)) : 0;

      // Distribución por ventana: preservamos proporciones del "hoy" (si están habilitadas),
      // y renormalizamos dentro de las ventanas habilitadas del día.
      const baseShares = {
        "10-14": used1014,
        "14-18": used1418,
        "18-22": used1822,
      } as const;
      const enabledSharesSum = enabledShortWinsDay.reduce((acc, w) => acc + (baseShares[w] ?? 0), 0);
      const weights = enabledShortWinsDay.map((w) => {
        if (enabledSharesSum <= 0) return 1;
        return Math.max(0.2, (baseShares[w] ?? 0) / enabledSharesSum);
      });
      const futureByWin = enabledShortWinsDay.length ? distributeByWeights(futureShortTotal, weights, rnd) : [];
      const f1014 = enabledShortWinsDay.includes("10-14") ? futureByWin[enabledShortWinsDay.indexOf("10-14")] ?? 0 : 0;
      const f1418 = enabledShortWinsDay.includes("14-18") ? futureByWin[enabledShortWinsDay.indexOf("14-18")] ?? 0 : 0;
      const f1822 = enabledShortWinsDay.includes("18-22") ? futureByWin[enabledShortWinsDay.indexOf("18-22")] ?? 0 : 0;

      return {
        dayOffset,
        t,
        flexEnabled: flexEnabledDay,
        shortEnabled: shortEnabledDay,
        flexUsed1422: futureFlexTotal,
        shortUsed1014: f1014,
        shortUsed1418: f1418,
        shortUsed1822: f1822,
      };
    });

    metricsByPetshop.push({
      petshopId: ps.id,
      petshopName: ps.name,
      total: baseTotal,
      delivered,
      transacciones,
      gmv,
      demSinDespachar,
      vuelta1,
      vuelta1pct,
      vuelta2,
      vuelta2pct,
      reprog,
      cancel,
      cancelPct,
      split,
      splitPct,
      newClients,
      recurrentClients,
      newPct,
      recPct,
      newTransactions,
      recurrentTransactions,
      onTimeN,
      outTimeN,
      onTimeTx,
      outTimeTx,
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
      capacityFlexDaily,
      capacityFranjaDaily,
      capacityAssignedNext7,
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

    for (let i = 0; i < Math.min(18, demSinDespachar); i++) {
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

    for (let i = 0; i < Math.min(14, Math.max(1, round0(transacciones * 0.03))); i++) {
      const win = pickDeliveryWindow(rnd);
      const baseDate = new Date(now.getTime() - (18 + rnd() * 96) * 60 * 60 * 1000);
      const createdAt = dateWithWindow(baseDate, win, rnd);
      const closedAt = new Date(createdAt.getTime() + (2 + rnd() * 18) * 60 * 60 * 1000);
      const partido = pick(rnd, partidos);
      const address = `${pick(rnd, streets)} ${partido}`;
      cerradosManualmenteRows.push({
        orderId: orderIdNumeric(round0(rnd() * 8000)),
        createdAt: createdAt.toISOString(),
        closedAt: closedAt.toISOString(),
        customer: pick(rnd, customers),
        address,
        deliveryWindow: win,
        product: `1 x ${ps.name} ${pick(rnd, products)}`,
        petshopId: ps.id,
        petshopName: ps.name,
        note: pick(rnd, ["Cliente no responde", "Dirección inválida", "Pago pendiente", "Reasignación manual", "Stock no confirmado"]),
      });
    }

    for (let i = 0; i < Math.min(16, cancel); i++) {
      const win = pickDeliveryWindow(rnd);
      const baseDate = new Date(now.getTime() - (6 + rnd() * 120) * 60 * 60 * 1000);
      const createdAt = dateWithWindow(baseDate, win, rnd);
      const canceledAt = new Date(createdAt.getTime() + (1 + rnd() * 24) * 60 * 60 * 1000);
      const partido = pick(rnd, partidos);
      const address = `${pick(rnd, streets)} ${partido}`;
      const reason = pick(rnd, CANCELLATION_REASONS).label;
      // Aproximamos el monto a partir del avg ticket del petshop (definido arriba).
      const amountArs = round0(avgTicket * (0.65 + rnd() * 0.9)); // ~0.65x..1.55x
      canceladosRows.push({
        orderId: orderIdNumeric(round0(rnd() * 8000)),
        createdAt: createdAt.toISOString(),
        canceledAt: canceledAt.toISOString(),
        customer: pick(rnd, customers),
        address,
        deliveryWindow: win,
        product: `1 x ${ps.name} ${pick(rnd, products)}`,
        petshopId: ps.id,
        petshopName: ps.name,
        reason,
        amountArs,
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
  cerradosManualmenteRows.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  canceladosRows.sort((a, b) => new Date(b.canceledAt).getTime() - new Date(a.canceledAt).getTime());

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
    const demSinDespachar = round0(base * (0.04 + rnd() * 0.03));
    return { t, total, transacciones, cancel, reprog, demSinDespachar };
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
    cerradosManualmenteRows,
    canceladosRows,
    top3Petshops,
  };
}

