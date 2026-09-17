import { AlertTriangle, CheckCircle2, CircleSlash, Gauge, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { ServiceChip } from "@/components/care/service-chip";
import { CapacityFilter } from "./capacity-filter";
import { cn } from "@/lib/utils";

export const metadata = { title: "Capacidade da rede" };

type Row = {
  service_id: string; service_name: string; service_code: string; service_color: string | null; specialty_id: string; specialty_name: string;
  monthly_capacity: number; professionals_count: number; waiting: number; in_care: number; demand_30d: number; scheduled_30d: number;
  median_wait_days: number | null; oldest_wait_days: number | null; utilization: number | null; situation: "gargalo" | "atencao" | "ok" | "sem_oferta";
};

const SITUATION = {
  gargalo: { label: "Gargalo", tone: "rose" as const, icon: AlertTriangle },
  atencao: { label: "Atenção", tone: "sun" as const, icon: AlertTriangle },
  ok: { label: "Adequado", tone: "mint" as const, icon: CheckCircle2 },
  sem_oferta: { label: "Sem oferta", tone: "ink" as const, icon: CircleSlash },
};

export default async function CapacidadePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("capacity.read");
  const sp = await searchParams;
  const serviceId = typeof sp.servico === "string" ? sp.servico : null;
  const supabase = await createClient();
  const ref = await getReference();
  const { data, error } = await supabase.rpc("get_capacity", { p_service: serviceId });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  const totals = rows.reduce((acc, r) => ({
    capacity: acc.capacity + r.monthly_capacity, waiting: acc.waiting + Number(r.waiting), demand: acc.demand + Number(r.demand_30d),
    scheduled: acc.scheduled + Number(r.scheduled_30d), professionals: acc.professionals + r.professionals_count,
  }), { capacity: 0, waiting: 0, demand: 0, scheduled: 0, professionals: 0 });
  const bottlenecks = rows.filter((r) => r.situation === "gargalo").sort((a, b) => Number(b.waiting) / Math.max(b.monthly_capacity, 1) - Number(a.waiting) / Math.max(a.monthly_capacity, 1));
  const byService = ref.services.filter((s) => rows.some((r) => r.service_id === s.id)).map((s) => ({ service: s, rows: rows.filter((r) => r.service_id === s.id) }));

  return (
    <>
      <PageHeader
        eyebrow="Demanda × oferta"
        title="Capacidade da rede"
        subtitle="Compara quem aguarda, a demanda dos últimos 30 dias, as vagas mensais e os profissionais de cada especialidade."
        actions={<CapacityFilter services={ref.services} value={serviceId ?? "todos"} />}
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumo">
        <Tile label="Vagas por mês" value={totals.capacity} hint={`${totals.professionals} profissionais`} bar="bg-mint" />
        <Tile label="Aguardando agora" value={totals.waiting} hint={`${totals.capacity ? Math.round((totals.waiting / totals.capacity) * 100) : 0}% das vagas mensais`} bar="bg-sun" />
        <Tile label="Novas entradas (30 dias)" value={totals.demand} hint="demanda recente" bar="bg-lilac" />
        <Tile label="Gargalos" value={bottlenecks.length} hint={bottlenecks[0] ? `${bottlenecks[0].specialty_name} · ${bottlenecks[0].service_name}` : "nenhum"} bar="bg-rose" />
      </section>

      {bottlenecks.length > 0 && (
        <Card className="mt-6 border-2 border-rose/60 bg-rose-soft/40 p-5">
          <p className="flex items-center gap-2 font-bold text-rose-ink"><AlertTriangle className="size-5" /> Onde a fila supera a capacidade</p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {bottlenecks.map((b) => (
              <li key={b.service_id + b.specialty_id} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-surface px-3 py-2.5">
                <ServiceChip name={b.service_name} color={b.service_color} size="sm" />
                <span className="font-bold text-ink-strong">{b.specialty_name}</span>
                <span className="ml-auto text-footnote text-ink"><b className="tabular">{b.waiting}</b> aguardando para <b className="tabular">{b.monthly_capacity}</b> vagas/mês</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-footnote text-ink-muted">Sugestão: redistribuir a demanda com outros serviços que ofertam a especialidade ou ampliar a agenda.</p>
        </Card>
      )}

      <div className="mt-6 space-y-6">
        {byService.map(({ service, rows: list }) => (
          <Card key={service.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
              <Gauge className="size-5 text-ink-muted" aria-hidden />
              <h2 className="text-title-2">{service.name}</h2>
              <span className="text-footnote text-ink-muted">{service.description}</span>
              <span className="ml-auto flex items-center gap-1 text-footnote text-ink-muted"><Users className="size-4" /> {list.reduce((a, r) => a + r.professionals_count, 0)} profissionais</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <caption className="sr-only">Capacidade de {service.name} por especialidade</caption>
                <thead>
                  <tr className="text-caption font-bold tracking-wide text-ink-muted uppercase">
                    <th scope="col" className="px-5 py-3">Especialidade</th>
                    <th scope="col" className="w-[34%] px-3 py-3">Fila frente às vagas do mês</th>
                    <th scope="col" className="px-3 py-3 text-right">Agendados (±15 dias)</th>
                    <th scope="col" className="px-3 py-3 text-right">Espera mediana</th>
                    <th scope="col" className="px-5 py-3 text-right">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const sit = SITUATION[r.situation];
                    const max = Math.max(r.monthly_capacity, Number(r.waiting), 1);
                    return (
                      <tr key={r.specialty_id} className="border-t border-line">
                        <th scope="row" className="px-5 py-3.5">
                          <p className="font-bold text-ink-strong">{r.specialty_name}</p>
                          <p className="text-caption font-normal text-ink-muted">{r.professionals_count} prof. · {r.in_care} em acompanhamento</p>
                        </th>
                        <td className="px-3 py-3.5">
                          {/* Barra de bala: vagas (trilho) × aguardando (preenchimento) */}
                          <div className="relative h-5 rounded-full bg-surface-2" role="img" aria-label={`${r.waiting} aguardando para ${r.monthly_capacity} vagas por mês`}>
                            <div className="absolute inset-y-0 left-0 rounded-full bg-mint/35" style={{ width: `${(r.monthly_capacity / max) * 100}%` }} />
                            <div className={cn("absolute inset-y-[5px] left-[5px] rounded-full", r.situation === "gargalo" ? "bg-[var(--color-chart-rose)]" : r.situation === "atencao" ? "bg-[var(--color-chart-sun)]" : "bg-[var(--color-chart-mint)]")} style={{ width: `calc(${(Number(r.waiting) / max) * 100}% - 10px)`, minWidth: Number(r.waiting) ? 6 : 0 }} />
                            <div className="absolute inset-y-[-3px] w-0.5 rounded-full bg-ink" style={{ left: `calc(${(r.monthly_capacity / max) * 100}% - 1px)` }} aria-hidden />
                          </div>
                          <p className="mt-1 text-caption text-ink-muted"><b className="text-ink-strong tabular">{r.waiting}</b> aguardando · <b className="text-ink-strong tabular">{r.monthly_capacity}</b> vagas/mês · {r.demand_30d} novas em 30 dias</p>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <p className="font-bold text-ink-strong tabular">{r.scheduled_30d}</p>
                          <p className="text-caption text-ink-muted tabular">{r.utilization != null ? `${r.utilization}% da oferta` : "—"}</p>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <p className="font-bold text-ink-strong tabular">{r.median_wait_days != null ? `${r.median_wait_days} dias` : "—"}</p>
                          <p className="text-caption text-ink-muted tabular">{r.oldest_wait_days != null ? `máx. ${r.oldest_wait_days} dias` : ""}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right"><Badge tone={sit.tone} icon={sit.icon} size="sm">{sit.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-caption text-ink-muted">Legenda: trilho verde-claro = vagas por mês; barra = pessoas aguardando; traço escuro = limite da capacidade.</p>
    </>
  );
}

function Tile({ label, value, hint, bar }: { label: string; value: number; hint: string; bar: string }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <span aria-hidden className={cn("absolute inset-x-5 top-0 h-1.5 rounded-b-full", bar)} />
      <p className="text-footnote font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 text-[2rem] leading-tight font-extrabold text-ink-strong tabular">{value.toLocaleString("pt-BR")}</p>
      <p className="truncate text-caption text-ink-muted">{hint}</p>
    </div>
  );
}
