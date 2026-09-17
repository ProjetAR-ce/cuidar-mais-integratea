import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Baby, CalendarDays, Check, ClipboardList, Flag, HeartHandshake, Home, IdCard, ListOrdered, Phone, School, Send, Sparkles, UserRound,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { age, daysSince, fmtDate, fmtDateTime, fmtRelativeDay, fmtTime, fromNow, maskCns, maskCpf, nowMs } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, IconBubble } from "@/components/ui/primitives";
import { TabLinks } from "@/components/ui/tab-links";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { AppointmentStatusBadge, PriorityBadge, QueueStatusBadge, ReferralStatusBadge, SeverityBadge, ALERT_CODE_LABEL } from "@/components/ui/status";
import { ServiceChip } from "@/components/care/service-chip";
import { PatientActions } from "./patient-actions";
import { CarePlanPanel } from "./care-plan";
import { NoteForm } from "./note-form";
import { ClinicalInfoCard } from "./clinical-info";
import { cn } from "@/lib/utils";
import { TONE } from "@/components/ui/tone";
import type { AppointmentStatus, Priority, QueueStatus, ReferralStatus } from "@/types/domain";

export const metadata = { title: "Paciente" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PatientPage({ params, searchParams }: Params) {
  const profile = await requirePermission("patients.read");
  const { id } = await params;
  const sp = await searchParams;
  const clinical = can(profile.role, "patients.clinical");
  const tab = typeof sp.aba === "string" ? sp.aba : "resumo";
  const serviceFilter = typeof sp.servico === "string" ? sp.servico : null;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (!patient) notFound();

  const ref = await getReference();
  const svcById = Object.fromEntries(ref.services.map((s) => [s.id, s]));

  const [queue, agenda, triages, events, referrals, plans, clinicalInfo, alerts] = await Promise.all([
    supabase.from("v_queue_ranked").select("id, service_id, service_name, service_color, specialty_name, specialty_id, priority, status, entered_at, started_at, wait_days, queue_position, rank_reason, origin, priority_justification").eq("patient_id", id).order("entered_at", { ascending: false }),
    supabase.from("v_agenda").select("*").eq("patient_id", id).order("scheduled_for", { ascending: false }).limit(200),
    clinical ? supabase.from("triages").select("id, service_id, priority, need_description, priority_justification, created_at, specialty_id, professional:profiles!professional_id(full_name)").eq("patient_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    clinical ? supabase.from("journey_events").select("id, event_type, description, stage, created_at, service_id, author:profiles!created_by(full_name, job_title)").eq("patient_id", id).order("created_at", { ascending: false }).limit(400) : Promise.resolve({ data: [] }),
    clinical ? supabase.from("referrals").select("id, origin_service_id, destination_service_id, specialty_id, priority, status, reason, response_notes, complement_notes, created_at, responded_at, due_at").eq("patient_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    clinical ? supabase.from("care_plans").select("id, goal, status, review_due_at, created_at, reference_service_id, coordinator:profiles!coordinator_id(full_name), items:care_plan_items(id, description, status, due_date, service_id, completed_at, responsible:profiles!responsible_id(full_name))").eq("patient_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    clinical ? supabase.from("patient_clinical_info").select("diagnostic_hypothesis, medications, updated_at").eq("patient_id", id).maybeSingle() : Promise.resolve({ data: null }),
    clinical ? supabase.from("care_alerts").select("id, code, title, reason, action_recommended, severity, status, created_at, reviewed_at, review_notes").eq("patient_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  if (clinical) await supabase.rpc("log_access", { p_action: "sensitive.read", p_resource: "patients", p_resource_id: id, p_details: { aba: tab } });

  const q = (queue.data ?? []) as QueueRow[];
  const appts = (agenda.data ?? []) as AgendaRow[];
  // Eventos com o mesmo instante seguem a ordem natural da jornada
  const STAGE_ORDER: Record<string, number> = { entrada: 0, triagem: 1, fila: 2, atendimento: 3, continuidade: 4, alerta: 5, nota: 6 };
  const evs = ((events.data ?? []) as unknown as EventRow[]).sort((a, b) =>
    b.created_at.localeCompare(a.created_at) || (STAGE_ORDER[b.stage ?? "nota"] ?? 9) - (STAGE_ORDER[a.stage ?? "nota"] ?? 9));
  const refs = (referrals.data ?? []) as ReferralRow[];
  const planList = (plans.data ?? []) as unknown as PlanRow[];
  const alertList = (alerts.data ?? []) as AlertRow[];
  const triageList = (triages.data ?? []) as unknown as TriageRow[];

  const now = nowMs();
  const upcoming = appts.filter((a) => a.status === "agendado" && new Date(a.scheduled_for).getTime() >= now - 3600_000).reverse();
  const activeQueues = q.filter((e) => e.status === "aguardando" || e.status === "em_atendimento");
  const pendingAlerts = alertList.filter((a) => a.status === "pendente");
  const activePlan = planList.find((p) => p.status === "ativo") ?? null;

  const stages = [
    { key: "entrada", label: "Entrada", sub: "Cadastro", done: true, icon: UserRound, tone: "rose" as const },
    { key: "triagem", label: "Triagem", sub: "Prioridade", done: triageList.length > 0 || q.length > 0, icon: ClipboardList, tone: "peach" as const },
    { key: "fila", label: "Fila", sub: "Especialidade", done: q.length > 0, icon: ListOrdered, tone: "lilac" as const },
    { key: "atendimento", label: "Atendimento", sub: "Sessão", done: appts.some((a) => a.status === "presente"), icon: CalendarDays, tone: "mint" as const },
    { key: "continuidade", label: "Continuidade", sub: "Encaminhar", done: refs.length > 0 || planList.length > 0, icon: Send, tone: "sun" as const },
  ];
  const currentStage = Math.max(0, stages.map((s) => s.done).lastIndexOf(true));

  const base = `/pacientes/${id}`;
  const tabs = [
    { key: "resumo", label: "Resumo", href: base },
    ...(clinical ? [{ key: "jornada", label: "Linha do tempo", href: `${base}?aba=jornada`, count: evs.length }] : []),
    ...(clinical ? [{ key: "plano", label: "Plano", href: `${base}?aba=plano` }] : []),
    { key: "agenda", label: "Agenda", href: `${base}?aba=agenda`, count: upcoming.length },
    ...(clinical ? [{ key: "encaminhamentos", label: "Encaminhamentos", href: `${base}?aba=encaminhamentos`, count: refs.filter((r) => r.status === "pendente").length }] : []),
    ...(clinical ? [{ key: "alertas", label: "Alertas", href: `${base}?aba=alertas`, count: pendingAlerts.length }] : []),
  ];
  const displayName = patient.social_name ?? patient.full_name;
  const picked = { id: patient.id, full_name: displayName, birth_date: patient.birth_date, mother_name: patient.mother_name };
  const servicesInCare = [...new Set([...activeQueues.map((e) => e.service_id), ...upcoming.map((a) => a.service_id)])].map((sid) => svcById[sid]).filter(Boolean);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/pacientes"><ArrowLeft /> Pacientes</Link></Button>

      {patient.status === "mesclado" && (
        <div role="alert" className="rounded-lg bg-sun-soft p-4 font-semibold text-sun-ink">
          Este cadastro foi unificado com outro. <Link className="underline" href={`/pacientes/${patient.merged_into_id}`}>Abrir o cadastro principal</Link>
        </div>
      )}

      {/* Cabeçalho */}
      <Card className="relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-primary-soft" aria-hidden />
        <div className="relative flex flex-wrap items-start gap-5">
          <Avatar name={patient.full_name} size="lg" className="size-20 text-title-1" />
          <div className="min-w-0 flex-1">
            <h1 className="text-title-1 sm:text-large-title">{displayName}</h1>
            {patient.social_name && <p className="text-footnote text-ink-muted">Nome civil: {patient.full_name}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="lilac" icon={Baby}>{age(patient.birth_date)}</Badge>
              <Badge tone="ink" icon={IdCard}>{patient.cns ? `CNS ${maskCns(patient.cns)}` : "Sem CNS"}</Badge>
              {servicesInCare.map((s) => <ServiceChip key={s.id} name={s.name} color={s.color} />)}
              {pendingAlerts.length > 0 && (
                <Link href={`${base}?aba=alertas`}><Badge tone="rose" icon={AlertTriangle}>{pendingAlerts.length} {pendingAlerts.length === 1 ? "alerta" : "alertas"}</Badge></Link>
              )}
            </div>
          </div>
          <PatientActions
            patient={picked}
            role={profile.role}
            userServiceId={profile.service_id}
            services={ref.services} specialties={ref.specialties} offers={ref.offers} staff={ref.staff}
          />
        </div>

        {/* Jornada (estilo trilha do Duolingo) */}
        <ol className="relative mt-7 grid grid-cols-5 gap-1" aria-label="Etapas da jornada do cuidado">
          <div aria-hidden className="absolute top-6 right-[10%] left-[10%] h-1.5 rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(currentStage / 4) * 100}%` }} />
          </div>
          {stages.map((s, i) => (
            <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={i === currentStage ? "step" : undefined}>
              <span className={cn(
                "relative flex size-12 items-center justify-center rounded-full border-4 border-surface transition",
                s.done ? cn(TONE[s.tone].bg, "text-ink-strong") : "bg-surface-2 text-ink-faint",
                i === currentStage && "scale-110 ring-4 ring-primary/25"
              )} style={s.done ? { boxShadow: `0 4px 0 var(--color-${s.tone}-edge)` } : undefined}>
                <s.icon className="size-5" strokeWidth={2.4} aria-hidden />
                {s.done && <Check className="absolute -right-1 -bottom-1 size-5 rounded-full bg-mint-ink p-0.5 text-white" strokeWidth={3.5} aria-hidden />}
              </span>
              <span className={cn("mt-2 text-footnote font-bold", s.done ? "text-ink-strong" : "text-ink-muted")}>{s.label}</span>
              <span className="hidden text-caption text-ink-muted sm:block">{s.sub}</span>
              <span className="sr-only">{s.done ? "concluída" : "pendente"}</span>
            </li>
          ))}
        </ol>
      </Card>

      <TabLinks label="Seções do paciente" tabs={tabs} active={tab} />

      {/* ------------------------------------------------ RESUMO */}
      {tab === "resumo" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader title="Identificação" icon={IdCard} tone="lilac" />
            <dl className="grid gap-x-6 gap-y-3 px-5 pb-5 sm:grid-cols-2">
              <Info label="Nº do prontuário" value={patient.record_number ? String(patient.record_number).padStart(6, "0") : "—"} />
              <Info label="Abertura" value={patient.record_opened_at ? fmtDate(patient.record_opened_at) : fmtDate(patient.created_at)} />
              <Info label="Nascimento" value={`${fmtDate(patient.birth_date)} (${age(patient.birth_date)})`} />
              <Info label="Raça/cor" value={RACE[patient.race_color ?? ""] ?? "Não informado"} />
              <Info label="Sexo" value={patient.sex ? patient.sex.replace("_", " ") : "Não informado"} />
              <Info label="Nome da mãe" value={patient.mother_name} />
              <Info label="CPF" value={maskCpf(patient.cpf) ?? "—"} />
              <Info icon={HeartHandshake} label={`Responsável${patient.guardian_relationship ? ` (${patient.guardian_relationship})` : ""}`} value={patient.guardian_name ?? "—"} />
              <Info label="CNS do responsável" value={maskCns(patient.guardian_cns) ?? "—"} />
              <Info label="Nascimento do responsável" value={patient.guardian_birth_date ? fmtDate(patient.guardian_birth_date) : "—"} />
              <Info icon={Phone} label="Telefone do paciente" value={patient.phone ?? "—"} />
              <Info icon={Phone} label="Contato do responsável" value={patient.guardian_phone ? <a className="text-lilac-ink underline-offset-2 hover:underline" href={`tel:${patient.guardian_phone.replace(/\D/g, "")}`}>{patient.guardian_phone}</a> : "—"} />
              <Info icon={Home} label="Endereço" value={[patient.address, patient.neighborhood].filter(Boolean).join(" · ") || "—"} />
              <Info label="Município/UF" value={`${patient.municipality ?? "Crateús"}/${patient.state ?? "CE"}${patient.zone ? ` · zona ${patient.zone}` : ""}`} />
              <Info label="APS de referência" value={patient.aps_reference ?? "—"} />
              <Info icon={School} label="Escola" value={[patient.school_name, patient.school_grade, SHIFT[patient.school_shift ?? ""]].filter(Boolean).join(" · ") || "—"} />
              <Info label="Cadastrado" value={`${fmtDate(patient.created_at)} · ${fromNow(patient.created_at)}`} />
            </dl>
          </Card>

          <div className="space-y-6">
            {clinical && (
              <ClinicalInfoCard
                patientId={id}
                hypothesis={(clinicalInfo.data as { diagnostic_hypothesis: string | null } | null)?.diagnostic_hypothesis ?? ""}
                medications={(clinicalInfo.data as { medications: string | null } | null)?.medications ?? ""}
                updatedAt={(clinicalInfo.data as { updated_at: string } | null)?.updated_at ?? null}
              />
            )}
            <Card>
              <CardHeader title="Filas e acompanhamentos" icon={ListOrdered} tone="sun" action={<Link href="/fila" className="text-footnote font-semibold text-lilac-ink hover:underline">Ver filas</Link>} />
              <ul className="space-y-2 px-5 pb-5">
                {activeQueues.length === 0 && <li className="text-callout text-ink-muted">Nenhuma fila ativa.</li>}
                {activeQueues.map((e) => (
                  <li key={e.id} className="rounded-[16px] bg-surface-2/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ServiceChip name={e.service_name} color={e.service_color} size="sm" />
                      <span className="font-bold text-ink-strong">{e.specialty_name}</span>
                      <span className="ml-auto"><QueueStatusBadge status={e.status} size="sm" /></span>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-footnote text-ink-muted">
                      <PriorityBadge priority={e.priority} short size="sm" />
                      {e.status === "aguardando" ? <>Posição <b className="text-ink-strong">{e.queue_position}º</b> · aguardando há {e.wait_days} dias</> : <>Em acompanhamento desde {fmtDate(e.started_at ?? e.entered_at)}</>}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Próximos atendimentos" icon={CalendarDays} tone="mint" action={<Link href={`${base}?aba=agenda`} className="text-footnote font-semibold text-lilac-ink hover:underline">Agenda completa</Link>} />
              <ul className="divide-y divide-line px-5 pb-3">
                {upcoming.length === 0 && <li className="pb-3 text-callout text-ink-muted">Nenhum atendimento agendado.</li>}
                {upcoming.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="w-16 shrink-0 text-center">
                      <p className="text-caption font-bold text-ink-muted uppercase">{fmtRelativeDay(a.scheduled_for)}</p>
                      <p className="text-headline font-extrabold text-ink-strong tabular">{fmtTime(a.scheduled_for)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-strong">{a.specialty_name ?? "Atendimento"} · {a.professional_name}</p>
                      <ServiceChip name={a.service_name} color={a.service_color} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {clinical && (
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <IconBubble icon={Flag} tone="peach" size="sm" />
                  <h2 className="flex-1 text-headline font-bold">Plano de cuidado</h2>
                  <Link href={`${base}?aba=plano`} className="text-footnote font-semibold text-lilac-ink hover:underline">Abrir</Link>
                </div>
                {activePlan ? (
                  <>
                    <p className="mt-3 font-semibold text-ink-strong">{activePlan.goal}</p>
                    <p className="text-footnote text-ink-muted">Referência: {svcById[activePlan.reference_service_id]?.name} · {activePlan.items.filter((i) => i.status === "concluido").length}/{activePlan.items.length} passos concluídos</p>
                  </>
                ) : <p className="mt-3 text-callout text-ink-muted">Sem plano ativo.</p>}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ LINHA DO TEMPO */}
      {tab === "jornada" && clinical && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por serviço">
              <Link href={`${base}?aba=jornada`} scroll={false} className={cn("rounded-full px-3 py-1.5 text-footnote font-semibold", !serviceFilter ? "bg-primary text-white" : "bg-surface-2 text-ink")}>Todos os serviços</Link>
              {ref.services.filter((s) => evs.some((e) => e.service_id === s.id)).map((s) => (
                <Link key={s.id} href={`${base}?aba=jornada&servico=${s.id}`} scroll={false} className={cn("rounded-full", serviceFilter === s.id && "ring-2 ring-primary")}>
                  <ServiceChip name={s.name} color={s.color} />
                </Link>
              ))}
            </div>
            <Timeline events={evs.filter((e) => !serviceFilter || e.service_id === serviceFilter)} svcById={svcById} />
          </Card>
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-headline font-bold">Adicionar anotação</h2>
              <p className="mb-3 text-footnote text-ink-muted">Registros não podem ser apagados. Correções geram nova versão.</p>
              <NoteForm patientId={id} />
            </Card>
            <Card className="p-5">
              <h2 className="text-headline font-bold">Resumo da jornada</h2>
              <ul className="mt-3 space-y-2 text-callout">
                <li className="flex justify-between"><span className="text-ink-muted">Serviços envolvidos</span><b className="tabular">{new Set(evs.map((e) => e.service_id).filter(Boolean)).size}</b></li>
                <li className="flex justify-between"><span className="text-ink-muted">Atendimentos realizados</span><b className="tabular">{appts.filter((a) => a.status === "presente").length}</b></li>
                <li className="flex justify-between"><span className="text-ink-muted">Faltas</span><b className="tabular">{appts.filter((a) => a.status.startsWith("falta")).length}</b></li>
                <li className="flex justify-between"><span className="text-ink-muted">Último registro</span><b>{evs[0] ? fromNow(evs[0].created_at) : "—"}</b></li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ PLANO */}
      {tab === "plano" && clinical && (
        <CarePlanPanel
          patientId={id}
          plan={activePlan}
          history={planList.filter((p) => p.status !== "ativo")}
          services={ref.services}
          staff={ref.staff}
          defaultServiceId={profile.service_id ?? activeQueues[0]?.service_id ?? ref.services[0]?.id}
        />
      )}

      {/* ------------------------------------------------ AGENDA */}
      {tab === "agenda" && (
        <Card className="overflow-hidden">
          <CardHeader title="Histórico de atendimentos" icon={CalendarDays} tone="mint" subtitle={`${appts.filter((a) => a.status === "presente").length} presenças · ${appts.filter((a) => a.status.startsWith("falta")).length} faltas`} />
          {appts.length === 0 ? <EmptyState title="Nenhum atendimento ainda" /> : (
            <ul className="divide-y divide-line">
              {[...upcoming, ...appts.filter((a) => !upcoming.includes(a))].map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="w-28 shrink-0">
                    <p className="font-bold text-ink-strong tabular">{fmtDate(a.scheduled_for)}</p>
                    <p className="text-footnote text-ink-muted tabular">{fmtTime(a.scheduled_for)} · {a.duration_minutes} min</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-strong">{a.specialty_name ?? "Atendimento"} · {a.professional_name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <ServiceChip name={a.service_name} color={a.service_color} size="sm" />
                      {a.absence_reason && <span className="text-caption text-ink-muted">Motivo: {a.absence_reason}</span>}
                      {a.cancel_reason && <span className="text-caption text-ink-muted">{a.cancel_reason}</span>}
                    </div>
                  </div>
                  <AppointmentStatusBadge status={a.status} size="sm" />
                  {clinical && (a.status === "presente" || a.status === "agendado") && (
                    <Button asChild size="sm" variant="secondary"><Link href={`/atendimentos/${a.id}`}>{a.has_session_record ? "Ver registro" : "Registrar"}</Link></Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ------------------------------------------------ ENCAMINHAMENTOS */}
      {tab === "encaminhamentos" && clinical && (
        <Card className="overflow-hidden">
          <CardHeader title="Encaminhamentos" icon={Send} tone="lilac" />
          {refs.length === 0 ? <EmptyState title="Nenhum encaminhamento" description="Use o botão Encaminhar no topo da página." /> : (
            <ul className="divide-y divide-line">
              {refs.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ServiceChip name={svcById[r.origin_service_id]?.name} color={svcById[r.origin_service_id]?.color} size="sm" />
                    <span aria-hidden className="text-ink-muted">→</span>
                    <span className="sr-only">para</span>
                    <ServiceChip name={svcById[r.destination_service_id]?.name} color={svcById[r.destination_service_id]?.color} size="sm" />
                    {r.specialty_id && <span className="font-semibold text-ink-strong">{ref.specialties.find((s) => s.id === r.specialty_id)?.name}</span>}
                    <PriorityBadge priority={r.priority} short size="sm" />
                    <span className="ml-auto"><ReferralStatusBadge status={r.status} size="sm" /></span>
                  </div>
                  <p className="mt-2 text-callout text-ink">{r.reason}</p>
                  {r.complement_notes && <p className="mt-1 text-footnote text-ink-muted"><b>Complemento:</b> {r.complement_notes}</p>}
                  {r.response_notes && <p className="mt-1 text-footnote text-ink-muted"><b>Resposta:</b> {r.response_notes}</p>}
                  <p className="mt-1 text-caption text-ink-muted">Enviado em {fmtDateTime(r.created_at)}{r.responded_at ? ` · respondido em ${fmtDateTime(r.responded_at)}` : r.status === "pendente" ? ` · aguardando há ${daysSince(r.created_at)} dias` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ------------------------------------------------ ALERTAS */}
      {tab === "alertas" && clinical && (
        <Card className="overflow-hidden">
          <CardHeader title="Alertas do cuidado" icon={AlertTriangle} tone="rose" subtitle="Alertas apoiam a equipe, mas nunca substituem a decisão profissional." />
          {alertList.length === 0 ? <EmptyState celebrate title="Nenhum alerta" /> : (
            <ul className="divide-y divide-line">
              {alertList.map((a) => (
                <li key={a.id} className={cn("px-5 py-4", a.status === "revisado" && "opacity-70")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={a.severity} size="sm" />
                    <span className="font-bold text-ink-strong">{a.title ?? ALERT_CODE_LABEL[a.code ?? ""]}</span>
                    <Badge size="sm">{a.code}</Badge>
                    <span className="ml-auto text-caption text-ink-muted">{fmtDate(a.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-callout">{a.reason}</p>
                  {a.status === "revisado" ? (
                    <p className="mt-1 text-footnote text-mint-ink"><Check className="inline size-4" /> Revisado: {a.review_notes}</p>
                  ) : (
                    <p className="mt-1 text-footnote text-ink-muted"><Sparkles className="inline size-4" /> {a.action_recommended} <Link className="font-semibold text-lilac-ink hover:underline" href="/alertas">Revisar</Link></p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

const RACE: Record<string, string> = { branca: "Branca", preta: "Preta", parda: "Parda", amarela: "Amarela", indigena: "Indígena", nao_informado: "Não informado" };
const SHIFT: Record<string, string> = { manha: "manhã", tarde: "tarde", noite: "noite", integral: "integral" };

function Info({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-caption font-semibold tracking-wide text-ink-muted uppercase">{Icon && <Icon className="size-3.5" />}{label}</dt>
      <dd className="mt-0.5 break-words text-callout font-semibold text-ink-strong">{value}</dd>
    </div>
  );
}

const STAGE_STYLE: Record<string, { tone: string; label: string }> = {
  entrada: { tone: "rose", label: "Entrada" },
  triagem: { tone: "peach", label: "Triagem" },
  fila: { tone: "sun", label: "Fila" },
  atendimento: { tone: "mint", label: "Atendimento" },
  continuidade: { tone: "lilac", label: "Continuidade" },
  alerta: { tone: "rose", label: "Alerta" },
  nota: { tone: "ink", label: "Anotação" },
};

function Timeline({ events, svcById }: { events: EventRow[]; svcById: Record<string, { name: string; color: string | null }> }) {
  if (!events.length) return <EmptyState title="Sem eventos" description="Nenhum registro para este filtro." />;
  const groups = new Map<string, EventRow[]>();
  for (const e of events) {
    const k = new Date(e.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Fortaleza" });
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([month, list]) => (
        <section key={month}>
          <h3 className="mb-3 inline-block rounded-full bg-surface-2 px-3 py-1 text-footnote font-bold text-ink-muted first-letter:uppercase">{month}</h3>
          <ol className="relative space-y-3 border-l-2 border-line pl-6">
            {list.map((e) => {
              const st = STAGE_STYLE[e.stage ?? "nota"] ?? STAGE_STYLE.nota;
              const svc = e.service_id ? svcById[e.service_id] : null;
              return (
                <li key={e.id} className="relative">
                  <span aria-hidden className="absolute top-3 -left-[33px] size-4 rounded-full border-[3px] border-surface" style={{ background: `var(--color-${st.tone === "ink" ? "ink-faint" : st.tone})` }} />
                  <div className="rounded-[16px] bg-surface-2/60 px-4 py-3 transition hover:bg-surface-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-caption font-bold tracking-wide text-ink-muted uppercase">{st.label}</span>
                      {svc && <ServiceChip name={svc.name} color={svc.color} size="sm" />}
                      <time className="ml-auto text-caption text-ink-muted tabular" dateTime={e.created_at}>{fmtDateTime(e.created_at)}</time>
                    </div>
                    <p className="mt-1 text-callout font-semibold text-ink-strong">{e.description}</p>
                    {e.author && <p className="text-caption text-ink-muted">por {e.author.full_name}{e.author.job_title ? ` · ${e.author.job_title}` : ""}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

type QueueRow = { id: string; service_id: string; service_name: string; service_color: string | null; specialty_name: string; specialty_id: string | null; priority: Priority; status: QueueStatus; entered_at: string; started_at: string | null; wait_days: number; queue_position: number | null; rank_reason: string; origin: string; priority_justification: string | null };
export type AgendaRow = { id: string; patient_id: string; patient_name: string; patient_birth_date: string; guardian_name: string | null; guardian_phone: string | null; service_id: string; service_name: string; service_code: string; service_color: string | null; professional_id: string; professional_name: string; specialty_id: string | null; specialty_name: string | null; scheduled_for: string; duration_minutes: number; status: AppointmentStatus; absence_reason: string | null; cancel_reason: string | null; rescheduled_from_id: string | null; queue_entry_id: string | null; attendance_marked_at: string | null; has_session_record: boolean };
type EventRow = { id: string; event_type: string; description: string; stage: string | null; created_at: string; service_id: string | null; author: { full_name: string; job_title: string | null } | null };
type ReferralRow = { id: string; origin_service_id: string; destination_service_id: string; specialty_id: string | null; priority: Priority; status: ReferralStatus; reason: string; response_notes: string | null; complement_notes: string | null; created_at: string; responded_at: string | null; due_at: string | null };
export type PlanRow = { id: string; goal: string; status: string; review_due_at: string | null; created_at: string; reference_service_id: string; coordinator: { full_name: string } | null; items: { id: string; description: string; status: "pendente" | "em_andamento" | "concluido"; due_date: string | null; service_id: string | null; completed_at: string | null; responsible: { full_name: string } | null }[] };
type AlertRow = { id: string; code: string | null; title: string | null; reason: string | null; action_recommended: string | null; severity: "atencao" | "critico"; status: "pendente" | "revisado"; created_at: string; reviewed_at: string | null; review_notes: string | null };
type TriageRow = { id: string };
