import { OperationsDataset } from "@/lib/domain/models";

function hoursAgo(now: Date, h: number) {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rnd: () => number, arr: T[]) {
  return arr[Math.floor(rnd() * arr.length)];
}

function isoAt(now: Date, hoursAgoValue: number) {
  return hoursAgo(now, hoursAgoValue);
}

export function getMockOperationsDataset(): OperationsDataset {
  const now = new Date();
  const nowIso = now.toISOString();

  const rnd = mulberry32(42);

  const customers = ["María G.", "Nicolás R.", "Florencia P.", "Julián S.", "Carolina T.", "Sofía L.", "Pablo M."];
  const addresses = [
    "Av. Siempre Viva 742, CABA",
    "Mendoza 1200, Rosario",
    "Mitre 33, Córdoba",
    "San Martín 500, La Plata",
    "Belgrano 220, Mar del Plata",
    "Rivadavia 1550, CABA",
    "9 de Julio 10, CABA",
  ];
  const productCatalog = ["Alimento 3kg", "Piedritas 10kg", "Arena 8L", "Antipulgas", "Snack dental", "Correa", "Plato"];

  const orders: OperationsDataset["orders"] = [];
  const days = 14;
  const totalOrdersToGenerate = 180;

  for (let i = 0; i < totalOrdersToGenerate; i++) {
    const id = `MP-${10400 + i}`;
    const hoursBack = Math.floor(rnd() * days * 24);
    const createdAt = isoAt(now, hoursBack);

    const productsCount = 1 + Math.floor(rnd() * 2);
    const products = Array.from({ length: productsCount }).map(() => ({ name: pick(rnd, productCatalog) }));

    const base = {
      orderId: id,
      createdAt,
      customer: { name: pick(rnd, customers) },
      address: { full: pick(rnd, addresses) },
      products,
    };

    const statusRoll = rnd();
    // ~6% reprogramar
    if (statusRoll < 0.06) {
      orders.push({
        ...base,
        scheduledFor: isoAt(now, hoursBack + 60),
      });
      continue;
    }
    // ~8% sin despachar
    if (statusRoll < 0.14) {
      orders.push({
        ...base,
        labelPrintedAt: isoAt(now, hoursBack + 30),
        driverTakenAt: undefined,
      });
      continue;
    }
    // ~7% estancado
    if (statusRoll < 0.21) {
      orders.push({
        ...base,
        misPichosAssignedAt: isoAt(now, hoursBack + 26),
        petchopAssignedAt: undefined,
      });
      continue;
    }
    // ~6% demorado 1ra vuelta
    if (statusRoll < 0.27) {
      orders.push({
        ...base,
        firstAttemptAt: isoAt(now, hoursBack + 26),
      });
      continue;
    }
    // ~4% demorado 2da vuelta
    if (statusRoll < 0.31) {
      orders.push({
        ...base,
        secondAttemptAt: isoAt(now, hoursBack + 52),
      });
      continue;
    }

    // normal: etiqueta impresa y tomada
    orders.push({
      ...base,
      labelPrintedAt: isoAt(now, Math.max(1, hoursBack - 2)),
      driverTakenAt: isoAt(now, Math.max(0, hoursBack - 1)),
    });
  }

  const transactions: OperationsDataset["transactions"] = [];
  const totalTransactionsToGenerate = 90;
  for (let i = 0; i < totalTransactionsToGenerate; i++) {
    const transactionId = `TX-${90000 + i}`;
    const hoursBack = Math.floor(rnd() * days * 24);
    const createdAt = isoAt(now, hoursBack);

    const ordersInTx = 1 + (rnd() < 0.25 ? 1 : 0) + (rnd() < 0.1 ? 1 : 0);
    const orderIds: string[] = [];
    for (let j = 0; j < ordersInTx; j++) {
      const o = orders[Math.floor(rnd() * orders.length)];
      if (o && !orderIds.includes(o.orderId)) orderIds.push(o.orderId);
    }

    transactions.push({ transactionId, createdAt, orderIds });
  }

  return {
    now: nowIso,
    orders,
    transactions,
  };
}

