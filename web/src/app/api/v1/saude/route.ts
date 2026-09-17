import { NextResponse } from "next/server";

/** GET /api/v1/saude — verificação de disponibilidade (sem autenticação, sem dados) */
export function GET() {
  return NextResponse.json({ status: "ok", servico: "IntegraTEA / Cuidar+", versao: "v1", horario: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
