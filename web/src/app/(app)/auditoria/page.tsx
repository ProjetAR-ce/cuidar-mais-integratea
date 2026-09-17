import Link from "next/link";
import { Eye, FileDown, LogIn, PencilLine, PlusCircle, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AuditFilters } from "./audit-filters";
import { fmtDateTime, todayLocalISODate } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/types/domain";

export const metadata = { title: "Auditoria" };

const PAGE = 50;

const RESOURCE: Record<string, string> = {
  patients: "Paciente", triages: "Triagem", queue_entries: "Fila", appointments: "Atendimento", referrals: "Encaminhamento",
  care_alerts: "Alerta", care_plans: "Plano", care_plan_items: "Passo do plano", profiles: "Usuário", services: "Serviço",
  service_specialties: "Capacidade", system_parameters: "Parâmetro", patient_duplicate_candidates: "Duplicidade", auth: "Acesso", indicadores: "Indicadores",
  "audit.read": "Auditoria", admin: "Administração", "indicators.read": "Indicadores", "capacity.read": "Capacidade", "patients.read": "Pacientes",
  "patients.create": "Cadastro de paciente", "triage.create": "Triagem", "queue.read": "Fila", "agenda.read": "Agenda", "referrals.manage": "Encaminhamentos",
  "alerts.review": "Alertas", "duplicates.resolve": "Duplicidades", "session.record": "Registro de atendimento",
};

function describe(action: string) {
  if (action === "patient.search") return { label: "Busca de paciente", icon: Search, tone: "ink" as const };
  if (action === "patient.merge") return { label: "Fusão de cadastros", icon: ShieldAlert, tone: "rose" as const };
  if (action === "sensitive.read") return { label: "Consulta sensível", icon: Eye, tone: "lilac" as const };
  if (action === "export") return { label: "Exportação", icon: FileDown, tone: "peach" as const };
  if (action === "login") return { label: "Entrada no sistema", icon: LogIn, tone: "mint" as const };
  if (action === "logout") return { label: "Saída do sistema", icon: LogIn, tone: "ink" as const };
  if (action === "access.denied") return { label: "Acesso negado", icon: ShieldAlert, tone: "rose" as const };
  if (action.endsWith(".insert")) return { label: "Criação", icon: PlusCircle, tone: "mint" as const };
  if (action.endsWith(".update")) return { label: "Alteração", icon: PencilLine, tone: "sun" as const };
  return { label: action, icon: ShieldCheck, tone: "ink" as const };
}

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("audit.read");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const from = get("de") || todayLocalISODate(-30);
  const to = get("ate") || todayLocalISODate();
  const action = get("acao") || "todas";
  const user = get("usuario") || "todos";
  const page = Math.max(1, Number(get("pagina") || 1));

  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, user_id, user_role, action, resource, resource_id, details, created_at", { count: "exact" })
    .gte("created_at", `${from}T00:00:00-03:00`).lt("created_at", `${to}T23:59:59.999-03:00`)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (action === "sensiveis") q = q.in("action", ["sensitive.read", "export", "patient.merge", "access.denied"]);
  else if (action === "alteracoes") q = q.like("action", "%.update");
  else if (action === "criacoes") q = q.like("action", "%.insert");
  else if (action === "acessos") q = q.in("action", ["login", "logout", "access.denied"]);
  else if (action === "buscas") q = q.eq("action", "patient.search");
  if (user !== "todos") q = q.eq("user_id", user);

  const [{ data: logs, count, error }, { data: profiles }] = await Promise.all([
    q,
    supabase.from("profiles").select("id, full_name, role").neq("role", "responsavel").order("full_name"),
  ]);
  if (error) throw new Error(error.message);
  const names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (patch: Record<string, string | number>) => `/auditoria?${new URLSearchParams({ de: from, ate: to, acao: action, usuario: user, pagina: String(page), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <>
      <PageHeader eyebrow="Rastreabilidade" title="Auditoria" subtitle="Registros imutáveis de acessos, consultas sensíveis, alterações, exportações e administração (RF-019, RNF-008)." />
      <AuditFilters from={from} to={to} action={action} user={user} users={(profiles ?? []).map((p) => ({ id: p.id, name: p.full_name }))} />

      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <caption className="sr-only">Registros de auditoria</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-caption font-bold tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3">Quando</th>
                <th scope="col" className="px-3 py-3">Quem</th>
                <th scope="col" className="px-3 py-3">Ação</th>
                <th scope="col" className="px-3 py-3">Recurso</th>
                <th scope="col" className="px-5 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((l) => {
                const d = describe(l.action);
                const details = (l.details ?? {}) as Record<string, unknown>;
                const patientId = typeof details.patient_id === "string" ? details.patient_id : null;
                return (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-footnote whitespace-nowrap text-ink tabular">{fmtDateTime(l.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={names[l.user_id ?? ""] ?? "Sistema"} size="sm" />
                        <div>
                          <p className="text-callout font-semibold text-ink-strong">{names[l.user_id ?? ""] ?? "Sistema"}</p>
                          <p className="text-caption text-ink-muted">{l.user_role ? ROLE_LABEL[l.user_role as Role] ?? l.user_role : "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Badge tone={d.tone} icon={d.icon} size="sm">{d.label}</Badge></td>
                    <td className="px-3 py-3 text-callout text-ink">{RESOURCE[l.resource] ?? l.resource}</td>
                    <td className="max-w-md px-5 py-3 text-caption text-ink-muted">
                      {Array.isArray(details.campos) && <span>Campos: {(details.campos as string[]).join(", ")} · </span>}
                      {typeof details.resultados === "number" && <span>{details.resultados} resultados ({String(details.tipo)}) · </span>}
                      {typeof details.aba === "string" && <span>aba {details.aba} · </span>}
                      {typeof details.role === "string" && l.action === "access.denied" && <span>perfil {String(details.role)} tentou {l.resource} · </span>}
                      {patientId && <Link href={`/pacientes/${patientId}`} className="font-semibold text-lilac-ink hover:underline">abrir paciente</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <span className="text-footnote text-ink-muted">{(count ?? 0).toLocaleString("pt-BR")} registros · página {page} de {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Button asChild size="sm" variant="secondary"><Link href={qs({ pagina: page - 1 })}>Anterior</Link></Button> : <Button size="sm" variant="secondary" disabled>Anterior</Button>}
            {page < pages ? <Button asChild size="sm" variant="secondary"><Link href={qs({ pagina: page + 1 })}>Próxima</Link></Button> : <Button size="sm" variant="secondary" disabled>Próxima</Button>}
          </div>
        </div>
      </Card>
    </>
  );
}
