"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateParameter } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/ui/form";
import { fmtDateTime } from "@/lib/format";

export type Parameter = { key: string; value: unknown; label: string | null; description: string | null; updated_at: string };

export function ParametersPanel({ params }: { params: Parameter[] }) {
  const editable = params.filter((p) => p.key !== "alertas_ultima_execucao");
  const last = params.find((p) => p.key === "alertas_ultima_execucao");
  return (
    <div className="space-y-4">
      <p className="text-callout text-ink-muted">Valores provisórios até a validação da Prefeitura (decisões D-03 e D-04). A fila e os alertas usam estes parâmetros imediatamente.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {editable.map((p) => <ParamCard key={p.key} param={p} />)}
      </div>
      {last && <p className="text-caption text-ink-muted">Última verificação automática de alertas: {typeof last.value === "string" ? fmtDateTime(last.value) : "—"}</p>}
    </div>
  );
}

function ParamCard({ param }: { param: Parameter }) {
  const router = useRouter();
  const isObject = typeof param.value === "object" && param.value !== null;
  const [value, setValue] = React.useState<Record<string, string> | string>(
    isObject ? Object.fromEntries(Object.entries(param.value as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : String(param.value ?? "")
  );
  const [saving, setSaving] = React.useState(false);
  const numeric = !isObject || Object.values(param.value as Record<string, unknown>).every((v) => typeof v === "number");

  async function save() {
    let parsed: unknown;
    if (typeof value === "string") {
      parsed = Number(value);
      if (Number.isNaN(parsed as number)) return toast.error("Informe um número.");
    } else {
      parsed = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, numeric ? Number(v) : v]));
    }
    setSaving(true);
    const r = await updateParameter(param.key, parsed);
    setSaving(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${param.label ?? param.key} atualizado`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="text-headline font-bold">{param.label ?? param.key}</h2>
      {param.description && <p className="mt-0.5 text-footnote text-ink-muted">{param.description}</p>}
      <div className="mt-4 grid gap-3">
        {typeof value === "string" ? (
          <Field label="Valor" htmlFor={`p-${param.key}`}><Input id={`p-${param.key}`} type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="max-w-40" /></Field>
        ) : (
          Object.entries(value).map(([k, v]) => (
            <Field key={k} label={k} htmlFor={`p-${param.key}-${k}`}>
              {numeric
                ? <Input id={`p-${param.key}-${k}`} type="number" value={v} onChange={(e) => setValue({ ...value, [k]: e.target.value })} className="max-w-40" />
                : <Textarea id={`p-${param.key}-${k}`} value={v} onChange={(e) => setValue({ ...value, [k]: e.target.value })} className="min-h-20" />}
            </Field>
          ))
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-caption text-ink-muted">Atualizado em {fmtDateTime(param.updated_at)}</span>
        <Button size="sm" variant="mint" onClick={save} loading={saving}><Save /> Salvar</Button>
      </div>
    </Card>
  );
}
