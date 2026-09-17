import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { ReferralsBoard, type ReferralItem } from "./referrals-board";

export const metadata = { title: "Encaminhamentos" };

export default async function EncaminhamentosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requirePermission("referrals.manage");
  const sp = await searchParams;
  const ref = await getReference();
  const supabase = await createClient();

  const direction = sp.direcao === "enviados" ? "enviados" : "recebidos";
  const situation = typeof sp.situacao === "string" ? sp.situacao : "pendentes";
  const serviceId = typeof sp.servico === "string" ? sp.servico : profile.service_id ?? "todos";

  const base = () => supabase.from("referrals").select("id, patient_id, origin_service_id, destination_service_id, specialty_id, priority, status, reason, response_notes, complement_notes, created_at, responded_at, due_at, patient:patients(full_name, social_name, birth_date), author:profiles!created_by(full_name, job_title), responder:profiles!responded_by(full_name)");
  const scope = <T extends ReturnType<typeof base>>(q: T) => {
    if (serviceId === "todos") return q;
    return (direction === "recebidos" ? q.eq("destination_service_id", serviceId) : q.eq("origin_service_id", serviceId)) as T;
  };

  let q = scope(base());
  if (situation === "pendentes") q = q.eq("status", "pendente").order("created_at", { ascending: true });
  else if (situation === "complemento") q = q.eq("status", "complemento_solicitado").order("responded_at", { ascending: false });
  else q = q.in("status", ["aceito", "devolvido"]).order("responded_at", { ascending: false });

  const countQ = scope(supabase.from("referrals").select("status") as unknown as ReturnType<typeof base>);
  const [{ data, error }, { data: all }] = await Promise.all([q.limit(200), countQ.limit(5000)]);
  if (error) throw new Error(error.message);

  const counts = { pendentes: 0, complemento: 0, respondidos: 0 };
  ((all ?? []) as unknown as { status: string }[]).forEach((r) => {
    if (r.status === "pendente") counts.pendentes++;
    else if (r.status === "complemento_solicitado") counts.complemento++;
    else counts.respondidos++;
  });

  return (
    <ReferralsBoard
      items={(data ?? []) as unknown as ReferralItem[]}
      counts={counts}
      filters={{ direction, situation, serviceId }}
      role={profile.role}
      userServiceId={profile.service_id}
      services={ref.services}
      specialties={ref.specialties}
      offers={ref.offers}
    />
  );
}
