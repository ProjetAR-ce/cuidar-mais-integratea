import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { todayLocalISODate } from "@/lib/format";
import { AgendaBoard } from "./agenda-board";
import type { AgendaRow } from "../pacientes/[id]/page";

export const metadata = { title: "Agenda" };

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -wd);
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requirePermission("agenda.read");
  const sp = await searchParams;
  const ref = await getReference();
  const supabase = await createClient();

  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : todayLocalISODate();
  const view = sp.visao === "semana" ? "semana" : "dia";
  const professional = typeof sp.profissional === "string" ? sp.profissional : profile.role === "profissional" ? profile.id : "todos";
  const service = typeof sp.servico === "string" ? sp.servico : profile.role === "recepcao" && profile.service_id ? profile.service_id : "todos";

  const start = view === "semana" ? mondayOf(date) : date;
  const end = addDays(start, view === "semana" ? 7 : 1);

  let q = supabase.from("v_agenda").select("*")
    .gte("scheduled_for", `${start}T00:00:00-03:00`)
    .lt("scheduled_for", `${end}T00:00:00-03:00`)
    .order("scheduled_for")
    .limit(800);
  if (professional !== "todos") q = q.eq("professional_id", professional);
  if (service !== "todos") q = q.eq("service_id", service);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (
    <AgendaBoard
      rows={(data ?? []) as AgendaRow[]}
      date={date}
      start={start}
      view={view}
      filters={{ professional, service }}
      userId={profile.id}
      canRecord={can(profile.role, "session.record")}
      services={ref.services}
      specialties={ref.specialties}
      offers={ref.offers}
      staff={ref.staff}
      defaultServiceId={profile.service_id}
    />
  );
}
