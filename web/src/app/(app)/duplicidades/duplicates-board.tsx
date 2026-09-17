"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, GitMerge, X } from "lucide-react";
import { resolveDuplicate } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Badge, Card, ProgressRing } from "@/components/ui/primitives";
import { Field, Textarea } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Celebrate, EmptyState } from "@/components/ui/feedback";
import { age, fmtDate, fmtDateTime, maskCns, maskCpf } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DupPatient = {
  id: string; full_name: string; social_name: string | null; birth_date: string; mother_name: string; cns: string | null; cpf: string | null;
  guardian_name: string | null; guardian_phone: string | null; neighborhood: string | null; aps_reference: string | null; school_name: string | null;
  created_at: string; status: string; queues: number; appointments: number;
};
export type DupPair = {
  id: string; patient_id: string; candidate_id: string; score: number; reasons: string[]; status: string; created_at: string;
  reviewed_at: string | null; review_notes: string | null; kept_patient_id: string | null; reviewer: { full_name: string } | null; a: DupPatient; b: DupPatient;
};

const FIELDS: { key: keyof DupPatient; label: string; fmt?: (v: never) => string }[] = [
  { key: "full_name", label: "Nome" },
  { key: "birth_date", label: "Nascimento", fmt: (v: string) => `${fmtDate(v)} (${age(v)})` },
  { key: "mother_name", label: "Mãe" },
  { key: "cns", label: "CNS", fmt: (v: string | null) => maskCns(v) ?? "—" },
  { key: "cpf", label: "CPF", fmt: (v: string | null) => maskCpf(v) ?? "—" },
  { key: "guardian_phone", label: "Telefone" },
  { key: "neighborhood", label: "Bairro" },
  { key: "aps_reference", label: "APS" },
  { key: "school_name", label: "Escola" },
];

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function DuplicatesBoard({ pairs, status }: { pairs: DupPair[]; status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [decide, setDecide] = React.useState<{ pair: DupPair; decision: "confirmado" | "rejeitado"; keep?: string } | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [party, setParty] = React.useState<string | null>(null);

  return (
    <>
      <SegmentedControl className="mb-5" label="Situação" value={status} onChange={(v) => router.push(`${pathname}?situacao=${v}`)} options={[{ value: "pendentes", label: "Para revisar" }, { value: "revisadas", label: "Revisadas" }]} />

      {pairs.length === 0 ? (
        <Card><EmptyState celebrate={status === "pendentes"} title={status === "pendentes" ? "Nenhuma duplicidade para revisar" : "Nada revisado ainda"} /></Card>
      ) : (
        <ul className="space-y-6">
          {pairs.map((p) => (
            <li key={p.id}>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 border-b border-line bg-peach-soft/60 px-5 py-4">
                  <ProgressRing value={Number(p.score) * 100} tone="peach" size={56} stroke={8} label={`Semelhança ${Math.round(Number(p.score) * 100)}%`}>
                    <span className="text-footnote font-extrabold tabular">{Math.round(Number(p.score) * 100)}%</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline font-bold text-ink-strong">Semelhança encontrada</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">{p.reasons.map((r) => <Badge key={r} tone="peach" size="sm">{r}</Badge>)}</div>
                  </div>
                  <span className="text-footnote text-ink-muted">detectado em {fmtDateTime(p.created_at)}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left">
                    <caption className="sr-only">Comparação entre os dois cadastros</caption>
                    <thead>
                      <tr className="text-footnote text-ink-muted">
                        <th scope="col" className="w-32 px-5 py-3 font-semibold">Campo</th>
                        {[p.a, p.b].map((x, i) => (
                          <th key={x.id} scope="col" className="px-5 py-3">
                            <span className="text-caption font-bold tracking-wide uppercase">Cadastro {i === 0 ? "A" : "B"}{x.status === "mesclado" ? " · mesclado" : ""}</span>
                            <Link href={`/pacientes/${x.id}`} className="block font-bold text-ink-strong hover:underline" target="_blank">abrir ↗</Link>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FIELDS.map((f) => {
                        const va = p.a[f.key], vb = p.b[f.key];
                        const same = va && vb && norm(va) === norm(vb);
                        const show = (v: unknown) => (f.fmt ? (f.fmt as (x: unknown) => string)(v) : (v as string) || "—");
                        return (
                          <tr key={f.key} className="border-t border-line">
                            <th scope="row" className="px-5 py-2.5 text-footnote font-semibold text-ink-muted">{f.label}</th>
                            {[va, vb].map((v, i) => (
                              <td key={i} className={cn("px-5 py-2.5 text-callout font-semibold", same ? "text-mint-ink" : "text-ink-strong")}>
                                {same && <Check className="mr-1 inline size-4" aria-label="igual" />}{show(v)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      <tr className="border-t border-line bg-surface-2/60">
                        <th scope="row" className="px-5 py-2.5 text-footnote font-semibold text-ink-muted">Histórico</th>
                        {[p.a, p.b].map((x) => <td key={x.id} className="px-5 py-2.5 text-footnote text-ink">{x.queues} filas · {x.appointments} atendimentos · criado em {fmtDate(x.created_at)}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {p.status === "pendente" ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-4">
                    <Button variant="secondary" onClick={() => { setNotes(""); setDecide({ pair: p, decision: "rejeitado" }); }}><X /> Não são a mesma pessoa</Button>
                    <Button variant="lilac" onClick={() => { setNotes(""); setDecide({ pair: p, decision: "confirmado", keep: p.a.appointments >= p.b.appointments ? p.a.id : p.b.id }); }}><GitMerge /> São a mesma pessoa</Button>
                  </div>
                ) : (
                  <p className="border-t border-line p-4 text-footnote text-ink-muted">
                    <b className="text-ink">{p.status === "confirmado" ? "Unificados" : "Mantidos separados"}</b> por {p.reviewer?.full_name ?? "—"} em {p.reviewed_at ? fmtDateTime(p.reviewed_at) : "—"}{p.review_notes ? ` · ${p.review_notes}` : ""}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!decide} onOpenChange={(o) => !o && setDecide(null)}
        title={decide?.decision === "confirmado" ? "Unificar cadastros" : "Manter cadastros separados"}
        description={decide?.decision === "confirmado" ? "O histórico do outro cadastro é transferido. Nada é apagado e a ação fica na auditoria." : "A semelhança fica registrada como revisada."}
        footer={<><Button variant="secondary" onClick={() => setDecide(null)}>Voltar</Button><Button variant={decide?.decision === "confirmado" ? "lilac" : "primary"} loading={saving} onClick={async () => {
          if (!decide) return;
          setSaving(true);
          const r = await resolveDuplicate(decide.pair.id, decide.decision, decide.decision === "confirmado" ? decide.keep ?? null : null, notes);
          setSaving(false);
          if (!r.ok) return toast.error(r.error);
          setDecide(null);
          setParty(decide.decision === "confirmado" ? "Cadastros unificados!" : "Revisão registrada!");
          router.refresh();
        }}>Confirmar</Button></>}
      >
        {decide?.decision === "confirmado" && (
          <fieldset className="mb-4 space-y-2">
            <legend className="mb-1.5 text-callout font-semibold text-ink-strong">Qual cadastro deve ser mantido?</legend>
            {[decide.pair.a, decide.pair.b].map((x, i) => (
              <label key={x.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3", decide.keep === x.id ? "border-lilac-edge bg-lilac-soft" : "border-line")}>
                <input type="radio" name="keep" checked={decide.keep === x.id} onChange={() => setDecide({ ...decide, keep: x.id })} className="size-5 accent-[var(--color-lilac-ink)]" />
                <span><b>Cadastro {i === 0 ? "A" : "B"}:</b> {x.full_name} · {x.cns ? `CNS ${maskCns(x.cns)}` : "sem CNS"} · {x.appointments} atendimentos</span>
              </label>
            ))}
          </fieldset>
        )}
        <Field label="Observação" htmlFor="dup-notes">
          <Textarea id="dup-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Confirmado com a mãe por telefone" className="min-h-20" />
        </Field>
      </Modal>
      <Celebrate show={!!party} message={party ?? ""} onDone={() => setParty(null)} />
    </>
  );
}
