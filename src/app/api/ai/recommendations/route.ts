import { NextRequest, NextResponse } from "next/server";

type KpiSummary = {
  totalOrders: number;
  totalTransactions: number;
  reprogramar: { count: number; pct: number };
  sinDespachar: { count: number };
  estancados: { count: number };
  vuelta1: { count: number };
  vuelta2: { count: number };
  cancelados: { count: number; pct: number };
  spliteados: { count: number; pct: number };
  top3Petshops: { name: string; pct: number; orders: number }[];
  slPct: number | null;
  range: { from: string; to: string };
};

function buildPrompt(kpis: KpiSummary): string {
  const top3Text = kpis.top3Petshops.length
    ? kpis.top3Petshops.map((p, i) => `  ${i + 1}. ${p.name}: ${p.orders} órdenes (${p.pct.toFixed(1)}%)`).join("\n")
    : "  Sin datos";

  return `Sos un asistente de operaciones logísticas para MisPichos, una empresa de delivery de productos para mascotas en Argentina.

A continuación los KPIs operativos del período ${kpis.range.from} al ${kpis.range.to}:

- Total de órdenes: ${kpis.totalOrders}
- Total de transacciones: ${kpis.totalTransactions}
- Service Level (SL): ${kpis.slPct !== null ? `${kpis.slPct.toFixed(1)}%` : "sin datos"}
- Pedidos a reprogramar (>48hs fuera de SLA): ${kpis.reprogramar.count} (${kpis.reprogramar.pct.toFixed(1)}%)
- Demorado sin despachar (etiqueta impresa >24hs sin driver): ${kpis.sinDespachar.count}
- Estancados (MisPichos asignado, sin Petchop): ${kpis.estancados.count}
- 1ra vuelta: ${kpis.vuelta1.count}
- 2da vuelta: ${kpis.vuelta2.count}
- Cancelados: ${kpis.cancelados.count} (${kpis.cancelados.pct.toFixed(1)}%)
- Pedidos spliteados: ${kpis.spliteados.count} (${kpis.spliteados.pct.toFixed(1)}%)

Top 3 petshops por volumen:
${top3Text}

Basándote en estos datos, generá un análisis operativo con:
1. Un diagnóstico breve del estado general (2-3 oraciones)
2. Las 3 acciones más urgentes que el equipo debería tomar hoy, ordenadas por prioridad
3. Un riesgo que hay que monitorear de cerca

Respondé en español, de forma directa y accionable. No uses introducción genérica. Sé concreto con los números.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 });
  }

  const kpis: KpiSummary = await req.json();

  const prompt = buildPrompt(kpis);

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    },
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 });
  }

  const geminiData = await geminiRes.json();
  const text: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sin respuesta";

  return NextResponse.json({ text });
}
