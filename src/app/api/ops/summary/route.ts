import { NextRequest, NextResponse } from "next/server";
import { getMockOperationsDataset } from "@/lib/data/mockOperationsData";
import { computeOperationsKpis, filterDatasetByPeriod } from "@/lib/kpis/compute";

export async function GET(req: NextRequest) {
  const dataset = getMockOperationsDataset();

  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;
  const filtered = filterDatasetByPeriod(dataset, from, to);

  const computed = computeOperationsKpis(filtered);
  return NextResponse.json({
    now: filtered.now,
    range: { from, to },
    cards: computed.cards,
    lists: computed.lists,
  });
}

