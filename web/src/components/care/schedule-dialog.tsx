"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scheduleAppointment } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Celebrate } from "@/components/ui/feedback";
import { PatientPicker, type PickedPatient } from "./patient-picker";
import { todayLocalISODate } from "@/lib/format";
import type { Offer, StaffMember } from "@/lib/data/reference";
import type { Service, Specialty } from "@/types/domain";

export type ScheduleDefaults = {
  patient?: PickedPatient | null;
  service_id?: string | null;
  specialty_id?: string | null;
  professional_id?: string | null;
  queue_entry_id?: string | null;
  date?: string;
  time?: string;
};

export function ScheduleDialog({
  open, onOpenChange, defaults, services, specialties, offers, staff,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; defaults?: ScheduleDefaults;
  services: Service[]; specialties: Specialty[]; offers: Offer[]; staff: StaffMember[];
}) {
  const router = useRouter();
  const [patient, setPatient] = React.useState<PickedPatient | null>(null);
  const [serviceId, setServiceId] = React.useState("");
  const [specialtyId, setSpecialtyId] = React.useState("");
  const [professionalId, setProfessionalId] = React.useState("");
  const [date, setDate] = React.useState(todayLocalISODate(1));
  const [time, setTime] = React.useState("08:00");
  const [duration, setDuration] = React.useState("50");
  const [objective, setObjective] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [party, setParty] = React.useState(false);

  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
    setPatient(defaults?.patient ?? null);
    setServiceId(defaults?.service_id ?? "");
    setSpecialtyId(defaults?.specialty_id ?? "");
    setProfessionalId(defaults?.professional_id ?? "");
    setDate(defaults?.date ?? todayLocalISODate(1));
    setTime(defaults?.time ?? "08:00");
    setObjective("");
    setError(null);
    }
  }

  const serviceSpecialties = specialties.filter((s) => offers.some((o) => o.service_id === serviceId && o.specialty_id === s.id));
  const professionals = staff.filter((p) => p.service_id === serviceId && (!specialtyId || p.specialty_id === specialtyId || p.role === "coordenacao"));
  const fallbackProfessionals = professionals.length ? professionals : staff.filter((p) => p.service_id === serviceId);

  async function submit() {
    setError(null);
    if (!patient) return setError("Escolha o paciente.");
    setSaving(true);
    const r = await scheduleAppointment({
      patient_id: patient.id, service_id: serviceId, specialty_id: specialtyId, professional_id: professionalId,
      date, time, duration: Number(duration), queue_entry_id: defaults?.queue_entry_id ?? null, objective,
    });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    onOpenChange(false);
    setParty(true);
    toast.success("Atendimento agendado", { description: `${patient.full_name} · ${date.split("-").reverse().join("/")} às ${time}` });
    router.refresh();
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title="Agendar atendimento"
        description={defaults?.queue_entry_id ? "O paciente sai da fila e passa para acompanhamento." : "Escolha o serviço, a especialidade e o profissional."}
        footer={<>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="mint" onClick={submit} loading={saving}>Agendar</Button>
        </>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Paciente" htmlFor="sch-patient" required>
            <PatientPicker id="sch-patient" value={patient} onChange={setPatient} />
          </Field>
          <Field label="Serviço" htmlFor="sch-service" required>
            <Select id="sch-service" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSpecialtyId(""); setProfessionalId(""); }}>
              <option value="">Escolha…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Especialidade" htmlFor="sch-specialty" required>
            <Select id="sch-specialty" value={specialtyId} onChange={(e) => { setSpecialtyId(e.target.value); setProfessionalId(""); }} disabled={!serviceId}>
              <option value="">{serviceId ? "Escolha…" : "Escolha o serviço primeiro"}</option>
              {serviceSpecialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field className="sm:col-span-2" label="Profissional" htmlFor="sch-prof" required>
            <Select id="sch-prof" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={!serviceId}>
              <option value="">Escolha…</option>
              {fallbackProfessionals.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.job_title ? ` · ${p.job_title}` : ""}</option>)}
            </Select>
          </Field>
          <Field label="Data" htmlFor="sch-date" required>
            <Input id="sch-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Horário" htmlFor="sch-time" required>
              <Input id="sch-time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Duração" htmlFor="sch-dur">
              <Select id="sch-dur" value={duration} onChange={(e) => setDuration(e.target.value)}>
                {[30, 40, 50, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
              </Select>
            </Field>
          </div>
          <Field className="sm:col-span-2" label="Objetivo (opcional)" htmlFor="sch-obj">
            <Textarea id="sch-obj" value={objective} onChange={(e) => setObjective(e.target.value)} className="min-h-20" />
          </Field>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-4 py-3 text-callout font-semibold text-rose-ink">{error}</p>}
      </Modal>
      <Celebrate show={party} message="Agendado!" onDone={() => setParty(false)} />
    </>
  );
}
