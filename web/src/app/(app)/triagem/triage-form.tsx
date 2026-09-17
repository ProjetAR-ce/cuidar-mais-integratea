"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ListOrdered, RotateCcw } from "lucide-react";
import { createTriage } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { ChoiceCards, Field, Select, Textarea } from "@/components/ui/form";
import { Celebrate } from "@/components/ui/feedback";
import { PRIORITY_META } from "@/components/ui/status";
import { PatientPicker, type PickedPatient } from "@/components/care/patient-picker";
import type { Offer } from "@/lib/data/reference";
import type { Priority, Service, Specialty } from "@/types/domain";

export function TriageForm({ initialPatient, services, specialties, offers, lockedServiceId, criteria }: {
  initialPatient: PickedPatient | null; services: Service[]; specialties: Specialty[]; offers: Offer[];
  lockedServiceId: string | null; criteria: Partial<Record<Priority, string>>;
}) {
  const router = useRouter();
  const [patient, setPatient] = React.useState<PickedPatient | null>(initialPatient);
  const [serviceId, setServiceId] = React.useState(lockedServiceId ?? "");
  const [specialtyId, setSpecialtyId] = React.useState<string | null>(null);
  const [priority, setPriority] = React.useState<Priority | null>(null);
  const [need, setNeed] = React.useState("");
  const [justification, setJustification] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [addToQueue, setAddToQueue] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ queue: string | null } | null>(null);
  const [party, setParty] = React.useState(false);

  const serviceSpecialties = specialties.filter((s) => offers.some((o) => o.service_id === serviceId && o.specialty_id === s.id));

  function reset() {
    setPatient(null); setSpecialtyId(null); setPriority(null); setNeed(""); setJustification(""); setNotes(""); setDone(null); setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!patient) return setError("Escolha o paciente.");
    if (!serviceId || !specialtyId) return setError("Escolha o serviço e a especialidade.");
    if (!priority) return setError("Escolha a prioridade.");
    setSaving(true);
    const r = await createTriage({ patient_id: patient.id, service_id: serviceId, specialty_id: specialtyId, priority, need, justification, notes, add_to_queue: addToQueue });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    setDone({ queue: r.data?.queue_entry_id ?? null });
    setParty(true);
    router.refresh();
  }

  if (done && patient) {
    return (
      <Card className="flex flex-col items-center p-10 text-center">
        <span className="flex size-20 animate-pop items-center justify-center rounded-full bg-mint text-ink-strong shadow-[0_5px_0_var(--color-mint-edge)]">
          <ListOrdered className="size-10" />
        </span>
        <h2 className="mt-5 text-title-1">Triagem registrada</h2>
        <p className="mt-1 max-w-md text-callout text-ink-muted">
          {done.queue ? `${patient.full_name} entrou na fila com prioridade ${priority}. A posição considera prioridade e tempo de espera.` : `A triagem de ${patient.full_name} foi registrada na linha do tempo.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary"><Link href={`/pacientes/${patient.id}?aba=jornada`}>Ver jornada</Link></Button>
          {done.queue && <Button asChild><Link href={`/fila?servico=${serviceId}&especialidade=${specialtyId}`}>Ver na fila <ArrowRight /></Link></Button>}
          <Button variant="mint" onClick={reset}><RotateCcw /> Nova triagem</Button>
        </div>
        <Celebrate show={party} message="Paciente na fila!" onDone={() => setParty(false)} />
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-7">
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Field label="Paciente" htmlFor="tri-patient" required>
          <PatientPicker id="tri-patient" value={patient} onChange={setPatient} autoFocus={!initialPatient} />
        </Field>

        <Field label="Serviço" htmlFor="tri-service" required hint={lockedServiceId ? "Profissionais triam para o próprio serviço." : undefined}>
          <Select id="tri-service" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSpecialtyId(null); }} disabled={!!lockedServiceId}>
            <option value="">Escolha…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.description ? ` · ${s.description}` : ""}</option>)}
          </Select>
        </Field>

        {serviceId && (
          <fieldset>
            <legend className="mb-1.5 text-callout font-semibold text-ink-strong">Especialidade <span className="text-rose-ink" aria-hidden>*</span></legend>
            <ChoiceCards name="specialty" value={specialtyId} onChange={setSpecialtyId} columns={3} options={serviceSpecialties.map((s) => {
              const o = offers.find((x) => x.service_id === serviceId && x.specialty_id === s.id);
              return { value: s.id, label: s.name, description: o ? `${o.monthly_capacity} vagas/mês` : undefined };
            })} />
          </fieldset>
        )}

        <Field label="Necessidade identificada" htmlFor="tri-need" required>
          <Textarea id="tri-need" value={need} onChange={(e) => setNeed(e.target.value)} placeholder="O que a família e a equipe observam? Qual apoio é necessário?" className="min-h-24" />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-callout font-semibold text-ink-strong">Prioridade <span className="text-rose-ink" aria-hidden>*</span></legend>
          <ChoiceCards name="priority" value={priority} onChange={setPriority} options={(["P1", "P2", "P3"] as const).map((p) => {
            const m = PRIORITY_META[p];
            return { value: p, label: m.label, icon: <m.icon className="size-5" />, description: criteria[p] };
          })} />
          <p className="mt-2 text-caption text-ink-muted">Critérios provisórios, aguardando validação da Prefeitura (D-03). O sistema não decide a prioridade: ela é definida por profissional habilitado.</p>
        </fieldset>

        <Field label="Justificativa da prioridade" htmlFor="tri-just" required hint="Obrigatória (RN-006). Fica visível na fila para explicar a ordem.">
          <Textarea id="tri-just" value={justification} onChange={(e) => setJustification(e.target.value)} className="min-h-20" aria-invalid={justification.length > 0 && justification.trim().length < 10} />
        </Field>

        <Field label="Notas clínicas (opcional)" htmlFor="tri-notes" hint="Visíveis só para profissionais e coordenação.">
          <Textarea id="tri-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
        </Field>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 p-4">
          <input type="checkbox" checked={addToQueue} onChange={(e) => setAddToQueue(e.target.checked)} className="size-5 accent-[var(--color-ink)]" />
          <span>
            <span className="block font-semibold text-ink-strong">Inserir na fila da especialidade</span>
            <span className="block text-footnote text-ink-muted">Com data de entrada, origem, prioridade e situação (RN-005).</span>
          </span>
        </label>

        {error && <p role="alert" className="rounded-lg bg-rose-soft px-4 py-3 text-callout font-semibold text-rose-ink">{error}</p>}
        <Button type="submit" size="lg" variant="peach" className="w-full" loading={saving}>Registrar triagem</Button>
      </form>
    </Card>
  );
}
