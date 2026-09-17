"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePen, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { recordSession } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Celebrate } from "@/components/ui/feedback";
import { fmtDateTime } from "@/lib/format";
import type { AppointmentStatus } from "@/types/domain";

export function SessionForm({ id, status, initial, hasRecord, canEdit, updatedAt }: {
  id: string; status: AppointmentStatus; initial: { objective: string; summary: string; evolution: string }; hasRecord: boolean; canEdit: boolean; updatedAt: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(!hasRecord && canEdit);
  const [f, setF] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [party, setParty] = React.useState(false);
  const blocked = status !== "agendado" && status !== "presente";

  if (!editing) {
    return (
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-title-2">Registro do atendimento</h2>
          {canEdit && !blocked && <Button variant="secondary" onClick={() => setEditing(true)}><FilePen /> Corrigir registro</Button>}
        </div>
        {hasRecord ? (
          <dl className="space-y-4">
            <div><dt className="text-caption font-bold tracking-wide text-ink-muted uppercase">Objetivo</dt><dd className="mt-1 text-body">{initial.objective || "—"}</dd></div>
            <div><dt className="text-caption font-bold tracking-wide text-ink-muted uppercase">Síntese</dt><dd className="mt-1 text-body whitespace-pre-line">{initial.summary}</dd></div>
            <div><dt className="text-caption font-bold tracking-wide text-ink-muted uppercase">Evolução</dt><dd className="mt-1 text-body whitespace-pre-line">{initial.evolution || "—"}</dd></div>
            <p className="text-caption text-ink-muted">Última alteração em {fmtDateTime(updatedAt)}</p>
          </dl>
        ) : (
          <p className="flex items-center gap-2 text-callout text-ink-muted"><Lock className="size-4" />{blocked ? "Não é possível registrar um atendimento cancelado ou com falta." : "Somente o profissional responsável pode registrar este atendimento."}</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const r = await recordSession(id, f.objective, f.summary, f.evolution);
          setSaving(false);
          if (!r.ok) return toast.error(r.error);
          setEditing(false);
          setParty(true);
          toast.success(hasRecord ? `Correção salva como versão ${r.data}` : "Atendimento registrado", { description: "O registro aparece na linha do tempo do paciente." });
          router.refresh();
        }}
      >
        <div>
          <h2 className="text-title-2">{hasRecord ? "Corrigir registro" : "Registrar atendimento"}</h2>
          <p className="text-footnote text-ink-muted">{hasRecord ? "A versão atual é preservada no histórico." : "Salvar também marca a presença do paciente."} Não use o sistema para diagnóstico ou prescrição.</p>
        </div>
        <Field label="Objetivo da sessão" htmlFor="obj">
          <Input id="obj" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} placeholder="Ex.: Ampliar trocas comunicativas" />
        </Field>
        <Field label="Síntese" htmlFor="sum" required hint="O que foi feito e como a pessoa participou.">
          <Textarea id="sum" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} className="min-h-36" />
        </Field>
        <Field label="Evolução e combinados" htmlFor="evo">
          <Textarea id="evo" value={f.evolution} onChange={(e) => setF({ ...f, evolution: e.target.value })} className="min-h-24" />
        </Field>
        <div className="flex justify-end gap-2">
          {hasRecord && <Button type="button" variant="secondary" onClick={() => { setF(initial); setEditing(false); }}>Cancelar</Button>}
          <Button type="submit" variant="mint" size="lg" loading={saving} disabled={f.summary.trim().length < 10}><Save /> Salvar</Button>
        </div>
      </form>
      <Celebrate show={party} message="Registro salvo!" onDone={() => setParty(false)} />
    </Card>
  );
}
