"use server";

import { createClient } from "@/lib/supabase/server";

export type PatientHit = {
  id: string; full_name: string; social_name: string | null; birth_date: string; cns: string | null; cpf: string | null;
  mother_name: string; guardian_name: string | null; aps_reference: string | null; status: string; score: number; match_reason: string;
};

export async function searchPatients(query: string, birthDate?: string | null): Promise<{ data?: PatientHit[]; error?: string }> {
  const q = query.trim();
  if (q.length < 2 && !birthDate) return { data: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_patients", { p_query: q, p_birth_date: birthDate || null, p_limit: 20 });
  if (error) return { error: error.message };
  return { data: data as PatientHit[] };
}
