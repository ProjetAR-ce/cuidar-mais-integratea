"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, CheckCircle2, ChevronDown, HelpCircle, MoreHorizontal, ShieldAlert, XCircle } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { updateQueuePriority, updateQueueStatus } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, ProgressBar } from "@/components/ui/primitives";
import { ChoiceCards, Field, Select, Textarea } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/feedback";
import { PRIORITY_META, PriorityBadge, QueueStatusBadge } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { ScheduleDialog, type ScheduleDefaults } from "@/components/care/schedule-dialog";
import { age, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Offer, StaffMember } from "@/lib/data/reference";
import type { Priority, QueueStatus, Service, Specialty } from "@/types/domain";

export type QueueItem = {
  id: string; patient_id: string; patient_name: string; patient_birth_date: string; service_id: string; service_name: string; service_color: string | null;
  specialty_id: string | null; specialty_name: string; priority: Priority; status: QueueStatus; origin: string; entered_at: string; started_at: string | null;
  finished_at: string | null; wait_days: number; score: number; queue_position: number | null; rank_reason: string; priority_justification: string | null; cancel_reason: string | null; priority_points: number;
};

const ORIGIN: Record<string, string> = { triagem: "Triagem", encaminhamento: "Encaminhamento", retorno: "Retorno", demanda_espontanea: "Demanda espontânea" };

export function QueueBoard({ items, counts, filters, offer, canManage, canSchedule, services, specialties, offers, staff }: {
  items: QueueItem[]; counts: { aguardando: number; em_atendimento: number; encerrados: number };
  filters: { serviceId: string; specialtyId: string; status: string }; offer: Offer | null;
  canManage: boolean; canSchedule: boolean; services: Service[]; specialties: Specialty[]; offers: Offer[]; staff: StaffMember[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [scheduleFor, setScheduleFor] = React.useState<ScheduleDefaults | null>(null);
  const [priorityFor, setPriorityFor] = React.useState<QueueItem | null>(null);
  const [cancelFor, setCancelFor] = React.useState<QueueItem | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    p.set(k, v);
    if (k === "servico") p.set("especialidade", "todas");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const specialtyOptions = filters.serviceId === "todos"
    ? specialties
    : specialties.filter((s) => offers.some((o) => o.service_id === filters.serviceId && o.specialty_id === s.id));

  const maxWait = Math.max(30, ...items.map((i) => i.wait_days));
  const p1 = items.filter((i) => i.priority === "P1").length;
  const medianWait = (() => {
    const w = items.map((i) => i.wait_days).sort((a, b) => a - b);
    return w.length ? w[Math.floor(w.length / 2)] : 0;
  })();


  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Serviço" htmlFor="f-service" className="min-w-44 flex-1">
          <Select id="f-service" value={filters.serviceId} onChange={(e) => setParam("servico", e.target.value)}>
            <option value="todos">Todos os serviços</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Especialidade" htmlFor="f-specialty" className="min-w-44 flex-1">
          <Select id="f-specialty" value={filters.specialtyId} onChange={(e) => setParam("especialidade", e.target.value)}>
            <option value="todas">Todas</option>
            {specialtyOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <SegmentedControl
          label="Situação"
          value={filters.status}
          onChange={(v) => setParam("situacao", v)}
          options={[
            { value: "aguardando", label: "Aguardando", count: counts.aguardando },
            { value: "em_atendimento", label: "Em acompanhamento", count: counts.em_atendimento },
            { value: "encerrados", label: "Encerrados", count: counts.encerrados },
          ]}
        />
      </Card>

      {filters.status === "aguardando" && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Aguardando" value={items.length} tone="sun" />
          <Metric label="Prioridade P1" value={p1} tone="rose" />
          <Metric label="Espera mediana" value={`${medianWait} dias`} tone="lilac" />
          {offer ? (
            <div className="card p-4">
              <p className="text-footnote font-semibold text-ink-muted">Vagas por mês</p>
              <p className="text-title-1 font-extrabold tabular">{offer.monthly_capacity}</p>
              <ProgressBar value={items.length} max={Math.max(offer.monthly_capacity, 1)} tone={items.length > offer.monthly_capacity ? "rose" : "mint"} className="mt-1 h-2.5" label="Demanda frente à capacidade" />
              {items.length > offer.monthly_capacity && <p className="mt-1 flex items-center gap-1 text-caption font-bold text-rose-ink"><ShieldAlert className="size-3.5" /> Fila acima da capacidade</p>}
            </div>
          ) : <Metric label="Espera máxima" value={`${Math.max(0, ...items.map((i) => i.wait_days))} dias`} tone="peach" />}
        </div>
      )}

      {items.length === 0 ? (
        <Card><EmptyState celebrate={filters.status === "aguardando"} title={filters.status === "aguardando" ? "Ninguém aguardando aqui" : "Nada por aqui"} description="Ajuste os filtros para ver outras filas." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {items.map((i, idx) => {
              const groupOf = (x: QueueItem) => `${x.service_name} · ${x.specialty_name}`;
              const showGroup = (filters.serviceId === "todos" || filters.specialtyId === "todas") && (idx === 0 || groupOf(items[idx - 1]) !== groupOf(i));
              const open = expanded === i.id;
              return (
                <React.Fragment key={i.id}>
                  {showGroup && (
                    <li className="flex items-center gap-2 border-t border-line bg-surface-2/70 px-5 py-2 first:border-t-0">
                      <ServiceChip name={i.service_name} color={i.service_color} size="sm" />
                      <span className="text-footnote font-bold text-ink-strong">{i.specialty_name}</span>
                    </li>
                  )}
                  <li className="border-t border-line first:border-t-0">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                      {i.status === "aguardando" ? (
                        <span className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-[16px] font-extrabold tabular", i.queue_position === 1 ? "bg-sun text-ink-strong shadow-[0_3px_0_var(--color-sun-edge)]" : "bg-surface-2 text-ink-strong")} aria-label={`Posição ${i.queue_position}`}>
                          <span className="text-title-2 leading-none">{i.queue_position}</span>
                          <span className="text-[0.625rem] leading-none font-bold text-ink-muted">º</span>
                        </span>
                      ) : <Avatar name={i.patient_name} />}

                      <div className="min-w-0 flex-1 basis-48">
                        <Link href={`/pacientes/${i.patient_id}`} className="block truncate text-headline font-bold text-ink-strong hover:underline">{i.patient_name}</Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-footnote text-ink-muted">
                          <PriorityBadge priority={i.priority} short size="sm" />
                          <span>{age(i.patient_birth_date)}</span>
                          <span aria-hidden>·</span>
                          <span>{ORIGIN[i.origin] ?? i.origin}</span>
                          {filters.serviceId !== "todos" && filters.specialtyId === "todas" ? null : filters.serviceId === "todos" ? null : <><span aria-hidden>·</span><span>{i.specialty_name}</span></>}
                        </div>
                      </div>

                      {i.status === "aguardando" ? (
                        <div className="w-full sm:w-44">
                          <div className="flex justify-between text-caption font-semibold text-ink-muted">
                            <span>Espera</span><span className="text-ink-strong tabular">{i.wait_days} dias</span>
                          </div>
                          <ProgressBar value={i.wait_days} max={maxWait} tone={i.wait_days > 60 ? "rose" : i.wait_days > 30 ? "peach" : "mint"} className="mt-1 h-2.5" label="Tempo de espera" />
                        </div>
                      ) : (
                        <div className="text-footnote text-ink-muted sm:w-44">
                          <QueueStatusBadge status={i.status} size="sm" />
                          <p className="mt-0.5">{i.status === "em_atendimento" ? `desde ${fmtDate(i.started_at ?? i.entered_at)}` : i.finished_at ? `em ${fmtDate(i.finished_at)}` : ""}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        {i.status === "aguardando" && canSchedule && (
                          <Button size="sm" variant="mint" onClick={() => setScheduleFor({
                            patient: { id: i.patient_id, full_name: i.patient_name, birth_date: i.patient_birth_date },
                            service_id: i.service_id, specialty_id: i.specialty_id, queue_entry_id: i.id,
                          })}>
                            <CalendarPlus /> <span className="hidden md:inline">Agendar</span>
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" aria-expanded={open} aria-label="Por que esta posição?" onClick={() => setExpanded(open ? null : i.id)}>
                          {open ? <ChevronDown className="rotate-180" /> : <HelpCircle />}
                        </Button>
                        {canManage && (i.status === "aguardando" || i.status === "em_atendimento") && (
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label={`Mais ações para ${i.patient_name}`}><MoreHorizontal /></Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-56 rounded-[18px] border border-line bg-surface p-1.5 shadow-float">
                                <MenuItem onSelect={() => setPriorityFor(i)}>Alterar prioridade</MenuItem>
                                {i.status === "em_atendimento" && (
                                  <MenuItem onSelect={async () => {
                                    const r = await updateQueueStatus(i.id, "concluido");
                                    if (!r.ok) return toast.error(r.error);
                                    toast.success("Acompanhamento concluído");
                                    router.refresh();
                                  }}><CheckCircle2 className="size-4" /> Concluir acompanhamento</MenuItem>
                                )}
                                <MenuItem danger onSelect={() => setCancelFor(i)}><XCircle className="size-4" /> Cancelar entrada</MenuItem>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        )}
                      </div>
                    </div>
                    {open && (
                      <div className="mx-4 mb-4 rounded-[16px] bg-lilac-soft p-4 text-callout sm:mx-5">
                        <p className="font-bold text-lilac-ink">Por que esta posição?</p>
                        <p className="mt-1 text-ink-strong">{i.rank_reason}.</p>
                        <p className="mt-2 text-footnote text-ink">Entrou na fila em {fmtDate(i.entered_at)} por {ORIGIN[i.origin]?.toLowerCase() ?? i.origin}.</p>
                        {i.priority_justification && <p className="mt-1 text-footnote text-ink"><b>Justificativa da prioridade:</b> {i.priority_justification}</p>}
                        {i.cancel_reason && <p className="mt-1 text-footnote text-ink"><b>Motivo do cancelamento:</b> {i.cancel_reason}</p>}
                      </div>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </Card>
      )}

      <ScheduleDialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)} defaults={scheduleFor ?? undefined} services={services} specialties={specialties} offers={offers} staff={staff} />
      <PriorityDialog item={priorityFor} onClose={() => setPriorityFor(null)} />
      <CancelDialog item={cancelFor} onClose={() => setCancelFor(null)} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone: "sun" | "rose" | "lilac" | "peach" }) {
  const bar = { sun: "bg-sun", rose: "bg-rose", lilac: "bg-lilac", peach: "bg-peach" }[tone];
  return (
    <div className="card relative overflow-hidden p-4">
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-1.5 rounded-r-full", bar)} />
      <p className="text-footnote font-semibold text-ink-muted">{label}</p>
      <p className="text-title-1 font-extrabold text-ink-strong tabular">{value}</p>
    </div>
  );
}

function MenuItem({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className={cn("flex h-10 cursor-pointer items-center gap-2 rounded-[12px] px-3 text-callout font-semibold outline-none", danger ? "text-rose-ink data-[highlighted]:bg-rose-soft" : "text-ink data-[highlighted]:bg-surface-2")}>
      {children}
    </DropdownMenu.Item>
  );
}

function PriorityDialog({ item, onClose }: { item: QueueItem | null; onClose: () => void }) {
  const router = useRouter();
  const [p, setP] = React.useState<Priority | null>(null);
  const [just, setJust] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [prev, setPrev] = React.useState<QueueItem | null>(null);
  if (item !== prev) {
    setPrev(item);
    if (item) { setP(item.priority); setJust(""); }
  }
  return (
    <Modal open={!!item} onOpenChange={(o) => !o && onClose()} title="Alterar prioridade" description={item ? `${item.patient_name} · ${item.specialty_name}` : ""}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={!p || just.trim().length < 10} onClick={async () => {
        if (!item || !p) return;
        setSaving(true);
        const r = await updateQueuePriority(item.id, p, just);
        setSaving(false);
        if (!r.ok) return toast.error(r.error);
        toast.success("Prioridade alterada", { description: "A alteração foi registrada com justificativa e versão anterior." });
        onClose();
        router.refresh();
      }}>Salvar</Button></>}
    >
      <div className="space-y-4">
        <ChoiceCards name="new-priority" value={p} onChange={setP} options={(["P1", "P2", "P3"] as const).map((x) => ({ value: x, label: PRIORITY_META[x].label }))} />
        <Field label="Justificativa" htmlFor="new-just" required hint="Mínimo de 10 caracteres.">
          <Textarea id="new-just" value={just} onChange={(e) => setJust(e.target.value)} />
        </Field>
        <Badge tone="lilac" size="sm">A posição na fila é recalculada automaticamente</Badge>
      </div>
    </Modal>
  );
}

function CancelDialog({ item, onClose }: { item: QueueItem | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [prev, setPrev] = React.useState(item);
  if (item !== prev) { setPrev(item); setReason(""); }
  return (
    <Modal open={!!item} onOpenChange={(o) => !o && onClose()} size="sm" title="Cancelar entrada na fila" description="O histórico é preservado. Informe o motivo."
      footer={<><Button variant="secondary" onClick={onClose}>Voltar</Button><Button variant="danger" loading={saving} disabled={reason.trim().length < 5} onClick={async () => {
        if (!item) return;
        setSaving(true);
        const r = await updateQueueStatus(item.id, "cancelado", reason);
        setSaving(false);
        if (!r.ok) return toast.error(r.error);
        toast.success("Entrada cancelada");
        onClose();
        router.refresh();
      }}>Cancelar entrada</Button></>}
    >
      <Field label="Motivo" htmlFor="cancel-reason" required>
        <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Família mudou de município" />
      </Field>
    </Modal>
  );
}
