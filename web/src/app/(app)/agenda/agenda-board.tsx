"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  CalendarClock, CalendarPlus, Check, ChevronLeft, ChevronRight, FilePen, MoreHorizontal, Phone, UserX, XCircle,
} from "lucide-react";
import { cancelAppointment, markAttendance, rescheduleAppointment } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, ProgressRing } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Celebrate, EmptyState } from "@/components/ui/feedback";
import { AppointmentStatusBadge } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { ScheduleDialog, type ScheduleDefaults } from "@/components/care/schedule-dialog";
import { TONE, toneOf } from "@/components/ui/tone";
import { fmtTime, fmtWeekday, age, nowMs, todayLocalISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Offer, StaffMember } from "@/lib/data/reference";
import type { Service, Specialty } from "@/types/domain";
import type { AgendaRow } from "../pacientes/[id]/page";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const localDateOf = (ts: string) => new Date(new Date(ts).getTime() - 3 * 3600_000).toISOString().slice(0, 10);

export function AgendaBoard({ rows, date, start, view, filters, userId, canRecord, services, specialties, offers, staff, defaultServiceId }: {
  rows: AgendaRow[]; date: string; start: string; view: "dia" | "semana"; filters: { professional: string; service: string };
  userId: string; canRecord: boolean; services: Service[]; specialties: Specialty[]; offers: Offer[]; staff: StaffMember[]; defaultServiceId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [schedule, setSchedule] = React.useState<ScheduleDefaults | null>(null);
  const [absence, setAbsence] = React.useState<AgendaRow | null>(null);
  const [resched, setResched] = React.useState<AgendaRow | null>(null);
  const [cancel, setCancel] = React.useState<AgendaRow | null>(null);
  const [party, setParty] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => p.set(k, v));
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const today = todayLocalISODate();
  const active = rows.filter((r) => r.status !== "cancelado");
  const marked = active.filter((r) => r.status !== "agendado").length;
  const presentes = active.filter((r) => r.status === "presente").length;

  async function present(r: AgendaRow) {
    setPending(r.id);
    const res = await markAttendance(r.id, "presente");
    setPending(null);
    if (!res.ok) return toast.error(res.error);
    setParty(`${r.patient_name.split(" ")[0]} chegou!`);
    router.refresh();
  }

  const professionals = staff.filter((s) => filters.service === "todos" || s.service_id === filters.service);

  return (
    <>
      <PageHeader
        eyebrow="Agenda e presença"
        title="Agenda"
        subtitle={view === "dia" ? <span className="first-letter:uppercase">{fmtWeekday(`${date}T12:00:00-03:00`)}</span> : `Semana de ${start.split("-").reverse().join("/")}`}
        actions={<Button variant="mint" onClick={() => setSchedule({ service_id: defaultServiceId, professional_id: staff.some((s) => s.id === userId) ? userId : null, date: date >= today ? date : today })}><CalendarPlus /> Novo agendamento</Button>}
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="secondary" aria-label="Anterior" onClick={() => go({ data: addDays(date, view === "semana" ? -7 : -1) })}><ChevronLeft /></Button>
            <Button variant="secondary" onClick={() => go({ data: today })}>Hoje</Button>
            <Button size="icon" variant="secondary" aria-label="Próximo" onClick={() => go({ data: addDays(date, view === "semana" ? 7 : 1) })}><ChevronRight /></Button>
          </div>
          <Field label="Data" htmlFor="ag-date" className="w-40">
            <Input id="ag-date" type="date" value={date} onChange={(e) => e.target.value && go({ data: e.target.value })} />
          </Field>
          <Field label="Serviço" htmlFor="ag-service" className="min-w-36 flex-1">
            <Select id="ag-service" value={filters.service} onChange={(e) => go({ servico: e.target.value, profissional: "todos" })}>
              <option value="todos">Todos</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Profissional" htmlFor="ag-prof" className="min-w-44 flex-1">
            <Select id="ag-prof" value={filters.professional} onChange={(e) => go({ profissional: e.target.value })}>
              <option value="todos">Todos</option>
              {professionals.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
          </Field>
          <SegmentedControl label="Visualização" value={view} onChange={(v) => go({ visao: v })} options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }]} />
        </Card>

        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={marked} max={Math.max(active.length, 1)} tone="mint" size={68} stroke={10} label={`${marked} de ${active.length} presenças registradas`}>
            <span className="text-callout font-extrabold tabular">{active.length ? Math.round((marked / active.length) * 100) : 0}%</span>
          </ProgressRing>
          <div>
            <p className="text-footnote font-semibold text-ink-muted">Presença registrada</p>
            <p className="text-title-2 font-extrabold tabular">{marked}<span className="text-ink-muted">/{active.length}</span></p>
            <p className="text-caption text-ink-muted">{presentes} presentes</p>
          </div>
        </Card>
      </div>

      {view === "dia" ? (
        rows.length === 0 ? (
          <Card><EmptyState title="Agenda livre" description="Nenhum atendimento para este filtro." action={<Button variant="mint" onClick={() => setSchedule({ service_id: defaultServiceId, date })}><CalendarPlus /> Agendar</Button>} /></Card>
        ) : (
          <ol className="space-y-3">
            {rows.map((r, idx) => {
              const t = TONE[toneOf(r.service_color)];
              const isPast = new Date(r.scheduled_for).getTime() < nowMs();
              return (
                <motion.li key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.02, 0.3) }}>
                  <Card className={cn("flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap", r.status === "cancelado" && "opacity-60")}>
                    <div className="w-20 shrink-0 text-center">
                      <p className="text-title-2 font-extrabold text-ink-strong tabular">{fmtTime(r.scheduled_for)}</p>
                      <p className="text-caption text-ink-muted">{r.duration_minutes} min</p>
                    </div>
                    <span aria-hidden className={cn("hidden h-12 w-1.5 rounded-full sm:block", t.bg)} />
                    <div className="min-w-0 flex-1 basis-56">
                      <Link href={`/pacientes/${r.patient_id}`} className="block truncate text-headline font-bold text-ink-strong hover:underline">{r.patient_name}</Link>
                      <p className="truncate text-footnote text-ink-muted">
                        {r.specialty_name ?? "Atendimento"} · {r.professional_name} · {age(r.patient_birth_date)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ServiceChip name={r.service_name} color={r.service_color} size="sm" />
                        {r.guardian_phone && <a href={`tel:${r.guardian_phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1 text-caption font-semibold text-lilac-ink hover:underline"><Phone className="size-3.5" />{r.guardian_phone}</a>}
                        {r.absence_reason && <span className="text-caption text-ink-muted">Motivo: {r.absence_reason}</span>}
                        {r.cancel_reason && <span className="text-caption text-ink-muted">{r.cancel_reason}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {r.status === "agendado" ? (
                        <>
                          <Button size="sm" variant="mint" loading={pending === r.id} onClick={() => present(r)}><Check /> Presente</Button>
                          <Button size="sm" variant="secondary" onClick={() => setAbsence(r)} disabled={!isPast && localDateOf(r.scheduled_for) > today}><UserX /> Falta</Button>
                        </>
                      ) : <AppointmentStatusBadge status={r.status} />}
                      {canRecord && (r.status === "presente" || r.status === "agendado") && (
                        <Button asChild size="sm" variant={r.has_session_record ? "ghost" : "lilac"}>
                          <Link href={`/atendimentos/${r.id}`}><FilePen /> {r.has_session_record ? "Registro" : "Registrar"}</Link>
                        </Button>
                      )}
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={`Mais ações para ${r.patient_name}`}><MoreHorizontal /></Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-56 rounded-[18px] border border-line bg-surface p-1.5 shadow-float">
                            {r.status === "agendado" && <Item onSelect={() => setResched(r)}><CalendarClock className="size-4" /> Reagendar</Item>}
                            {r.status === "agendado" && <Item danger onSelect={() => setCancel(r)}><XCircle className="size-4" /> Cancelar</Item>}
                            {r.status !== "agendado" && r.status !== "cancelado" && !r.has_session_record && (
                              <Item onSelect={async () => {
                                const res = await markAttendance(r.id, "agendado");
                                if (!res.ok) return toast.error(res.error);
                                toast.success("Marcação desfeita");
                                router.refresh();
                              }}>Desfazer marcação</Item>
                            )}
                            <Item onSelect={() => router.push(`/pacientes/${r.patient_id}`)}>Abrir paciente</Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </ol>
        )
      ) : (
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d, i) => {
              const dayRows = rows.filter((r) => localDateOf(r.scheduled_for) === d);
              const isToday = d === today;
              return (
                <div key={d} className={cn("card min-h-72 p-2.5", isToday && "ring-2 ring-mint-edge")}>
                  <button onClick={() => go({ data: d, visao: "dia" })} className="mb-2 flex w-full items-center justify-between rounded-[12px] px-2 py-1.5 hover:bg-surface-2">
                    <span className="text-footnote font-bold text-ink-muted">{WEEKDAYS[i]}</span>
                    <span className={cn("flex size-8 items-center justify-center rounded-full text-callout font-extrabold tabular", isToday ? "bg-mint text-ink-strong" : "text-ink-strong")}>{Number(d.slice(8))}</span>
                  </button>
                  <ul className="space-y-1.5">
                    {dayRows.length === 0 && <li className="px-2 text-caption text-ink-faint">—</li>}
                    {dayRows.map((r) => {
                      const t = TONE[toneOf(r.service_color)];
                      return (
                        <li key={r.id}>
                          <Link href={`/pacientes/${r.patient_id}`} className={cn("block rounded-[12px] px-2 py-1.5 transition hover:brightness-95", t.soft, r.status === "cancelado" && "line-through opacity-50")}>
                            <span className="flex items-center justify-between gap-1 text-caption font-bold text-ink-strong tabular">
                              {fmtTime(r.scheduled_for)}
                              {r.status === "presente" && <Check className="size-3.5 text-mint-ink" aria-label="presente" />}
                              {r.status.startsWith("falta") && <UserX className="size-3.5 text-rose-ink" aria-label="falta" />}
                            </span>
                            <span className="block truncate text-caption text-ink">{r.patient_name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ScheduleDialog open={!!schedule} onOpenChange={(o) => !o && setSchedule(null)} defaults={schedule ?? undefined} services={services} specialties={specialties} offers={offers} staff={staff} />
      <AbsenceDialog row={absence} onClose={() => setAbsence(null)} />
      <RescheduleDialog row={resched} onClose={() => setResched(null)} />
      <CancelDialog row={cancel} onClose={() => setCancel(null)} />
      <Celebrate show={!!party} message={party ?? ""} onDone={() => setParty(null)} />
    </>
  );
}

function Item({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className={cn("flex h-10 cursor-pointer items-center gap-2 rounded-[12px] px-3 text-callout font-semibold outline-none", danger ? "text-rose-ink data-[highlighted]:bg-rose-soft" : "text-ink data-[highlighted]:bg-surface-2")}>
      {children}
    </DropdownMenu.Item>
  );
}

function AbsenceDialog({ row, onClose }: { row: AgendaRow | null; onClose: () => void }) {
  const router = useRouter();
  const [justified, setJustified] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [prev, setPrev] = React.useState(row);
  if (row !== prev) { setPrev(row); setJustified(false); setReason(""); }
  return (
    <Modal open={!!row} onOpenChange={(o) => !o && onClose()} size="sm" title="Registrar falta" description={row ? `${row.patient_name} · ${fmtTime(row.scheduled_for)}` : ""}
      footer={<><Button variant="secondary" onClick={onClose}>Voltar</Button><Button variant="danger" loading={saving} disabled={justified && reason.trim().length < 3} onClick={async () => {
        if (!row) return;
        setSaving(true);
        const r = await markAttendance(row.id, justified ? "falta_justificada" : "falta_injustificada", reason);
        setSaving(false);
        if (!r.ok) return toast.error(r.error);
        toast("Falta registrada", { description: "Três faltas seguidas geram alerta de risco de interrupção do cuidado." });
        onClose();
        router.refresh();
      }}>Registrar falta</Button></>}
    >
      <div className="space-y-4">
        <SegmentedControl label="Tipo de falta" value={justified ? "j" : "n"} onChange={(v) => setJustified(v === "j")} options={[{ value: "n", label: "Sem justificativa" }, { value: "j", label: "Justificada" }]} />
        <Field label={justified ? "Justificativa" : "Observação (opcional)"} htmlFor="abs-reason" required={justified}>
          <Textarea id="abs-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Criança com febre" className="min-h-20" />
        </Field>
      </div>
    </Modal>
  );
}

function RescheduleDialog({ row, onClose }: { row: AgendaRow | null; onClose: () => void }) {
  const router = useRouter();
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [prev, setPrev] = React.useState<AgendaRow | null>(null);
  if (row !== prev) {
    setPrev(row);
    if (row) {
      const local = new Date(new Date(row.scheduled_for).getTime() - 3 * 3600_000).toISOString();
      setDate(local.slice(0, 10)); setTime(local.slice(11, 16)); setReason("");
    }
  }
  return (
    <Modal open={!!row} onOpenChange={(o) => !o && onClose()} size="sm" title="Reagendar" description="O agendamento original fica no histórico como cancelado por reagendamento."
      footer={<><Button variant="secondary" onClick={onClose}>Voltar</Button><Button loading={saving} disabled={reason.trim().length < 3} onClick={async () => {
        if (!row) return;
        setSaving(true);
        const r = await rescheduleAppointment(row.id, date, time, reason);
        setSaving(false);
        if (!r.ok) return toast.error(r.error);
        toast.success("Reagendado");
        onClose();
        router.refresh();
      }}>Reagendar</Button></>}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nova data" htmlFor="rs-date"><Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Horário" htmlFor="rs-time"><Input id="rs-time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Motivo" htmlFor="rs-reason" required><Input id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Família pediu outro horário" /></Field>
      </div>
    </Modal>
  );
}

function CancelDialog({ row, onClose }: { row: AgendaRow | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [prev, setPrev] = React.useState(row);
  if (row !== prev) { setPrev(row); setReason(""); }
  return (
    <Modal open={!!row} onOpenChange={(o) => !o && onClose()} size="sm" title="Cancelar atendimento" description="O registro não é apagado; fica no histórico com o motivo."
      footer={<><Button variant="secondary" onClick={onClose}>Voltar</Button><Button variant="danger" loading={saving} disabled={reason.trim().length < 3} onClick={async () => {
        if (!row) return;
        setSaving(true);
        const r = await cancelAppointment(row.id, reason);
        setSaving(false);
        if (!r.ok) return toast.error(r.error);
        toast.success("Atendimento cancelado");
        onClose();
        router.refresh();
      }}>Cancelar atendimento</Button></>}
    >
      <Field label="Motivo" htmlFor="cc-reason" required><Input id="cc-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
}
