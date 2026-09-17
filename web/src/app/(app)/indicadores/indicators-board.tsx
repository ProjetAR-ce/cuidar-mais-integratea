"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Table2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { logExport } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Field, Input, Select } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented";
import { ALERT_CODE_LABEL } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { cn } from "@/lib/utils";
import { todayLocalISODate } from "@/lib/format";
import type { Service } from "@/types/domain";

export type Indicators = {
  period: { from: string; to: string };
  attendance: { agendados: number; presentes: number; faltas_justificadas: number; faltas_injustificadas: number; cancelados: number; taxa_comparecimento: number | null };
  monthly: { month: string; presentes: number; faltas: number; cancelados: number }[];
  waiting_by_service: { service: string; code: string; color: string | null; specialty: string; waiting: number; median_wait_days: number }[];
  demand_monthly: { month: string; entradas: number }[];
  referrals: { total: number; pendentes: number; aceitos: number; devolvidos: number; complemento: number; tempo_medio_resposta_horas: number | null; taxa_resposta: number | null };
  referral_flows: { origin: string; destination: string; origin_color?: string | null; destination_color?: string | null; total: number }[];
  alerts: { code: string; alert_type: string; severity: string; pendentes: number; revisados: number }[];
  stale_patients: number;
  consecutive_absences: number;
  duplicates: { pendentes: number; revisadas: number };
  search_before_create: number | null;
  queue_complete_pct: number | null;
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const SERIES = [
  { key: "presentes", label: "Presenças", color: "var(--color-chart-mint)" },
  { key: "faltas", label: "Faltas", color: "var(--color-chart-rose)" },
  { key: "cancelados", label: "Cancelados", color: "var(--color-ink-faint)" },
] as const;

export function IndicatorsBoard({ data, filters, services }: { data: Indicators; filters: { from: string; to: string; serviceId: string }; services: Service[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = React.useState(filters.from);
  const [to, setTo] = React.useState(filters.to);
  const [view, setView] = React.useState<"grafico" | "tabela">("grafico");

  const apply = (patch: Partial<{ de: string; ate: string; servico: string }>) => {
    const p = new URLSearchParams({ de: from, ate: to, servico: filters.serviceId, ...patch });
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const a = data.attendance;
  const r = data.referrals;
  const faltas = a.faltas_justificadas + a.faltas_injustificadas;
  const monthly = data.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const demand = data.demand_monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  // Compatível com a versão anterior da função, que devolvia o código do serviço
  const byKey = (k: string) => services.find((x) => x.code === k || x.name === k);
  const nameOf = (k: string) => byKey(k)?.name ?? k;
  const colorOf = (k: string) => byKey(k)?.color ?? null;
  const serviceName = filters.serviceId === "todos" ? "Todos os serviços" : services.find((s) => s.id === filters.serviceId)?.name ?? "";

  async function exportCsv() {
    const lines: string[][] = [
      ["Relatório agregado Cuidar+ (sem dados pessoais)"], ["Período", data.period.from, data.period.to], ["Serviço", serviceName], [],
      ["Comparecimento"], ["Agendados", String(a.agendados)], ["Presentes", String(a.presentes)], ["Faltas justificadas", String(a.faltas_justificadas)],
      ["Faltas sem justificativa", String(a.faltas_injustificadas)], ["Cancelados", String(a.cancelados)], ["Taxa de comparecimento (%)", String(a.taxa_comparecimento ?? "")], [],
      ["Mês", "Presenças", "Faltas", "Cancelados"], ...data.monthly.map((m) => [m.month, String(m.presentes), String(m.faltas), String(m.cancelados)]), [],
      ["Serviço", "Especialidade", "Aguardando", "Espera mediana (dias)"], ...data.waiting_by_service.map((w) => [w.service, w.specialty, String(w.waiting), String(w.median_wait_days)]), [],
      ["Encaminhamentos"], ["Total", String(r.total)], ["Pendentes", String(r.pendentes)], ["Aceitos", String(r.aceitos)], ["Devolvidos", String(r.devolvidos)],
      ["Complemento pedido", String(r.complemento)], ["Tempo médio até resposta (h)", String(r.tempo_medio_resposta_horas ?? "")], [],
      ["Origem", "Destino", "Total"], ...data.referral_flows.map((f) => [f.origin, f.destination, String(f.total)]), [],
      ["Alerta", "Gravidade", "Pendentes", "Revisados"], ...data.alerts.map((x) => [`${x.code} ${ALERT_CODE_LABEL[x.code] ?? ""}`, x.severity, String(x.pendentes), String(x.revisados)]),
    ];
    const csv = "﻿" + lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cuidar-indicadores-${data.period.from}_${data.period.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await logExport("indicadores", { from: data.period.from, to: data.period.to, service: filters.serviceId });
    toast.success("Relatório exportado", { description: "Somente dados agregados. A exportação foi registrada na auditoria." });
  }

  return (
    <>
      <PageHeader
        eyebrow="Gestão da rede"
        title="Indicadores"
        subtitle="Dados agregados, sem identificação de pacientes (RN-012)."
        actions={<Button variant="secondary" onClick={exportCsv}><Download /> Exportar CSV</Button>}
      />

      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <Field label="De" htmlFor="ind-from" className="w-40"><Input id="ind-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Até" htmlFor="ind-to" className="w-40"><Input id="ind-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="secondary" onClick={() => apply({})}>Aplicar período</Button>
        <div className="flex gap-1.5">
          {[30, 90, 180, 365].map((d) => (
            <button key={d} onClick={() => {
              const ff = todayLocalISODate(-d), tt = todayLocalISODate();
              setFrom(ff); setTo(tt); apply({ de: ff, ate: tt });
            }} className="h-9 rounded-full bg-surface-2 px-3 text-footnote font-semibold text-ink hover:bg-line">{d === 365 ? "1 ano" : `${d} dias`}</button>
          ))}
        </div>
        <Field label="Serviço" htmlFor="ind-service" className="ml-auto min-w-48">
          <Select id="ind-service" value={filters.serviceId} onChange={(e) => apply({ servico: e.target.value })}>
            <option value="todos">Todos os serviços</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </Card>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores de sucesso">
        <Kpi label="Comparecimento" value={a.taxa_comparecimento != null ? `${a.taxa_comparecimento}%` : "—"} hint={`${a.presentes} presenças · ${faltas} faltas`} tone="mint" />
        <Kpi label="Encaminhamentos respondidos" value={r.taxa_resposta != null ? `${r.taxa_resposta}%` : "—"} hint="meta ≥ 90%" tone="lilac" ok={r.taxa_resposta != null ? r.taxa_resposta >= 90 : undefined} />
        <Kpi label="Tempo até resposta" value={r.tempo_medio_resposta_horas != null ? `${Math.round(r.tempo_medio_resposta_horas / 24 * 10) / 10} dias` : "—"} hint={`${r.pendentes} pendentes`} tone="peach" />
        <Kpi label="Busca antes do cadastro" value={data.search_before_create != null ? `${data.search_before_create}%` : "—"} hint="meta ≥ 95%" tone="sun" ok={data.search_before_create != null ? data.search_before_create >= 95 : undefined} />
        <Kpi label="Filas completas" value={data.queue_complete_pct != null ? `${data.queue_complete_pct}%` : "—"} hint="prioridade e data · meta 100%" tone="mint" ok={data.queue_complete_pct === 100} />
        <Kpi label="Sem atualização" value={String(data.stale_patients)} hint={`${data.consecutive_absences} com faltas seguidas`} tone="rose" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h2 className="text-headline font-bold">Presenças e faltas por mês</h2>
              <p className="text-footnote text-ink-muted">Atendimentos já ocorridos no período</p>
            </div>
            <SegmentedControl size="sm" label="Formato" value={view} onChange={setView} options={[{ value: "grafico", label: <BarChart3 className="size-4" aria-label="Gráfico" /> }, { value: "tabela", label: <Table2 className="size-4" aria-label="Tabela" /> }]} />
          </div>
          <Legend items={SERIES.map((s) => ({ label: s.label, color: s.color }))} />
          {view === "grafico" ? (
            <div className="h-72" role="img" aria-label="Gráfico de barras empilhadas com presenças, faltas e cancelamentos por mês">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 12, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--color-surface-2)" }} content={<ChartTooltip />} />
                  {SERIES.map((s, i) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} stroke="var(--color-surface)" strokeWidth={2} radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <DataTable head={["Mês", "Presenças", "Faltas", "Cancelados"]} rows={monthly.map((m) => [m.label, m.presentes, m.faltas, m.cancelados])} />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-headline font-bold">Entradas na fila por mês</h2>
          <p className="mb-3 text-footnote text-ink-muted">Nova demanda registrada (triagens e encaminhamentos aceitos)</p>
          {view === "grafico" ? (
            <div className="h-[19.5rem]" role="img" aria-label="Gráfico de barras com novas entradas na fila por mês">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demand} margin={{ top: 20, right: 8, left: -12, bottom: 0 }} barCategoryGap="32%">
                  <CartesianGrid vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--color-surface-2)" }} content={<ChartTooltip />} />
                  <Bar dataKey="entradas" name="Entradas" fill="var(--color-chart-lilac)" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "var(--color-ink-muted)", fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <DataTable head={["Mês", "Entradas"]} rows={demand.map((m) => [m.label, m.entradas])} />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Pessoas aguardando por serviço e especialidade" subtitle="Situação atual da fila" />
          <DataTable
            head={["Serviço", "Especialidade", "Aguardando", "Espera mediana"]}
            rows={data.waiting_by_service.map((w) => [<ServiceChip key="s" name={w.service} color={w.color} size="sm" />, w.specialty, w.waiting, `${w.median_wait_days} dias`])}
            numericFrom={2}
          />
        </Card>
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="Encaminhamentos entre serviços" subtitle={`${r.total} no período · ${r.aceitos} aceitos · ${r.devolvidos} devolvidos · ${r.complemento} com complemento pedido`} />
            <DataTable head={["Origem", "Destino", "Total"]} rows={data.referral_flows.map((f) => [<ServiceChip key="o" name={nameOf(f.origin)} color={f.origin_color ?? colorOf(f.origin)} size="sm" />, <ServiceChip key="d" name={nameOf(f.destination)} color={f.destination_color ?? colorOf(f.destination)} size="sm" />, f.total])} numericFrom={2} />
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Alertas por tipo" subtitle={`Duplicidades: ${data.duplicates.pendentes} pendentes · ${data.duplicates.revisadas} revisadas`} />
            <DataTable head={["Alerta", "Pendentes", "Revisados"]} rows={data.alerts.map((x) => [`${x.code} · ${ALERT_CODE_LABEL[x.code] ?? x.alert_type}`, x.pendentes, x.revisados])} numericFrom={1} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, hint, tone, ok }: { label: string; value: string; hint: string; tone: "mint" | "lilac" | "peach" | "sun" | "rose"; ok?: boolean }) {
  const bar = { mint: "bg-mint", lilac: "bg-lilac", peach: "bg-peach", sun: "bg-sun", rose: "bg-rose" }[tone];
  return (
    <div className="card relative overflow-hidden p-4">
      <span aria-hidden className={cn("absolute inset-x-4 top-0 h-1.5 rounded-b-full", bar)} />
      <p className="text-footnote font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 text-title-1 font-extrabold text-ink-strong tabular">{value}</p>
      <p className={cn("text-caption", ok === true ? "font-semibold text-mint-ink" : ok === false ? "font-semibold text-rose-ink" : "text-ink-muted")}>
        {ok === true ? "✓ " : ok === false ? "! " : ""}{hint}
      </p>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-4" aria-label="Legenda">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-footnote text-ink">
          <span aria-hidden className="size-3 rounded-[4px]" style={{ background: i.color }} />{i.label}
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[14px] border border-line bg-surface px-3 py-2 shadow-float">
      <p className="text-footnote font-bold text-ink-strong">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-footnote text-ink">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: p.color }} />
            <span className="flex-1">{p.name}</span>
            <b className="tabular">{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ head, rows, numericFrom = 1 }: { head: string[]; rows: React.ReactNode[][]; numericFrom?: number }) {
  if (!rows.length) return <p className="px-5 py-6 text-callout text-ink-muted">Sem dados no período.</p>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-caption font-bold tracking-wide text-ink-muted uppercase">
            {head.map((h, i) => <th key={h} scope="col" className={cn("px-5 py-2.5", i >= numericFrom && "text-right")}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line last:border-0">
              {r.map((c, ci) => <td key={ci} className={cn("px-5 py-2.5 text-callout", ci >= numericFrom ? "text-right font-bold text-ink-strong tabular" : "text-ink")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
