import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Ensina ao tailwind-merge a escala tipográfica e os raios personalizados,
// senão ele confunde "text-callout" (tamanho) com "text-white" (cor).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["large-title", "title-1", "title-2", "headline", "body", "callout", "footnote", "caption"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(p));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function firstName(name?: string | null) {
  return name?.split(" ")[0] ?? "";
}

/** Mensagem amigável a partir de erros do Supabase/Postgres */
export function friendlyError(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  if (!e?.message) return "Algo deu errado. Tente novamente.";
  if (e.code === "42501" && !/[áéíóúãç]/i.test(e.message)) return "Seu perfil não tem permissão para esta ação.";
  if (e.message.includes("JWT")) return "Sua sessão expirou. Entre novamente.";
  return e.message;
}
