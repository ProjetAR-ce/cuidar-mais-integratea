"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { createReferral } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ChoiceCards, Field, Select, Textarea } from "@/components/ui/form";
import { Celebrate } from "@/components/ui/feedback";
import { PRIORITY_META } from "@/components/ui/status";
import { PatientPicker, type PickedPatient } from "./patient-picker";
import type { Offer } from "@/lib/data/reference";
import type { Priority, Service, Specialty } from "@/types/domain";

export function ReferralDialog({
  open, onOpenChange, patient: fixedPatient, services, specialties, offers, originServiceId, lockOrigin,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; patient?: PickedPatient | null;
  services: Service[]; specialties: Specialty[]; offers: Offer[]; originServiceId?: string | null; lockOrigin?: boolean;
}) {
  const router = useRouter();
  const [patient, setPatient] = React.useState<PickedPatient | null>(null);
  const [origin, setOrigin] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [specialty, setSpecialty] = React.useState("");
  const [priority, setPriority] = React.useState<Priority | null>("P2");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [party, setParty] = React.useState(false);

  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPatient(fixedPatient ?? null);
      setOrigin(originServiceId ?? "");
      setDestination(""); setSpecialty(""); setPriority("P2"); setReason(""); setError(null);
    }
  }

  const destSpecialties = specialties.filter((s) => offers.some((o) => o.service_id === destination && o.specialty_id === s.id));

  async function submit() {
    setError(null);
    if (!patient) return setError("Escolha o paciente.");
    if (!priority) return setError("Escolha a prioridade.");
    setSaving(true);
    const r = await createReferral({ patient_id: patient.id, origin_service_id: origin, destination_service_id: destination, specialty_id: specialty || null, priority, reason });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    onOpenChange(false);
    setParty(true);
    toast.success("Encaminhamento enviado", { description: "O serviço de destino precisa aceitar, devolver ou pedir complemento." });
    router.refresh();
  }

  return (
    <>
      <Modal
        open={open} onOpenChange={onOpenChange} size="lg" title="Novo encaminhamento"
        description="O encaminhamento só é concluído quando o destino aceitar ou devolver (RN-008)."
        footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="lilac" onClick={submit} loading={saving}>Enviar encaminhamento</Button></>}
      >
        <div className="grid gap-4">
          {!fixedPatient && (
            <Field label="Paciente" htmlFor="ref-patient" required>
              <PatientPicker id="ref-patient" value={patient} onChange={setPatient} />
            </Field>
          )}
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="De (origem)" htmlFor="ref-origin" required>
              <Select id="ref-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} disabled={lockOrigin}>
                <option value="">Escolha…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <ArrowRight className="mx-auto mb-3.5 hidden size-6 text-ink-muted sm:block" aria-hidden />
            <Field label="Para (destino)" htmlFor="ref-dest" required>
              <Select id="ref-dest" value={destination} onChange={(e) => { setDestination(e.target.value); setSpecialty(""); }}>
                <option value="">Escolha…</option>
                {services.filter((s) => s.id !== origin).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Especialidade no destino" htmlFor="ref-sp" hint="Com especialidade, o aceite já coloca o paciente na fila do destino.">
            <Select id="ref-sp" value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={!destination}>
              <option value="">Sem especialidade definida</option>
              {destSpecialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-callout font-semibold text-ink-strong">Prioridade</legend>
            <ChoiceCards name="ref-priority" value={priority} onChange={setPriority} options={(["P1", "P2", "P3"] as const).map((p) => {
              const m = PRIORITY_META[p];
              return { value: p, label: m.label, icon: <m.icon className="size-5" /> };
            })} />
          </fieldset>
          <Field label="Motivo" htmlFor="ref-reason" required hint="Explique o que precisa ser feito. Evite detalhes clínicos desnecessários.">
            <Textarea id="ref-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-4 py-3 text-callout font-semibold text-rose-ink">{error}</p>}
      </Modal>
      <Celebrate show={party} message="Encaminhado!" onDone={() => setParty(false)} />
    </>
  );
}
