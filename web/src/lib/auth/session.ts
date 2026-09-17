import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission } from "./permissions";
import type { Profile } from "@/types/domain";

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, job_title, service_id, specialty_id, active, service:services(id, name, code, color)")
    .eq("id", sub)
    .maybeSingle();
  return (profile as unknown as Profile) ?? null;
});

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?erro=perfil");
  if (!profile.active) redirect("/login?erro=inativo");
  if (profile.role === "responsavel") redirect("/login?erro=responsavel");
  return profile;
}

/** Bloqueia a página para perfis sem a permissão (CA-08) e registra a tentativa. */
export async function requirePermission(permission: Permission) {
  const profile = await requireProfile();
  if (!can(profile.role, permission)) {
    const supabase = await createClient();
    await supabase.rpc("log_access", { p_action: "access.denied", p_resource: permission, p_details: { role: profile.role } });
    redirect(`/sem-acesso?recurso=${permission}`);
  }
  return profile;
}
