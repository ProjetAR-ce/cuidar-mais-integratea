"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, Clock, FileQuestion, Inbox, Send, Undo2 } from "lucide-react";
import { respondReferral, resubmitReferral } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Avatar, Card, PageHeader } from "@/components/ui/primitives";
import { Field, Select, Textarea } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Celebrate, EmptyState } from "@/components/ui/feedback";
import { PriorityBadge, ReferralStatusBadge } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { ReferralDialog } from "@/components/care/referral-dialog";
import { age, daysSince, fmtDate, fmtDateTime, nowMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Offer } from "@/lib/data/reference";
import type { Priority, ReferralStatus, Role, Service, Specialty } from "@/types/domain";

export type ReferralItem = {
  id: string; patient_id: string; origin_service_id: string; destination_service_id: string; specialty_id: string | null; priority: Priority; status: ReferralStatus;
  reason: string; response_notes: string | null; complement_notes: string | null; created_at: string; responded_at: string | null; due_at: string | null;
  patient: { full_name: string; social_name: string | null; birth_date: string }; author: { full_name: string; job_title: string | null } | null; responder: { full_name: string } | null;
};

type Action = { item: ReferralItem; kind: "aceito" | "devolvido" | "complemento_solicitado" | "reenviar" };

export function ReferralsBoard({ items, counts, filters, role, userServiceId, services, specialties, offers }: {
  items: ReferralItem[]; counts: { pendentes: number; complemento: number; respondidos: number };
  filters: { direction: string; situation: string; serviceId: string }; role: Role; userServiceId: string | null;
  services: Service[]; specialties: Specialty[]; offers: Offer[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [action, setAction] = React.useState<Action | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const svc = Object.fromEntries(services.map((s) => [s.id, s]));
  const spc = Object.fromEntries(specialties.map((s) => [s.id, s]));

  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => p.set(k, v));
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const received = filters.direction === "recebidos";
  const canActOn = (r: ReferralItem, side: "dest" | "origin") =>
    role !== "profissional" || (side === "dest" ? r.destination_service_id === userServiceId : r.origin_service_id === userServiceId);

  return (
    <>
      <PageHeader
        eyebrow="Integração entre serviços"
        title="Encaminhamentos"
        subtitle="Todo encaminhamento precisa de resposta: aceite, devolução ou pedido de complemento."
        actions={<Button variant="lilac" onClick={() => setNewOpen(true)}><Send /> Novo encaminhamento</Button>}
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <SegmentedControl label="Direção" value={filters.direction} onChange={(v) => go({ direcao: v })} options={[
          { value: "recebidos", label: <span className="flex items-center gap-1.5"><Inbox className="size-4" /> Recebidos</span> },
          { value: "enviados", label: <span className="flex items-center gap-1.5"><Send className="size-4" /> Enviados</span> },
        ]} />
        <Field label="Serviço" htmlFor="rf-service" className="min-w-40">
          <Select id="rf-service" value={filters.serviceId} onChange={(e) => go({ servico: e.target.value })} disabled={role === "profissional"}>
            <option value="todos">Todos</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <SegmentedControl className="ml-auto" label="Situação" value={filters.situation} onChange={(v) => go({ situacao: v })} options={[
          { value: "pendentes", label: "Aguardando resposta", count: counts.pendentes },
          { value: "complemento", label: "Complemento", count: counts.complemento },
          { value: "respondidos", label: "Respondidos", count: counts.respondidos },
        ]} />
      </Card>

      {items.length === 0 ? (
        <Card><EmptyState celebrate={filters.situation !== "respondidos"} title={filters.situation === "respondidos" ? "Nenhum encaminhamento respondido" : "Caixa em dia!"} description={filters.situation === "respondidos" ? undefined : "Nenhum encaminhamento esperando ação."} /></Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((r) => {
            const due = r.due_at ? Math.ceil((new Date(r.due_at).getTime() - nowMs()) / 86_400_000) : null;
            const overdue = r.status === "pendente" && due !== null && due < 0;
            return (
              <li key={r.id}>
                <Card className={cn("flex h-full flex-col p-5", overdue && "ring-2 ring-rose-edge/60")}>
                  <div className="flex items-start gap-3">
                    <Avatar name={r.patient.full_name} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/pacientes/${r.patient_id}?aba=encaminhamentos`} className="block truncate text-headline font-bold text-ink-strong hover:underline">{r.patient.social_name ?? r.patient.full_name}</Link>
                      <p className="text-footnote text-ink-muted">{age(r.patient.birth_date)} · enviado em {fmtDate(r.created_at)}{r.author ? ` por ${r.author.full_name}` : ""}</p>
                    </div>
                    <ReferralStatusBadge status={r.status} size="sm" />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[16px] bg-surface-2/70 p-3">
                    <ServiceChip name={svc[r.origin_service_id]?.name} color={svc[r.origin_service_id]?.color} />
                    <ArrowRight className="size-4 text-ink-muted" aria-label="para" />
                    <ServiceChip name={svc[r.destination_service_id]?.name} color={svc[r.destination_service_id]?.color} />
                    {r.specialty_id && <span className="text-callout font-bold text-ink-strong">{spc[r.specialty_id]?.name}</span>}
                    <span className="ml-auto"><PriorityBadge priority={r.priority} short size="sm" /></span>
                  </div>

                  <p className="mt-3 flex-1 text-callout text-ink">{r.reason}</p>
                  {r.complement_notes && <p className="mt-2 rounded-[12px] bg-peach-soft px-3 py-2 text-footnote text-ink"><b>Complemento enviado:</b> {r.complement_notes}</p>}
                  {r.response_notes && <p className="mt-2 rounded-[12px] bg-lilac-soft px-3 py-2 text-footnote text-ink"><b>Resposta{r.responder ? ` de ${r.responder.full_name}` : ""}:</b> {r.response_notes}</p>}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {r.status === "pendente" && due !== null && (
                      <span className={cn("inline-flex items-center gap-1 text-footnote font-bold", overdue ? "text-rose-ink" : due <= 2 ? "text-sun-ink" : "text-ink-muted")}>
                        <Clock className="size-4" />
                        {overdue ? `Atrasado há ${Math.abs(due)} ${Math.abs(due) === 1 ? "dia" : "dias"}` : `Responder em ${due} ${due === 1 ? "dia" : "dias"}`}
                      </span>
                    )}
                    {r.responded_at && <span className="text-footnote text-ink-muted">Respondido em {fmtDateTime(r.responded_at)} · {daysSince(r.created_at) - daysSince(r.responded_at)} dias até a resposta</span>}
                    <div className="ml-auto flex flex-wrap gap-2">
                      {received && r.status === "pendente" && canActOn(r, "dest") && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setAction({ item: r, kind: "complemento_solicitado" })}><FileQuestion /> Complemento</Button>
                          <Button size="sm" variant="danger" onClick={() => setAction({ item: r, kind: "devolvido" })}><Undo2 /> Devolver</Button>
                          <Button size="sm" variant="mint" onClick={() => setAction({ item: r, kind: "aceito" })}><Check /> Aceitar</Button>
                        </>
                      )}
                      {r.status === "complemento_solicitado" && canActOn(r, "origin") && (
                        <Button size="sm" variant="peach" onClick={() => setAction({ item: r, kind: "reenviar" })}><Send /> Enviar complemento</Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <RespondDialog action={action} onClose={() => setAction(null)} specialtyName={action?.item.specialty_id ? spc[action.item.specialty_id]?.name : undefined} />
      <ReferralDialog open={newOpen} onOpenChange={setNewOpen} services={services} specialties={specialties} offers={offers} originServiceId={userServiceId} lockOrigin={role === "profissional"} />
    </>
  );
}

function RespondDialog({ action, onClose, specialtyName }: { action: Action | null; onClose: () => void; specialtyName?: string }) {
  const router = useRouter();
  const [notes, setNotes] = React.useState("");
  const [addToQueue, setAddToQueue] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [party, setParty] = React.useState<string | null>(null);
  const [prev, setPrev] = React.useState(action);
  if (action !== prev) { setPrev(action); setNotes(""); setAddToQueue(true); }

  const meta = {
    aceito: { title: "Aceitar encaminhamento", button: "Aceitar", variant: "mint" as const, label: "Observação (opcional)", required: false },
    devolvido: { title: "Devolver encaminhamento", button: "Devolver", variant: "danger" as const, label: "Motivo da devolução", required: true },
    complemento_solicitado: { title: "Pedir complemento", button: "Pedir complemento", variant: "peach" as const, label: "O que falta?", required: true },
    reenviar: { title: "Enviar complemento", button: "Enviar", variant: "peach" as const, label: "Complemento", required: true },
  };
  const m = action ? meta[action.kind] : meta.aceito;

  return (
    <>
      <Modal open={!!action} onOpenChange={(o) => !o && onClose()} title={m.title} description={action ? action.item.patient.full_name : ""}
        footer={<><Button variant="secondary" onClick={onClose}>Voltar</Button><Button variant={m.variant} loading={saving} disabled={m.required && notes.trim().length < (action?.kind === "reenviar" ? 10 : 5)} onClick={async () => {
          if (!action) return;
          setSaving(true);
          const r = action.kind === "reenviar"
            ? await resubmitReferral(action.item.id, notes)
            : await respondReferral(action.item.id, action.kind, notes, addToQueue);
          setSaving(false);
          if (!r.ok) return toast.error(r.error);
          onClose();
          if (action.kind === "aceito") setParty("Encaminhamento aceito!");
          else toast.success(action.kind === "devolvido" ? "Encaminhamento devolvido" : action.kind === "reenviar" ? "Complemento enviado" : "Complemento solicitado");
          router.refresh();
        }}>{m.button}</Button></>}
      >
        <div className="space-y-4">
          <Field label={m.label} htmlFor="resp-notes" required={m.required}>
            <Textarea id="resp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {action?.kind === "aceito" && specialtyName && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-mint-soft p-4">
              <input type="checkbox" checked={addToQueue} onChange={(e) => setAddToQueue(e.target.checked)} className="size-5 accent-[var(--color-ink)]" />
              <span className="font-semibold text-ink-strong">Colocar na fila de {specialtyName} com a mesma prioridade</span>
            </label>
          )}
        </div>
      </Modal>
      <Celebrate show={!!party} message={party ?? ""} onDone={() => setParty(null)} />
    </>
  );
}
