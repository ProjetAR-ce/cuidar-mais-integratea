"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().email("Digite um e-mail válido."),
  password: z.string().min(6, "A senha tem pelo menos 6 caracteres."),
  next: z.string().optional(),
});

export type LoginState = { error?: string; fields?: { email?: string } } | undefined;

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email: String(formData.get("email") ?? "") } };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { error: "E-mail ou senha incorretos.", fields: { email: parsed.data.email } };

  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.active || profile.role === "responsavel") {
    await supabase.auth.signOut();
    return {
      error: profile?.role === "responsavel"
        ? "Responsáveis acessam pelo aplicativo Cuidar+ no celular."
        : "Seu usuário não tem acesso ao sistema. Procure a administração.",
      fields: { email: parsed.data.email },
    };
  }
  await supabase.rpc("log_access", { p_action: "login", p_resource: "auth" });
  const next = parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/inicio";
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.rpc("log_access", { p_action: "logout", p_resource: "auth" });
  await supabase.auth.signOut();
  redirect("/login");
}
