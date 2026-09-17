import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { PriorityBadge } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { fromNow } from "@/lib/format";
import { TriageForm } from "./triage-form";
import type { Priority } from "@/types/domain";

export const metadata = { title: "Triagem" };

export default async function TriagemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requirePermission("triage.create");
  const sp = await searchParams;
  const supabase = await createClient();
  const ref = await getReference();
  const patientId = typeof sp.paciente === "string" ? sp.paciente : null;

  const [{ data: patient }, { data: criteria }, { data: recent }] = await Promise.all([
    patientId ? supabase.from("patients").select("id, full_name, social_name, birth_date, mother_name").eq("id", patientId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("system_parameters").select("value").eq("key", "criterios_prioridade").maybeSingle(),
    supabase.from("triages").select("id, priority, created_at, service_id, specialty_id, patient:patients(id, full_name)").eq("professional_id", profile.id).order("created_at", { ascending: false }).limit(8),
  ]);

  const svc = Object.fromEntries(ref.services.map((s) => [s.id, s]));
  const spc = Object.fromEntries(ref.specialties.map((s) => [s.id, s]));

  return (
    <>
      <PageHeader eyebrow="Entrada na rede" title="Triagem" subtitle="Registre a necessidade, a especialidade e a prioridade. A prioridade clínica sempre precisa de justificativa." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <TriageForm
          initialPatient={patient ? { id: patient.id, full_name: patient.social_name ?? patient.full_name, birth_date: patient.birth_date, mother_name: patient.mother_name } : null}
          services={ref.services}
          specialties={ref.specialties}
          offers={ref.offers}
          lockedServiceId={profile.role === "profissional" ? profile.service_id : null}
          criteria={(criteria?.value ?? {}) as Record<Priority, string>}
        />
        <Card className="h-fit">
          <CardHeader title="Suas últimas triagens" icon={ClipboardList} tone="peach" />
          <ul className="divide-y divide-line px-5 pb-3">
            {(recent ?? []).length === 0 && <li className="pb-3 text-callout text-ink-muted">Nenhuma triagem ainda.</li>}
            {(recent ?? []).map((t) => {
              const p = t.patient as unknown as { id: string; full_name: string } | null;
              return (
                <li key={t.id} className="py-3">
                  <Link href={`/pacientes/${p?.id}`} className="font-semibold text-ink-strong hover:underline">{p?.full_name}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={t.priority as Priority} short size="sm" />
                    <ServiceChip name={svc[t.service_id]?.name ?? ""} color={svc[t.service_id]?.color} size="sm" />
                    <span className="text-caption text-ink-muted">{t.specialty_id ? spc[t.specialty_id]?.name : ""} · {fromNow(t.created_at)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
