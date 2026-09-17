"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Clock, Copy, Lightbulb, ListOrdered, Route, Send, ShieldCheck, UserRound } from "lucide-react";
import { reviewAlert } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Card, IconBubble, PageHeader } from "@/components/ui/primitives";
import { Field, Select, Textarea } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Celebrate, EmptyState } from "@/components/ui/feedback";
import { ALERT_CODE_LABEL, SeverityBadge } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { fmtDateTime, fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/types/domain";

export type AlertItem = {
  id: string; code: string; alert_type: string; title: string | null; reason: string | null; action_recommended: string | null;
  severity: "atencao" | "critico"; status: "pendente" | "revisado"; created_at: string; reviewed_at: string | null; review_notes: string | null;
  related_table: string | null; related_id: string | null; service_id: string | null;
  patient: { id: string; full_name: string; social_name: string | null } | null; reviewer: { full_name: string } | null;
};

const META: Record<string, { icon: typeof Clock; tone: "rose" | "sun" | "peach" | "lilac" }> = {
  "AL-01": { icon: Copy, tone: "peach" },
  "AL-02": { icon: Route, tone: "rose" },
  "AL-03": { icon: Send, tone: "sun" },
  "AL-04": { icon: UserRound, tone: "rose" },
  "AL-05": { icon: Clock, tone: "lilac" },
  "AL-06": { icon: ListOrdered, tone: "sun" },
};

function resolveLink(a: AlertItem): { href: string; label: string } | null {
  switch (a.code) {
    case "AL-01": return { href: "/duplicidades", label: "Comparar cadastros" };
    case "AL-02": return a.patient ? { href: `/pacientes/${a.patient.id}?aba=plano`, label: "Definir serviço de referência" } : null;
    case "AL-03": return { href: "/encaminhamentos?situacao=pendentes", label: "Ver encaminhamento" };
    case "AL-04": return a.patient ? { href: `/pacientes/${a.patient.id}?aba=agenda`, label: "Ver faltas" } : null;
    case "AL-05": return a.patient ? { href: `/pacientes/${a.patient.id}?aba=plano`, label: "Revisar plano" } : null;
    case "AL-06": return { href: `/capacidade${a.service_id ? `?servico=${a.service_id}` : ""}`, label: "Ver capacidade" };
    default: return null;
  }
}

export function AlertsBoard({ items, counts, totalPending, filters, services }: {
  items: AlertItem[]; counts: Record<string, number>; totalPending: number; filters: { code: string; status: string; serviceId: string }; services: Service[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [reviewing, setReviewing] = React.useState<AlertItem | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [party, setParty] = React.useState<string | null>(null);
  const svc = Object.fromEntries(services.map((s) => [s.id, s]));

  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => p.set(k, v));
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        eyebrow="Cuidado fragmentado"
        title="Alertas"
        subtitle="Alertas apoiam a equipe, mas nunca substituem a decisão profissional. Cada revisão registra quem, quando e o que foi feito."
      />

      <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button onClick={() => go({ tipo: "todos" })} className={cn("flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-callout font-bold transition", filters.code === "todos" ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-line-strong")}>
          Todos <span className="tabular">{totalPending}</span>
        </button>
        {Object.entries(ALERT_CODE_LABEL).map(([code, label]) => {
          const m = META[code];
          const active = filters.code === code;
          return (
            <button key={code} onClick={() => go({ tipo: code })} aria-pressed={active} className={cn("flex shrink-0 items-center gap-2 rounded-full border-2 py-1.5 pr-4 pl-1.5 text-callout font-semibold transition", active ? "border-primary bg-primary-soft text-primary-ink" : "border-line bg-surface text-ink hover:border-line-strong")}>
              <IconBubble icon={m.icon} tone={m.tone} size="xs" className="rounded-full" />
              {label}
              <span className="rounded-full bg-surface-2 px-1.5 text-caption font-bold tabular">{counts[code] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <SegmentedControl label="Situação" value={filters.status === "revisado" ? "revisados" : "pendentes"} onChange={(v) => go({ situacao: v })} options={[{ value: "pendentes", label: "Pendentes" }, { value: "revisados", label: "Revisados" }]} />
        <Field label="Serviço" htmlFor="al-service" className="min-w-44">
          <Select id="al-service" value={filters.serviceId} onChange={(e) => go({ servico: e.target.value })}>
            <option value="todos">Todos</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </Card>

      {items.length === 0 ? (
        <Card><EmptyState celebrate={filters.status === "pendente"} title={filters.status === "pendente" ? "Caixa zerada!" : "Nenhum alerta revisado"} description={filters.status === "pendente" ? "Nenhum alerta pendente para este filtro." : undefined} /></Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {items.map((a) => {
              const m = META[a.code] ?? { icon: Clock, tone: "lilac" as const };
              const link = resolveLink(a);
              return (
                <motion.li key={a.id} layout exit={{ opacity: 0, scale: 0.96 }}>
                  <Card className={cn("flex h-full flex-col p-5", a.severity === "critico" && a.status === "pendente" && "ring-2 ring-rose/70")}>
                    <div className="flex items-start gap-3">
                      <IconBubble icon={m.icon} tone={m.tone} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={a.severity} size="sm" />
                          <span className="text-caption font-bold text-ink-muted">{a.code} · {ALERT_CODE_LABEL[a.code]}</span>
                        </div>
                        <h2 className="mt-1 text-headline font-bold text-ink-strong">{a.title}</h2>
                        {a.patient && <Link href={`/pacientes/${a.patient.id}`} className="text-callout font-semibold text-lilac-ink hover:underline">{a.patient.social_name ?? a.patient.full_name}</Link>}
                      </div>
                      <time className="text-caption text-ink-muted" dateTime={a.created_at} title={fmtDateTime(a.created_at)}>{fromNow(a.created_at)}</time>
                    </div>

                    <p className="mt-3 text-callout text-ink">{a.reason}</p>
                    {a.action_recommended && (
                      <p className="mt-3 flex gap-2 rounded-[14px] bg-sun-soft px-3 py-2.5 text-footnote text-ink">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-sun-ink" aria-hidden />
                        <span><b className="text-sun-ink">Ação recomendada:</b> {a.action_recommended}</span>
                      </p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                      {a.service_id && svc[a.service_id] && <ServiceChip name={svc[a.service_id].name} color={svc[a.service_id].color} size="sm" />}
                      {a.status === "revisado" ? (
                        <p className="w-full text-footnote text-mint-ink"><ShieldCheck className="mr-1 inline size-4" />Revisado por {a.reviewer?.full_name ?? "—"} {a.reviewed_at ? fromNow(a.reviewed_at) : ""}: <span className="text-ink">{a.review_notes}</span></p>
                      ) : (
                        <div className="ml-auto flex flex-wrap gap-2">
                          {link && <Button asChild size="sm" variant="secondary"><Link href={link.href}>{link.label} <ArrowRight /></Link></Button>}
                          <Button size="sm" variant="mint" onClick={() => { setNotes(""); setReviewing(a); }}><Check /> Marcar como revisado</Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Modal open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)} title="Revisar alerta" description={reviewing?.title ?? ""}
        footer={<><Button variant="secondary" onClick={() => setReviewing(null)}>Voltar</Button><Button variant="mint" loading={saving} disabled={notes.trim().length < 5} onClick={async () => {
          if (!reviewing) return;
          setSaving(true);
          const r = await reviewAlert(reviewing.id, notes);
          setSaving(false);
          if (!r.ok) return toast.error(r.error);
          setReviewing(null);
          setParty(items.length === 1 ? "Caixa zerada! 🎉" : "Alerta revisado!");
          router.refresh();
        }}>Registrar revisão</Button></>}
      >
        <Field label="O que foi feito?" htmlFor="rev-notes" required hint="Fica registrado com seu nome, data e hora.">
          <Textarea id="rev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Contato com a família; retorno agendado para a próxima semana." />
        </Field>
      </Modal>
      <Celebrate show={!!party} message={party ?? ""} onDone={() => setParty(null)} />
    </>
  );
}
