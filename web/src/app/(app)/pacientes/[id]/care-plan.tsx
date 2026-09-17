"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, CircleDashed, Flag, Loader2, Plus, Timer } from "lucide-react";
import { toast } from "sonner";
import { addCarePlanItem, closeCarePlan, createCarePlan, updateCarePlanItem } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Card, IconBubble, ProgressRing } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Celebrate, EmptyState } from "@/components/ui/feedback";
import { ServiceChip } from "@/components/care/service-chip";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/lib/data/reference";
import type { Service } from "@/types/domain";
import type { PlanRow } from "./page";

export function CarePlanPanel({ patientId, plan, history, services, staff, defaultServiceId }: {
  patientId: string; plan: PlanRow | null; history: PlanRow[]; services: Service[]; staff: StaffMember[]; defaultServiceId?: string;
}) {
  const router = useRouter();
  const svc = Object.fromEntries(services.map((s) => [s.id, s]));
  const [party, setParty] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Novo plano
  const [goal, setGoal] = React.useState("");
  const [refService, setRefService] = React.useState(defaultServiceId ?? "");
  const [review, setReview] = React.useState("");
  // Novo passo
  const [desc, setDesc] = React.useState("");
  const [stepService, setStepService] = React.useState(defaultServiceId ?? "");
  const [responsible, setResponsible] = React.useState("");
  const [due, setDue] = React.useState("");

  if (!plan) {
    return (
      <Card className="mx-auto max-w-2xl p-6">
        <EmptyState title="Sem plano de cuidado ativo" description="O plano compartilhado mostra o serviço de referência, os próximos passos, os responsáveis e os prazos." />
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("plan");
            const r = await createCarePlan(patientId, refService, goal, review || null);
            setBusy(null);
            if (!r.ok) return toast.error(r.error);
            setParty("Plano criado!");
            router.refresh();
          }}
        >
          <Field label="Objetivo do plano" htmlFor="goal" required>
            <Textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex.: Ampliar a comunicação funcional em casa e na escola" className="min-h-20" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serviço de referência" htmlFor="ref-service" required>
              <Select id="ref-service" value={refService} onChange={(e) => setRefService(e.target.value)}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Revisar até" htmlFor="review">
              <Input id="review" type="date" value={review} onChange={(e) => setReview(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="peach" size="lg" loading={busy === "plan"}><Flag /> Criar plano compartilhado</Button>
        </form>
        <Celebrate show={!!party} message={party ?? ""} onDone={() => setParty(null)} />
      </Card>
    );
  }

  const done = plan.items.filter((i) => i.status === "concluido").length;
  const nextStatus = { pendente: "em_andamento", em_andamento: "concluido", concluido: "pendente" } as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden">
        <div className="relative flex flex-wrap items-center gap-5 bg-peach-soft/70 p-6">
          <ProgressRing value={done} max={Math.max(plan.items.length, 1)} tone="mint" size={84} stroke={11} label={`${done} de ${plan.items.length} passos concluídos`}>
            <span className="text-title-2 font-extrabold tabular">{done}/{plan.items.length}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-caption font-bold tracking-wide text-peach-ink uppercase">Objetivo</p>
            <h2 className="text-title-2">{plan.goal}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-footnote text-ink-muted">
              <span>Referência:</span>
              <ServiceChip name={svc[plan.reference_service_id]?.name ?? "—"} color={svc[plan.reference_service_id]?.color} size="sm" />
              {plan.coordinator && <span>· coordenado por {plan.coordinator.full_name}</span>}
              {plan.review_due_at && <span>· revisar até {fmtDate(plan.review_due_at)}</span>}
            </div>
          </div>
        </div>

        <ol className="divide-y divide-line">
          {plan.items.length === 0 && <li className="p-6 text-center text-ink-muted">Adicione o primeiro próximo passo.</li>}
          {plan.items.map((i) => {
            const late = i.status !== "concluido" && i.due_date && new Date(i.due_date + "T23:59:59") < new Date();
            return (
              <li key={i.id} className="flex items-center gap-4 px-5 py-4">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={async () => {
                    setBusy(i.id);
                    const status = nextStatus[i.status];
                    const r = await updateCarePlanItem(i.id, patientId, status);
                    setBusy(null);
                    if (!r.ok) return toast.error(r.error);
                    if (status === "concluido") setParty("Passo concluído!");
                    router.refresh();
                  }}
                  aria-label={`Situação: ${i.status.replace("_", " ")}. Clique para avançar.`}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition",
                    i.status === "concluido" ? "border-mint-edge bg-mint text-ink-strong shadow-[0_3px_0_var(--color-mint-edge)]" : i.status === "em_andamento" ? "border-sun-edge bg-sun-soft text-sun-ink" : "border-line-strong bg-surface text-ink-faint"
                  )}
                >
                  {busy === i.id ? <Loader2 className="size-5 animate-spin" /> : i.status === "concluido" ? <Check className="size-6" strokeWidth={3} /> : i.status === "em_andamento" ? <Timer className="size-5" /> : <CircleDashed className="size-5" />}
                </motion.button>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold text-ink-strong", i.status === "concluido" && "text-ink-muted line-through")}>{i.description}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                    {i.service_id && <ServiceChip name={svc[i.service_id]?.name ?? ""} color={svc[i.service_id]?.color} size="sm" />}
                    {i.responsible && <span>Responsável: <b className="text-ink">{i.responsible.full_name}</b></span>}
                    {i.due_date && <span className={cn(late && "font-bold text-rose-ink")}>{late ? "Atrasado · " : "Prazo: "}{fmtDate(i.due_date)}</span>}
                    {i.completed_at && <span>concluído em {fmtDate(i.completed_at)}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-line p-4 text-right">
          <Button
            variant="ghost" size="sm"
            onClick={async () => {
              const r = await closeCarePlan(plan.id, patientId);
              if (!r.ok) return toast.error(r.error);
              toast.success("Plano encerrado");
              router.refresh();
            }}
          >
            Encerrar plano
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <IconBubble icon={Plus} tone="mint" size="sm" />
            <h3 className="text-headline font-bold">Próximo passo</h3>
          </div>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("item");
              const r = await addCarePlanItem(plan.id, patientId, { description: desc, service_id: stepService || null, responsible_id: responsible || null, due_date: due || null });
              setBusy(null);
              if (!r.ok) return toast.error(r.error);
              setDesc(""); setDue(""); setResponsible("");
              toast.success("Passo adicionado ao plano");
              router.refresh();
            }}
          >
            <Field label="O que precisa ser feito" htmlFor="step-desc" required>
              <Input id="step-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Reunião com a escola" />
            </Field>
            <Field label="Serviço" htmlFor="step-svc">
              <Select id="step-svc" value={stepService} onChange={(e) => { setStepService(e.target.value); setResponsible(""); }}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Responsável" htmlFor="step-resp">
              <Select id="step-resp" value={responsible} onChange={(e) => setResponsible(e.target.value)}>
                <option value="">A definir</option>
                {staff.filter((p) => !stepService || p.service_id === stepService || p.role === "coordenacao").map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Prazo" htmlFor="step-due">
              <Input id="step-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Button type="submit" variant="mint" loading={busy === "item"} disabled={desc.trim().length < 5}>Adicionar passo</Button>
          </form>
        </Card>
        {history.length > 0 && (
          <Card className="p-5">
            <h3 className="text-headline font-bold">Planos anteriores</h3>
            <ul className="mt-2 space-y-2 text-footnote text-ink-muted">
              {history.map((h) => <li key={h.id}>{fmtDate(h.created_at)} · {h.goal}</li>)}
            </ul>
          </Card>
        )}
      </div>
      <Celebrate show={!!party} message={party ?? ""} onDone={() => setParty(null)} />
    </div>
  );
}
