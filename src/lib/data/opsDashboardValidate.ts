/**
 * Invariantes del contrato `OpsDashboardResponse` / `PetshopMetrics`.
 * Útil para:
 * - asegurar que el mock (y tests) respeten las mismas reglas que exigirá el Core API;
 * - llamar desde un adaptador real en desarrollo antes de devolver JSON al cliente.
 */
import type { OpsDashboardResponse, Petshop, PetshopMetrics } from "./mockOpsDashboard";

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export function validatePetshopMetrics(m: PetshopMetrics, label: string): string[] {
  const e: string[] = [];
  const push = (msg: string) => e.push(`${label}: ${msg}`);

  if (m.newClients + m.recurrentClients !== m.total) {
    push(`newClients+recurrentClients (${m.newClients + m.recurrentClients}) !== total (${m.total})`);
  }
  if (m.newTransactions + m.recurrentTransactions !== m.transacciones) {
    push(`newTransactions+recurrentTransactions (${m.newTransactions + m.recurrentTransactions}) !== transacciones (${m.transacciones})`);
  }
  if (m.onTimeN + m.outTimeN !== m.delivered) {
    push(`onTimeN+outTimeN (${m.onTimeN + m.outTimeN}) !== delivered (${m.delivered})`);
  }
  if (m.onTimeTx + m.outTimeTx !== m.transacciones) {
    push(`onTimeTx+outTimeTx (${m.onTimeTx + m.outTimeTx}) !== transacciones (${m.transacciones})`);
  }
  const onTimeWinSum = m.onTimeShort1014N + m.onTimeShort1418N + m.onTimeShort1822N + m.onTimeFlex1422N;
  if (onTimeWinSum !== m.onTimeN) {
    push(`sum(onTime franjas)=${onTimeWinSum} !== onTimeN (${m.onTimeN})`);
  }
  const eligible = Math.max(0, m.total - m.cancel);
  if (m.delivered > eligible) {
    push(`delivered (${m.delivered}) > eligible total-cancel (${eligible})`);
  }
  if (m.split > m.transacciones) {
    push(`split (${m.split}) > transacciones (${m.transacciones})`);
  }
  const cr = sum(m.cancelReasons.map((r) => r.count));
  if (cr !== m.cancel) {
    push(`sum(cancelReasons.count)=${cr} !== cancel (${m.cancel})`);
  }
  if (m.cancelNewVsRec.new + m.cancelNewVsRec.recurrent !== m.cancel) {
    push(`cancelNewVsRec (${m.cancelNewVsRec.new}+${m.cancelNewVsRec.recurrent}) !== cancel (${m.cancel})`);
  }
  return e;
}

function petshopById(petshops: Petshop[], id: string) {
  return petshops.find((p) => p.id === id);
}

export function validateOpsDashboardResponse(d: OpsDashboardResponse): string[] {
  const e: string[] = [];
  d.metricsByPetshop.forEach((m) => {
    e.push(...validatePetshopMetrics(m, m.petshopId));
  });

  const agg = d.metricsByPetshop.reduce(
    (a, m) => ({
      total: a.total + m.total,
      transacciones: a.transacciones + m.transacciones,
      cancel: a.cancel + m.cancel,
      reprog: a.reprog + m.reprog,
      demSinDespachar: a.demSinDespachar + m.demSinDespachar,
    }),
    { total: 0, transacciones: 0, cancel: 0, reprog: 0, demSinDespachar: 0 },
  );

  const tSum = sum(d.timelineDaily.map((x) => x.total));
  if (d.timelineDaily.length && tSum !== agg.total) {
    e.push(`timeline sum(total)=${tSum} !== Σ metrics.total (${agg.total})`);
  }
  const txSum = sum(d.timelineDaily.map((x) => x.transacciones));
  if (d.timelineDaily.length && txSum !== agg.transacciones) {
    e.push(`timeline sum(transacciones)=${txSum} !== Σ metrics.transacciones (${agg.transacciones})`);
  }
  const cSum = sum(d.timelineDaily.map((x) => x.cancel));
  if (d.timelineDaily.length && cSum !== agg.cancel) {
    e.push(`timeline sum(cancel)=${cSum} !== Σ metrics.cancel (${agg.cancel})`);
  }
  const rSum = sum(d.timelineDaily.map((x) => x.reprog));
  if (d.timelineDaily.length && rSum !== agg.reprog) {
    e.push(`timeline sum(reprog)=${rSum} !== Σ metrics.reprog (${agg.reprog})`);
  }
  const dSum = sum(d.timelineDaily.map((x) => x.demSinDespachar));
  if (d.timelineDaily.length && dSum !== agg.demSinDespachar) {
    e.push(`timeline sum(demSinDespachar)=${dSum} !== Σ metrics.demSinDespachar (${agg.demSinDespachar})`);
  }

  const topSum = sum(d.top3Petshops.map((x) => x.orders));
  if (agg.total > 0 && topSum > agg.total) {
    e.push(`top3 orders sum (${topSum}) > Σ metrics.total (${agg.total})`);
  }

  for (const row of [...d.reprogramarRows, ...d.sinDespacharRows, ...d.canceladosRows, ...d.vuelta1Rows, ...d.vuelta2Rows]) {
    if (!row.petshopId) continue;
    if (!petshopById(d.petshops, row.petshopId)) {
      e.push(`row order ${row.orderId}: petshopId "${row.petshopId}" not in petshops[]`);
    }
  }

  return e;
}
