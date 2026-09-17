import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guard, ok, problem } from "@/lib/api/public-api";

/** GET /api/v1/publico/rede — serviços, especialidades e números agregados da rede */
export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("public_network_overview");
  if (error) return problem(502, "Não foi possível consultar a rede agora");

  const servico = request.nextUrl.searchParams.get("servico")?.toLowerCase();
  const payload = data as { servicos: { codigo: string; nome: string }[] } & Record<string, unknown>;
  if (servico) {
    payload.servicos = payload.servicos.filter((s) => s.codigo.toLowerCase() === servico || s.nome.toLowerCase().includes(servico));
  }
  return ok(payload, 300);
}
