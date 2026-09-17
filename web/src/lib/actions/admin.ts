"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { friendlyError } from "@/lib/utils";
import type { ActionResult } from "./care";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || !profile.active) throw new Error("Somente administradores podem fazer isso.");
  return profile;
}

export async function logExport(resource: string, details: Record<string, unknown>) {
  const supabase = await createClient();
  await supabase.rpc("log_access", { p_action: "export", p_resource: resource, p_details: details });
}

const roles = ["recepcao", "profissional", "coordenacao", "gestao", "admin", "responsavel"] as const;

const newUserSchema = z.object({
  full_name: z.string().trim().min(5, "Informe o nome completo."),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(8, "A senha provisória precisa de pelo menos 8 caracteres."),
  role: z.enum(roles),
  service_id: z.string().uuid().nullable(),
  specialty_id: z.string().uuid().nullable(),
  job_title: z.string().trim().optional(),
});

export async function createUser(input: z.input<typeof newUserSchema>): Promise<ActionResult<string>> {
  try {
    await requireAdmin();
    const u = newUserSchema.parse(input);
    if ((u.role === "recepcao" || u.role === "profissional") && !u.service_id) return { ok: false, error: "Recepção e profissionais precisam de um serviço." };
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: u.full_name, role: u.role } });
    if (error) return { ok: false, error: error.message.includes("already") ? "Já existe um usuário com este e-mail." : error.message };
    // Grava o perfil com a sessão do admin, para o RLS e a auditoria registrarem o autor.
    const supabase = await createClient();
    const { error: pErr } = await supabase.from("profiles").upsert({
      id: data.user.id, full_name: u.full_name, email: u.email, role: u.role, service_id: u.service_id, specialty_id: u.specialty_id, job_title: u.job_title || null, active: true,
    });
    if (pErr) return { ok: false, error: friendlyError(pErr) };
    revalidatePath("/admin");
    return { ok: true, data: data.user.id };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : (e as Error).message };
  }
}

export async function updateUser(id: string, patch: { role?: string; service_id?: string | null; specialty_id?: string | null; active?: boolean; job_title?: string | null; full_name?: string }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    if (id === me.id && (patch.active === false || (patch.role && patch.role !== "admin"))) return { ok: false, error: "Você não pode remover o seu próprio acesso de administrador." };
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return { ok: false, error: friendlyError(error) };
    if (patch.active === false) {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
    } else if (patch.active === true) {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
    }
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateOffer(serviceId: string, specialtyId: string, monthly_capacity: number, professionals_count: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("service_specialties").upsert({ service_id: serviceId, specialty_id: specialtyId, monthly_capacity, professionals_count, active: true });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin");
  revalidatePath("/capacidade");
  return { ok: true };
}

export async function removeOffer(serviceId: string, specialtyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("service_specialties").update({ active: false }).eq("service_id", serviceId).eq("specialty_id", specialtyId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateParameter(key: string, value: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("system_parameters").update({ value, updated_by: profile?.id }).eq("key", key);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin");
  revalidatePath("/fila");
  return { ok: true };
}

export async function updateOwnProfile(input: { full_name: string; phone: string | null }): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };
  if (input.full_name.trim().length < 5) return { ok: false, error: "Informe o nome completo." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: input.full_name.trim(), phone: input.phone?.trim() || null }).eq("id", profile.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changeOwnPassword(password: string): Promise<ActionResult> {
  if (password.length < 8) return { ok: false, error: "A nova senha precisa de pelo menos 8 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}
