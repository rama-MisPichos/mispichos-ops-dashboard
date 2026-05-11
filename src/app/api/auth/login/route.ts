import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { user, password } = await req.json();

  // Harcodeo las credenciales para el dashboard
  const validUser = process.env.DASHBOARD_USER ?? "MateoK";
  const validPass = process.env.DASHBOARD_PASSWORD ?? "mispichos2025";

  if (user === validUser && password === validPass) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Credenciales incorrectas" }, { status: 401 });
}
