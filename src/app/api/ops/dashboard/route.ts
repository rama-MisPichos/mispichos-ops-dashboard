import { NextRequest, NextResponse } from "next/server";
import { getMockOpsDashboard } from "@/lib/data/mockOpsDashboard";

export async function GET(req: NextRequest) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : new Date(`${ymd(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))}T00:00:00`);
  const to = toParam ? new Date(toParam) : new Date(`${ymd(new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000))}T00:00:00`);

  // Suggested future endpoints (when integrating with Core API):
  // - GET /core/ops/kpis?from&to&petshopId
  // - GET /core/ops/service-level?from&to
  // - GET /core/ops/reprogramar?from&to&petshopId
  // - GET /core/ops/sin-despachar?from&to&petshopId
  // - GET /core/ops/capacity?date=YYYY-MM-DD

  const payload = getMockOpsDashboard(from.toISOString(), to.toISOString());
  return NextResponse.json(payload);
}

