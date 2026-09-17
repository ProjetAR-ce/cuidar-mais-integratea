import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Service, Specialty, Role } from "@/types/domain";

export type Offer = { service_id: string; specialty_id: string; monthly_capacity: number; professionals_count: number };
export type StaffMember = { id: string; full_name: string; role: Role; service_id: string | null; specialty_id: string | null; job_title: string | null };

export const getReference = cache(async () => {
  const supabase = await createClient();
  const [services, specialties, offers, staff] = await Promise.all([
    supabase.from("services").select("id, name, code, color, description, secretaria").eq("active", true).order("name"),
    supabase.from("specialties").select("id, name, code").eq("active", true).order("name"),
    supabase.from("service_specialties").select("service_id, specialty_id, monthly_capacity, professionals_count").eq("active", true),
    supabase.from("profiles").select("id, full_name, role, service_id, specialty_id, job_title").eq("active", true).in("role", ["profissional", "coordenacao"]).order("full_name"),
  ]);
  return {
    services: (services.data ?? []) as Service[],
    specialties: (specialties.data ?? []) as Specialty[],
    offers: (offers.data ?? []) as Offer[],
    staff: (staff.data ?? []) as StaffMember[],
  };
});

export type Reference = Awaited<ReturnType<typeof getReference>>;
