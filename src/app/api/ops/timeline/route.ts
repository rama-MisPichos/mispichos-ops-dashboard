import { NextRequest, NextResponse } from "next/server";
import { getMockOperationsDataset } from "@/lib/data/mockOperationsData";
import {
  filterDatasetByPeriod,
  isDemorado1raVuelta,
  isDemorado2daVuelta,
  isDemoradoSinDespachar,
  isReprogramar,
} from "@/lib/kpis/compute";

type Bucket = {
  t: string; // ISO bucket start
  orders: number;
  transactions: number;
  reprogramar: number;
  sinDespachar: number;
  demorado1ra: number;
  demorado2da: number;
};

function startOfDayIso(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function addDaysIso(dayStartIso: string, days: number) {
  const d = new Date(dayStartIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const dataset = getMockOperationsDataset();

  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;
  const filtered = filterDatasetByPeriod(dataset, from, to);

  const nowIso = filtered.now;

  const fromEffective = startOfDayIso(from ?? addDaysIso(startOfDayIso(nowIso), -13));
  const toEffective = startOfDayIso(to ?? addDaysIso(startOfDayIso(nowIso), 1));

  const days: string[] = [];
  for (let i = 0; ; i++) {
    const t = addDaysIso(fromEffective, i);
    if (new Date(t).getTime() >= new Date(toEffective).getTime()) break;
    days.push(t);
  }

  const buckets: Bucket[] = days.map((t) => ({
    t,
    orders: 0,
    transactions: 0,
    reprogramar: 0,
    sinDespachar: 0,
    demorado1ra: 0,
    demorado2da: 0,
  }));

  const idxByDay = new Map<string, number>();
  for (let i = 0; i < days.length; i++) idxByDay.set(days[i], i);

  for (const o of filtered.orders) {
    const key = startOfDayIso(o.createdAt);
    const idx = idxByDay.get(key);
    if (idx === undefined) continue;
    buckets[idx].orders += 1;
    if (isReprogramar(o, nowIso)) buckets[idx].reprogramar += 1;
    if (isDemoradoSinDespachar(o, nowIso)) buckets[idx].sinDespachar += 1;
    if (isDemorado1raVuelta(o, nowIso)) buckets[idx].demorado1ra += 1;
    if (isDemorado2daVuelta(o, nowIso)) buckets[idx].demorado2da += 1;
  }

  for (const t0 of filtered.transactions) {
    const key = startOfDayIso(t0.createdAt);
    const idx = idxByDay.get(key);
    if (idx === undefined) continue;
    buckets[idx].transactions += 1;
  }

  return NextResponse.json({
    now: filtered.now,
    range: { from, to },
    buckets,
  });
}

