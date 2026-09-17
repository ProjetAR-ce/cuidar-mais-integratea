import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guard, ok, problem } from "@/lib/api/public-api";

/** GET /api/v1/publico/conhecimento?q=... — orientações públicas validadas (base do assistente) */
export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const q = (request.nextUrl.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limite") ?? 5) || 5, 1), 8);
  if (q.length < 2) return problem(400, "Parâmetro q obrigatório", "Envie ao menos 2 caracteres.");

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("search_agent_knowledge", { search_query: q, result_limit: limit });
  if (error) return problem(502, "Não foi possível consultar a base agora");

  const resultados = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    titulo: r.title, conteudo: r.content, servico: r.service, publico: r.audience, atualizado_em: r.updated_at,
  }));
  return ok({ consulta: q, total: resultados.length, resultados });
}
