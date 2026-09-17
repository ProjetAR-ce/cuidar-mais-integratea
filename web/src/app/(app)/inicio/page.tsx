import Link from "next/link";
import Image from "next/image";
import {
  AlertOctagon, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Clock, Copy, GraduationCap, HandHeart, Heart, HeartPulse, House, ListOrdered, MapPin, Puzzle, Route, Send, UserRound, Users,
} from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { Blob } from "@/components/ui/brand";
import { Avatar, Badge, Card, CardHeader, IconBubble, ProgressBar, ProgressRing } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/stat-card";
import { AppointmentStatusBadge, ALERT_CODE_LABEL } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { TONE, toneOf } from "@/components/ui/tone";
import { fmtRelativeDay, fmtTime, isoFromNow, todayLocalISODate } from "@/lib/format";
import { firstName, cn } from "@/lib/utils";
import { ROLE_LABEL, type AppointmentStatus } from "@/types/domain";

export const metadata = { title: "Início" };

const SERVICE_ICON: Record<string, typeof Heart> = { NASF: HeartPulse, NAPE: GraduationCap, CREAES: Puzzle, CASA_MAIS_AZUL: House, CRASF: HandHeart };

type Stats = {
  patients_total: number; patients_new_30d: number; patients_new_prev_30d: number; in_care_30d: number; in_care_prev_30d: number;
  waiting_total: number; referrals_pending: number; referrals_30d: number; referrals_prev_30d: number;
  median_wait_days: number | null; median_wait_days_prev: number | null; current_median_wait_days: number | null;
  appointments_today: number; attendance_rate_30d: number | null; alerts_pending: number; alerts_critical: number;
  alerts_by_code: Record<string, number>; duplicates_pending: number; alerts_reviewed_today: number; referrals_answered_today: number; attendance_marked_today: number;
};

const ALERT_ICON: Record<string, { tone: "rose" | "sun" | "peach" | "lilac"; icon: typeof Clock }> = {
  "AL-01": { tone: "peach", icon: Copy },
  "AL-02": { tone: "rose", icon: Route },
  "AL-03": { tone: "sun", icon: Send },
  "AL-04": { tone: "rose", icon: UserRound },
  "AL-05": { tone: "lilac", icon: Clock },
  "AL-06": { tone: "sun", icon: ListOrdered },
};

export default async function Inicio() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const ref = await getReference();

  await supabase.rpc("refresh_care_alerts");
  const canAgenda = can(profile.role, "agenda.read");

  const agendaQuery = () => {
    let q = supabase.from("v_agenda").select("id, patient_id, patient_name, scheduled_for, specialty_name, professional_name, service_name, service_color, status")
      .gte("scheduled_for", isoFromNow(-60 * 60_000)).eq("status", "agendado").order("scheduled_for").limit(6);
    if (profile.role === "profissional") q = q.eq("professional_id", profile.id);
    else if (profile.role === "recepcao" && profile.service_id) q = q.eq("service_id", profile.service_id);
    return q;
  };

  const [{ data: statsData }, agenda, waitingByService, todayAgenda] = await Promise.all([
    supabase.rpc("get_home_stats"),
    canAgenda ? agendaQuery() : Promise.resolve({ data: [] }),
    can(profile.role, "queue.read") ? supabase.from("queue_entries").select("service_id").eq("status", "aguardando").limit(5000) : Promise.resolve({ data: [] }),
    profile.role === "profissional" && canAgenda
      ? supabase.from("v_agenda").select("status, has_session_record").eq("professional_id", profile.id).gte("scheduled_for", `${todayLocalISODate()}T00:00:00-03:00`).lt("scheduled_for", `${todayLocalISODate(1)}T00:00:00-03:00`)
      : Promise.resolve({ data: [] }),
  ]);
  const s = (statsData ?? {}) as Stats;
  const waitingCount = (sid: string) => ((waitingByService.data ?? []) as { service_id: string }[]).filter((w) => w.service_id === sid).length;

  // Metas do dia (anéis estilo Apple Atividade)
  const todays = (todayAgenda.data ?? []) as { status: AppointmentStatus; has_session_record: boolean }[];
  const goals =
    profile.role === "recepcao"
      ? [{ label: "Presenças registradas", value: s.attendance_marked_today, max: Math.max(s.appointments_today, 1), tone: "mint" as const }]
      : profile.role === "profissional"
        ? [
            { label: "Atendimentos registrados", value: todays.filter((t) => t.has_session_record).length, max: Math.max(todays.filter((t) => t.status !== "cancelado").length, 1), tone: "mint" as const },
            { label: "Encaminhamentos respondidos", value: s.referrals_answered_today, max: Math.max(s.referrals_answered_today + s.referrals_pending, 1), tone: "lilac" as const },
          ]
        : profile.role === "gestao"
          ? []
          : [
              { label: "Alertas revisados hoje", value: s.alerts_reviewed_today, max: Math.max(s.alerts_reviewed_today + s.alerts_pending, 1), tone: "rose" as const },
              { label: "Encaminhamentos respondidos", value: s.referrals_answered_today, max: Math.max(s.referrals_answered_today + s.referrals_pending, 1), tone: "lilac" as const },
            ];

  const journey = [
    { label: "Entrada", sub: "Cadastros", value: s.patients_new_30d, href: "/pacientes", icon: UserRound, tone: "rose" as const },
    { label: "Triagem", sub: "Prioridade", value: null, href: "/triagem", icon: ClipboardList, tone: "peach" as const, perm: "triage.create" as const },
    { label: "Fila", sub: "Aguardando", value: s.waiting_total, href: "/fila", icon: ListOrdered, tone: "lilac" as const, perm: "queue.read" as const },
    { label: "Atendimento", sub: "Hoje", value: s.appointments_today, href: "/agenda", icon: CalendarDays, tone: "mint" as const, perm: "agenda.read" as const },
    { label: "Continuidade", sub: "Encaminhar", value: s.referrals_pending, href: "/encaminhamentos", icon: Send, tone: "sun" as const, perm: "referrals.manage" as const },
  ];

  const alertCodes = Object.entries(s.alerts_by_code ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[24px] border border-line bg-primary-soft animate-fade-up">
        <Blob tone="mint" variant={1} className="-top-10 right-[30%] size-48" opacity={0.35} />
        <Blob tone="lilac" variant={2} className="right-4 -bottom-16 size-56" opacity={0.35} />
        <Blob tone="peach" variant={0} className="-bottom-20 left-[40%] size-44" opacity={0.3} />
        <div className="relative grid items-center gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="p-6 sm:p-9">
            <p className="text-footnote font-bold text-ink-muted">{ROLE_LABEL[profile.role]}{profile.service ? ` · ${profile.service.name}` : ""}</p>
            <h1 className="mt-1 text-large-title sm:text-[2.75rem]">Olá, {firstName(profile.full_name)}!</h1>
            <p className="mt-2 max-w-lg text-headline font-normal text-ink">
              Aqui você encontra uma visão integrada da jornada de cuidado e pode acompanhar cada etapa de forma simples e segura.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-footnote font-semibold text-ink shadow-[0_1px_2px_rgb(16_24_40/0.06)]">
              <MapPin className="size-4" /> Prefeitura Municipal de Crateús
            </span>
          </div>
          <div className="relative hidden h-full min-h-56 md:block">
            <Image src="/brand/hero-family.jpg" alt="Ilustração de uma mãe, uma criança e uma profissional de saúde sorrindo juntas" fill priority sizes="(min-width: 768px) 40vw, 0px" className="object-contain object-bottom mix-blend-multiply [mask-image:linear-gradient(to_right,transparent,black_18%,black_88%,transparent)]" />
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais">
        <StatCard label="Pacientes cadastrados" value={s.patients_total?.toLocaleString("pt-BR")} icon={Users} tone="lilac" current={s.patients_new_30d} previous={s.patients_new_prev_30d} href={can(profile.role, "patients.read") ? "/pacientes" : undefined} />
        <StatCard label="Em atendimento (30 dias)" value={s.in_care_30d} icon={CalendarDays} tone="mint" current={s.in_care_30d} previous={s.in_care_prev_30d} href={canAgenda ? "/agenda" : undefined} />
        <StatCard label="Encaminhamentos (30 dias)" value={s.referrals_30d} icon={Send} tone="peach" current={s.referrals_30d} previous={s.referrals_prev_30d} href={can(profile.role, "referrals.manage") ? "/encaminhamentos" : undefined} />
        <StatCard label="Tempo mediano de espera" value={s.median_wait_days ?? s.current_median_wait_days ?? 0} suffix="dias" icon={Clock} tone="rose" current={s.median_wait_days} previous={s.median_wait_days_prev} invert href={can(profile.role, "capacity.read") ? "/capacidade" : undefined} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          {/* Jornada */}
          <Card>
            <CardHeader title="Jornada do cuidado" icon={Route} tone="lilac" subtitle="Da entrada à continuidade, cada etapa gera um evento auditável." />
            <ol className="relative grid grid-cols-5 gap-1 px-4 pt-2 pb-6">
              <div aria-hidden className="absolute top-8 right-[12%] left-[12%] h-1 rounded-full bg-primary/20" />
              {journey.map((j) => {
                const allowed = !j.perm || can(profile.role, j.perm);
                const inner = (
                  <>
                    <span className="relative flex size-12 items-center justify-center rounded-full border-4 border-surface text-ink-strong transition group-hover:-translate-y-0.5" style={{ background: `var(--color-${j.tone})`, boxShadow: `0 4px 0 var(--color-${j.tone}-edge)` }}>
                      <j.icon className="size-5" strokeWidth={2.4} aria-hidden />
                    </span>
                    <span className="mt-2 text-footnote font-bold text-ink-strong">{j.label}</span>
                    <span className="hidden text-caption text-ink-muted sm:block">{j.value != null ? `${j.value} · ${j.sub.toLowerCase()}` : j.sub}</span>
                  </>
                );
                return (
                  <li key={j.label} className="flex flex-col items-center text-center">
                    {allowed ? <Link href={j.href} className="group flex flex-col items-center rounded-lg p-1">{inner}</Link> : <div className="flex flex-col items-center p-1">{inner}</div>}
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Próximos atendimentos */}
          {canAgenda && (
            <Card className="overflow-hidden">
              <CardHeader title="Próximos atendimentos" icon={CalendarDays} tone="mint" action={<Link href="/agenda" className="flex items-center gap-1 text-footnote font-semibold text-lilac-ink hover:underline">Ver agenda <ArrowRight className="size-4" /></Link>} />
              {(agenda.data ?? []).length === 0 ? (
                <p className="px-5 pb-6 text-callout text-ink-muted">Nenhum atendimento agendado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left">
                    <caption className="sr-only">Próximos atendimentos</caption>
                    <thead>
                      <tr className="border-y border-line bg-surface-2/60 text-caption font-bold tracking-wide text-ink-muted uppercase">
                        <th scope="col" className="px-5 py-2">Horário</th>
                        <th scope="col" className="px-3 py-2">Paciente</th>
                        <th scope="col" className="px-3 py-2">Serviço</th>
                        <th scope="col" className="px-5 py-2 text-right">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((agenda.data ?? []) as { id: string; patient_id: string; patient_name: string; scheduled_for: string; specialty_name: string | null; professional_name: string; service_name: string; service_color: string | null; status: AppointmentStatus }[]).map((a) => (
                        <tr key={a.id} className="border-b border-line last:border-0">
                          <td className="px-5 py-3">
                            <p className="font-extrabold text-ink-strong tabular">{fmtTime(a.scheduled_for)}</p>
                            <p className="text-caption text-ink-muted">{fmtRelativeDay(a.scheduled_for)}</p>
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/pacientes/${a.patient_id}`} className="flex items-center gap-2.5 font-semibold text-ink-strong hover:underline">
                              <Avatar name={a.patient_name} size="sm" /> {a.patient_name}
                            </Link>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-callout font-semibold text-ink">{a.specialty_name}</p>
                            <ServiceChip name={a.service_name} color={a.service_color} size="sm" />
                          </td>
                          <td className="px-5 py-3 text-right"><AppointmentStatusBadge status={a.status} size="sm" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Metas do dia */}
          {goals.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <IconBubble icon={Heart} tone="rose" size="sm" />
                <h2 className="text-headline font-bold">Metas de hoje</h2>
              </div>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                {goals.map((g) => {
                  const done = g.value >= g.max && g.value > 0;
                  return (
                    <li key={g.label} className="flex items-center gap-4">
                      <ProgressRing value={g.value} max={g.max} tone={g.tone} size={64} stroke={9} label={`${g.label}: ${g.value} de ${g.max}`}>
                        {done ? <CheckCircle2 className="size-6 text-mint-ink" /> : <span className="text-footnote font-extrabold tabular">{g.value}/{g.max}</span>}
                      </ProgressRing>
                      <div>
                        <p className="font-bold text-ink-strong">{g.label}</p>
                        <p className="text-footnote text-ink-muted">{done ? "Meta concluída. Bom trabalho!" : `Faltam ${g.max - g.value}`}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* Alertas */}
          {(can(profile.role, "alerts.review") || profile.role === "gestao") && (
            <Card>
              <CardHeader title="Alertas e pendências" icon={AlertOctagon} tone="rose"
                subtitle={s.alerts_critical ? `${s.alerts_critical} críticos` : "Nenhum alerta crítico"}
                action={can(profile.role, "alerts.review") ? <Link href="/alertas" className="flex items-center gap-1 text-footnote font-semibold text-lilac-ink hover:underline">Ver todos <ArrowRight className="size-4" /></Link> : undefined} />
              <ul className="px-3 pb-3">
                {alertCodes.length === 0 && <li className="px-2 pb-3 text-callout text-ink-muted">Tudo em dia!</li>}
                {alertCodes.map(([code, n]) => {
                  const m = ALERT_ICON[code] ?? { tone: "lilac", icon: AlertOctagon };
                  const content = (
                    <>
                      <IconBubble icon={m.icon} tone={m.tone} size="xs" />
                      <span className="flex-1 text-callout font-semibold text-ink">{ALERT_CODE_LABEL[code] ?? code}</span>
                      <span className={cn("text-callout font-extrabold tabular", TONE[m.tone].ink)}>{n}</span>
                    </>
                  );
                  return (
                    <li key={code}>
                      {can(profile.role, "alerts.review")
                        ? <Link href={`/alertas?tipo=${code}`} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-surface-2">{content}</Link>
                        : <div className="flex items-center gap-3 px-2 py-2.5">{content}</div>}
                    </li>
                  );
                })}
                {can(profile.role, "duplicates.resolve") && s.duplicates_pending > 0 && (
                  <li>
                    <Link href="/duplicidades" className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-surface-2">
                      <IconBubble icon={Copy} tone="peach" size="xs" />
                      <span className="flex-1 text-callout font-semibold text-ink">Duplicidades para revisar</span>
                      <span className="text-callout font-extrabold text-peach-ink tabular">{s.duplicates_pending}</span>
                    </Link>
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* Rede de serviços */}
          <Card>
            <CardHeader title="Rede de serviços" icon={MapPin} tone="mint" subtitle={s.attendance_rate_30d != null ? `Comparecimento de ${s.attendance_rate_30d}% nos últimos 30 dias` : undefined} />
            <ul className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-5">
              {ref.services.map((svc) => {
                const t = TONE[toneOf(svc.color)];
                const waiting = waitingCount(svc.id);
                const inner = (
                  <>
                    <span className={cn("flex size-11 items-center justify-center rounded-[14px] text-ink-strong", t.bg)} style={{ boxShadow: `0 3px 0 var(--color-${toneOf(svc.color)}-edge)` }}>
                      {(() => { const Icon = SERVICE_ICON[svc.code] ?? Heart; return <Icon className="size-5" strokeWidth={2.3} aria-hidden />; })()}
                    </span>
                    <span className="mt-2 line-clamp-1 text-footnote font-bold text-ink-strong">{svc.name}</span>
                    {can(profile.role, "queue.read") && <span className="text-caption text-ink-muted tabular">{waiting} na fila</span>}
                  </>
                );
                return (
                  <li key={svc.id}>
                    {can(profile.role, "queue.read")
                      ? <Link href={`/fila?servico=${svc.id}`} className={cn("flex flex-col items-center rounded-[18px] p-3 text-center transition hover:-translate-y-0.5", t.soft)}>{inner}</Link>
                      : <div className={cn("flex flex-col items-center rounded-[18px] p-3 text-center", t.soft)}>{inner}</div>}
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="relative overflow-hidden rounded-[24px] bg-primary-soft p-5">
            <Image src="/brand/symbol.png" alt="" width={72} height={72} className="absolute -right-2 -bottom-3 animate-float opacity-90" />
            <p className="relative max-w-[70%] text-headline font-bold text-ink-strong">Juntos construímos uma rede de cuidado mais forte.</p>
            {s.waiting_total > 0 && <ProgressBar value={s.in_care_30d} max={s.in_care_30d + s.waiting_total} tone="mint" className="relative mt-3 max-w-[70%]" label="Pessoas atendidas frente à demanda" />}
            {s.waiting_total > 0 && <p className="relative mt-1 text-caption text-ink-muted">{s.in_care_30d} atendidos · {s.waiting_total} aguardando</p>}
            <Badge tone="ink" size="sm" className="relative mt-2 bg-white/70">Dados fictícios para demonstração</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
