import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { AlertsBoard, type AlertItem } from "./alerts-board";

export const metadata = { title: "Alertas" };

export default async function AlertasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("alerts.review");
  const sp = await searchParams;
  const supabase = await createClient();
  const ref = await getReference();
  await supabase.rpc("refresh_care_alerts");

  const code = typeof sp.tipo === "string" ? sp.tipo : "todos";
  const status = sp.situacao === "revisados" ? "revisado" : "pendente";
  const serviceId = typeof sp.servico === "string" ? sp.servico : "todos";

  let q = supabase
    .from("care_alerts")
    .select("id, code, alert_type, title, reason, action_recommended, severity, status, created_at, reviewed_at, review_notes, related_table, related_id, service_id, patient:patients(id, full_name, social_name), reviewer:profiles!reviewed_by(full_name)")
    .eq("status", status)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (code !== "todos") q = q.eq("code", code);
  if (serviceId !== "todos") q = q.eq("service_id", serviceId);

  let countQ = supabase.from("care_alerts").select("code").eq("status", "pendente");
  if (serviceId !== "todos") countQ = countQ.eq("service_id", serviceId);

  const [{ data, error }, { data: pending }] = await Promise.all([q, countQ.limit(5000)]);
  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  (pending ?? []).forEach((a) => { counts[a.code ?? "?"] = (counts[a.code ?? "?"] ?? 0) + 1; });

  return (
    <AlertsBoard
      items={(data ?? []) as unknown as AlertItem[]}
      counts={counts}
      totalPending={(pending ?? []).length}
      filters={{ code, status, serviceId }}
      services={ref.services}
    />
  );
}
