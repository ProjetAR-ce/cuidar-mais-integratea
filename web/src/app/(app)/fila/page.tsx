import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { PageHeader } from "@/components/ui/primitives";
import { QueueBoard, type QueueItem } from "./queue-board";

export const metadata = { title: "Fila de atendimento" };

export default async function FilaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requirePermission("queue.read");
  const sp = await searchParams;
  const ref = await getReference();
  const supabase = await createClient();

  const serviceId = typeof sp.servico === "string" ? sp.servico : profile.service_id ?? "todos";
  const specialtyId = typeof sp.especialidade === "string" ? sp.especialidade : "todas";
  const status = typeof sp.situacao === "string" ? sp.situacao : "aguardando";

  let q = supabase
    .from("v_queue_ranked")
    .select("id, patient_id, patient_name, patient_birth_date, service_id, service_name, service_color, specialty_id, specialty_name, priority, status, origin, entered_at, started_at, finished_at, wait_days, score, queue_position, rank_reason, priority_justification, cancel_reason, priority_points")
    .limit(300);
  if (serviceId !== "todos") q = q.eq("service_id", serviceId);
  if (specialtyId !== "todas") q = q.eq("specialty_id", specialtyId);
  q = status === "aguardando"
    ? q.eq("status", "aguardando").order("service_name").order("specialty_name").order("queue_position")
    : status === "em_atendimento"
      ? q.eq("status", "em_atendimento").order("started_at", { ascending: false })
      : q.in("status", ["concluido", "cancelado"]).order("finished_at", { ascending: false, nullsFirst: false });

  let countQ = supabase.from("queue_entries").select("status");
  if (serviceId !== "todos") countQ = countQ.eq("service_id", serviceId);
  if (specialtyId !== "todas") countQ = countQ.eq("specialty_id", specialtyId);

  const [{ data, error }, { data: counts }] = await Promise.all([q, countQ.limit(5000)]);
  if (error) throw new Error(error.message);

  const c = { aguardando: 0, em_atendimento: 0, encerrados: 0 };
  (counts ?? []).forEach((r) => {
    if (r.status === "aguardando") c.aguardando++;
    else if (r.status === "em_atendimento") c.em_atendimento++;
    else c.encerrados++;
  });

  const offer = serviceId !== "todos" && specialtyId !== "todas" ? ref.offers.find((o) => o.service_id === serviceId && o.specialty_id === specialtyId) ?? null : null;

  return (
    <>
      <PageHeader
        eyebrow="Fila por serviço e especialidade"
        title="Fila de atendimento"
        subtitle="A ordem soma pontos de prioridade e dias de espera, conforme parâmetros da rede. Toda posição tem explicação."
      />
      <QueueBoard
        items={(data ?? []) as QueueItem[]}
        counts={c}
        filters={{ serviceId, specialtyId, status }}
        offer={offer}
        canManage={can(profile.role, "queue.manage")}
        canSchedule={can(profile.role, "agenda.manage")}
        services={ref.services}
        specialties={ref.specialties}
        offers={ref.offers}
        staff={ref.staff}
      />
    </>
  );
}
