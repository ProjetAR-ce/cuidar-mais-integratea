import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Avatar, Card, CardHeader } from "@/components/ui/primitives";
import { AppointmentStatusBadge } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { age, fmtDateTime } from "@/lib/format";
import { SessionForm } from "./session-form";
import type { AppointmentStatus } from "@/types/domain";

export const metadata = { title: "Registro de atendimento" };

export default async function AtendimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission("session.record");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const { data: a } = await supabase
    .from("appointments")
    .select("id, status, scheduled_for, duration_minutes, objective, summary, evolution_notes, version, updated_at, professional_id, patient_id, service_id, specialty_id, patient:patients(id, full_name, social_name, birth_date), service:services(name, color), specialty:specialties(name), professional:profiles!professional_id(full_name, job_title)")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound();

  const canSeeRevisions = profile.role === "admin" || profile.role === "coordenacao";
  const { data: revisions } = canSeeRevisions
    ? await supabase.from("record_revisions").select("id, version, changed_fields, old_data, changed_at").eq("table_name", "appointments").eq("record_id", id).order("version", { ascending: false })
    : { data: [] };

  await supabase.rpc("log_access", { p_action: "sensitive.read", p_resource: "appointments", p_resource_id: id });

  // Nº da sessão (ficha "Síntese de acompanhamento" do NAPE): presenças na mesma especialidade e serviço até esta data
  let sessionQuery = supabase.from("appointments").select("id", { count: "exact", head: true })
    .eq("patient_id", a.patient_id).eq("service_id", a.service_id).eq("status", "presente").lte("scheduled_for", a.scheduled_for);
  if (a.specialty_id) sessionQuery = sessionQuery.eq("specialty_id", a.specialty_id);
  const { count: sessionNumber } = await sessionQuery;

  const patient = a.patient as unknown as { id: string; full_name: string; social_name: string | null; birth_date: string };
  const service = a.service as unknown as { name: string; color: string | null };
  const specialty = a.specialty as unknown as { name: string } | null;
  const professional = a.professional as unknown as { full_name: string; job_title: string | null };
  const canEdit = profile.role !== "profissional" || a.professional_id === profile.id;
  const clinicalRevisions = (revisions ?? []).filter((r) => (r.changed_fields as string[]).some((f) => ["objective", "summary", "evolution_notes"].includes(f)));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/agenda"><ArrowLeft /> Agenda</Link></Button>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar name={patient.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <Link href={`/pacientes/${patient.id}`} className="text-title-2 font-bold text-ink-strong hover:underline">{patient.social_name ?? patient.full_name}</Link>
          <p className="text-callout text-ink-muted">{age(patient.birth_date)} · {specialty?.name ?? "Atendimento"} com {professional.full_name}{a.status === "presente" && sessionNumber ? ` · sessão nº ${sessionNumber}` : ""}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <ServiceChip name={service.name} color={service.color} size="sm" />
            <span className="text-footnote text-ink-muted">{fmtDateTime(a.scheduled_for)} · {a.duration_minutes} min</span>
            <AppointmentStatusBadge status={a.status as AppointmentStatus} size="sm" />
          </div>
        </div>
        {a.summary && <div className="rounded-[14px] bg-lilac-soft px-3 py-2 text-center"><p className="text-caption font-bold text-lilac-ink uppercase">Versão</p><p className="text-title-2 font-extrabold text-lilac-ink tabular">{a.version}</p></div>}
      </Card>

      <SessionForm
        id={a.id}
        status={a.status as AppointmentStatus}
        initial={{ objective: a.objective ?? "", summary: a.summary ?? "", evolution: a.evolution_notes ?? "" }}
        hasRecord={!!a.summary}
        canEdit={canEdit}
        updatedAt={a.updated_at}
      />

      {canSeeRevisions && clinicalRevisions.length > 0 && (
        <Card>
          <CardHeader title="Versões anteriores" icon={History} tone="ink" subtitle="Correções não apagam o registro original (RN-009)." />
          <ol className="divide-y divide-line px-5 pb-3">
            {clinicalRevisions.map((r) => {
              const old = r.old_data as { summary?: string | null; objective?: string | null };
              return (
                <li key={r.id} className="py-3">
                  <p className="text-footnote font-bold text-ink-muted">Alteração {r.version} · {fmtDateTime(r.changed_at)}</p>
                  <p className="mt-1 text-callout"><b>Síntese anterior:</b> {old.summary ?? <i className="text-ink-muted">vazia</i>}</p>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
