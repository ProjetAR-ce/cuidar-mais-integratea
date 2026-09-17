import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * API pública v1 (RF-022, RNF-012).
 * Consumida por integrações servidor↔servidor, como o assistente de WhatsApp.
 * Nunca devolve dado pessoal: somente conteúdo público e números agregados.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { count: number; reset: number }>();

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function problem(status: number, title: string, detail?: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "content-type": "application/problem+json; charset=utf-8", "cache-control": "no-store" } }
  );
}

/** Valida a chave (header x-api-key ou Authorization: Bearer) e aplica limite de requisições. */
export function guard(request: NextRequest): NextResponse | null {
  const expected = process.env.INTEGRATEA_API_KEY;
  if (!expected) return problem(503, "API não configurada", "Defina INTEGRATEA_API_KEY no servidor.");

  const provided = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!provided || !safeEqual(provided, expected)) return problem(401, "Chave de API inválida");

  const key = provided.slice(-8);
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) hits.set(key, { count: 1, reset: now + WINDOW_MS });
  else if (++entry.count > MAX_PER_WINDOW) return problem(429, "Muitas requisições", "Tente novamente em alguns segundos.");
  return null;
}

export function ok(body: unknown, maxAge = 60) {
  return NextResponse.json(
    { versao: "v1", ...((typeof body === "object" && body) || { dados: body }) },
    { headers: { "cache-control": `private, max-age=${maxAge}` } }
  );
}
