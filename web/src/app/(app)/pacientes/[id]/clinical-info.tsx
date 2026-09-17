"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { saveClinicalInfo } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/ui/form";
import { fmtDateTime } from "@/lib/format";

/** H.D. e medicação ficam separadas da identificação (LGPD: minimização e acesso por necessidade) */
export function ClinicalInfoCard({ patientId, hypothesis, medications, updatedAt }: { patientId: string; hypothesis: string; medications: string; updatedAt: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [hd, setHd] = React.useState(hypothesis);
  const [med, setMed] = React.useState(medications);
  const [saving, setSaving] = React.useState(false);

  return (
    <Card>
      <CardHeader title="Informação clínica" icon={Stethoscope} tone="lilac" subtitle={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" /> Visível só para a equipe clínica · alterações geram versão</span>}
        action={!editing ? <Button size="sm" variant="secondary" onClick={() => { setHd(hypothesis); setMed(medications); setEditing(true); }}>Editar</Button> : undefined} />
      {editing ? (
        <form className="grid gap-3 px-5 pb-5" onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const r = await saveClinicalInfo(patientId, hd, med);
          setSaving(false);
          if (!r.ok) return toast.error(r.error);
          toast.success("Informação clínica salva");
          setEditing(false);
          router.refresh();
        }}>
          <Field label="Hipótese diagnóstica (H.D.)" htmlFor="ci-hd"><Input id="ci-hd" value={hd} onChange={(e) => setHd(e.target.value)} /></Field>
          <Field label="Medicação em uso" htmlFor="ci-med"><Textarea id="ci-med" value={med} onChange={(e) => setMed(e.target.value)} className="min-h-20" /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button type="submit" variant="mint" loading={saving}>Salvar</Button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          <div><dt className="text-caption font-semibold tracking-wide text-ink-muted uppercase">Hipótese diagnóstica</dt><dd className="text-callout font-semibold text-ink-strong">{hypothesis || "Não registrada"}</dd></div>
          <div><dt className="text-caption font-semibold tracking-wide text-ink-muted uppercase">Medicação em uso</dt><dd className="text-callout font-semibold text-ink-strong">{medications || "Não registrada"}</dd></div>
          {updatedAt && <p className="text-caption text-ink-muted sm:col-span-2">Atualizado em {fmtDateTime(updatedAt)}</p>}
        </dl>
      )}
    </Card>
  );
}
