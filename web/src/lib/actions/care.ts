"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/utils";
import { localInputToIso } from "@/lib/format";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function rpc<T>(fn: string, args: Record<string, unknown>, paths: string[] = []): Promise<ActionResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendlyError(error) };
  paths.forEach((p) => revalidatePath(p, p.includes("[") ? "page" : undefined));
  return { ok: true, data: data as T };
}

const uuid = z.string().uuid("Seleção inválida.");
const priority = z.enum(["P1", "P2", "P3"]);
const parse = <S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> | { __error: string } => {
  const r = schema.safeParse(input);
  return r.success ? r.data : { __error: r.error.issues[0].message };
};
const bad = (x: unknown): x is { __error: string } => typeof x === "object" && x !== null && "__error" in x;

// ------------------------------------------------------------ Pacientes
const patientSchema = z.object({
  full_name: z.string().trim().min(5, "Informe o nome completo."),
  social_name: z.string().trim().optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento.").refine((d) => new Date(d) <= new Date(), "A data de nascimento não pode estar no futuro."),
  mother_name: z.string().trim().min(5, "Informe o nome da mãe (ou 'Não declarado')."),
  sex: z.enum(["feminino", "masculino", "intersexo", "nao_informado"]).optional(),
  cns: z.string().optional().refine((v) => !v || v.replace(/\D/g, "").length === 15, "O CNS tem 15 dígitos."),
  cpf: z.string().optional().refine((v) => !v || v.replace(/\D/g, "").length === 11, "O CPF tem 11 dígitos."),
  guardian_name: z.string().trim().optional(),
  guardian_phone: z.string().trim().optional(),
  guardian_relationship: z.string().trim().optional(),
  aps_reference: z.string().trim().optional(),
  address: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  school_name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  race_color: z.enum(["branca", "preta", "parda", "amarela", "indigena", "nao_informado"]).optional(),
  guardian_cns: z.string().optional().refine((v) => !v || v.replace(/\D/g, "").length === 15, "O CNS do responsável tem 15 dígitos."),
  guardian_birth_date: z.string().optional(),
  municipality: z.string().trim().optional(),
  state: z.string().trim().max(2).optional(),
  zone: z.enum(["urbana", "rural"]).optional(),
  school_grade: z.string().trim().optional(),
  school_shift: z.enum(["manha", "tarde", "noite", "integral"]).optional(),
  diagnostic_hypothesis: z.string().trim().optional(),
});

export async function createPatient(input: z.infer<typeof patientSchema>) {
  const p = parse(patientSchema, input);
  if (bad(p)) return { ok: false, error: p.__error } as ActionResult<string>;
  return rpc<string>("create_patient", { p_data: p }, ["/pacientes"]);
}

export async function checkDuplicates(input: { full_name: string; birth_date: string; mother_name: string; cns?: string; cpf?: string }) {
  if (input.full_name.trim().length < 3) return { ok: true, data: [] } as ActionResult<DuplicateHit[]>;
  return rpc<DuplicateHit[]>("check_patient_duplicates", {
    p_full_name: input.full_name, p_birth_date: input.birth_date || null, p_mother_name: input.mother_name || "",
    p_cns: input.cns || null, p_cpf: input.cpf || null,
  });
}
export type DuplicateHit = { id: string; full_name: string; birth_date: string; mother_name: string; cns: string | null; score: number; reasons: string[] };

export async function updatePatientContact(patientId: string, input: { guardian_name?: string; guardian_phone?: string; guardian_relationship?: string; address?: string; neighborhood?: string; school_name?: string; aps_reference?: string; social_name?: string }) {
  const supabase = await createClient();
  const clean = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v?.trim() || null]));
  const { error } = await supabase.from("patients").update(clean).eq("id", patientId);
  if (error) return { ok: false, error: friendlyError(error) } as ActionResult;
  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true } as ActionResult;
}

export async function resolveDuplicate(candidateId: string, decision: "confirmado" | "rejeitado", keepPatientId: string | null, notes: string) {
  return rpc("resolve_duplicate", { p_candidate: candidateId, p_decision: decision, p_keep_patient: keepPatientId, p_notes: notes || null }, ["/duplicidades", "/alertas", "/pacientes"]);
}

export async function saveClinicalInfo(patientId: string, hypothesis: string, medications: string) {
  return rpc("save_clinical_info", { p_patient: patientId, p_hypothesis: hypothesis, p_medications: medications }, [`/pacientes/${patientId}`]);
}

export async function logSensitiveRead(resource: string, resourceId: string) {
  const supabase = await createClient();
  await supabase.rpc("log_access", { p_action: "sensitive.read", p_resource: resource, p_resource_id: resourceId });
}

// ------------------------------------------------------------ Triagem e fila
const triageSchema = z.object({
  patient_id: uuid, service_id: uuid, specialty_id: uuid, priority,
  need: z.string().trim().min(5, "Descreva a necessidade."),
  justification: z.string().trim().min(10, "Justifique a prioridade (mínimo de 10 caracteres)."),
  notes: z.string().trim().optional(),
  add_to_queue: z.boolean().default(true),
});

export async function createTriage(input: z.input<typeof triageSchema>) {
  const t = parse(triageSchema, input);
  if (bad(t)) return { ok: false, error: t.__error } as ActionResult<{ triage_id: string; queue_entry_id: string | null }>;
  return rpc<{ triage_id: string; queue_entry_id: string | null }>("create_triage", {
    p_patient: t.patient_id, p_service: t.service_id, p_specialty: t.specialty_id, p_priority: t.priority,
    p_need: t.need, p_justification: t.justification, p_notes: t.notes || null, p_add_to_queue: t.add_to_queue,
  }, ["/fila", "/triagem", `/pacientes/${t.patient_id}`]);
}

export async function updateQueueStatus(entryId: string, status: "aguardando" | "em_atendimento" | "concluido" | "cancelado", reason?: string) {
  return rpc("update_queue_status", { p_entry: entryId, p_status: status, p_reason: reason || null }, ["/fila"]);
}

export async function updateQueuePriority(entryId: string, p: "P1" | "P2" | "P3", justification: string) {
  return rpc("update_queue_priority", { p_entry: entryId, p_priority: p, p_justification: justification }, ["/fila"]);
}

// ------------------------------------------------------------ Agenda e atendimento
const scheduleSchema = z.object({
  patient_id: uuid, service_id: uuid, professional_id: uuid, specialty_id: uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
  duration: z.coerce.number().min(10).max(480).default(50),
  queue_entry_id: z.string().uuid().nullish(),
  objective: z.string().trim().optional(),
});

export async function scheduleAppointment(input: z.input<typeof scheduleSchema>) {
  const s = parse(scheduleSchema, input);
  if (bad(s)) return { ok: false, error: s.__error } as ActionResult<string>;
  return rpc<string>("schedule_appointment", {
    p_patient: s.patient_id, p_service: s.service_id, p_professional: s.professional_id, p_specialty: s.specialty_id,
    p_when: localInputToIso(s.date, s.time), p_duration: s.duration, p_queue_entry: s.queue_entry_id ?? null, p_objective: s.objective || null,
  }, ["/agenda", "/fila", `/pacientes/${s.patient_id}`]);
}

export async function rescheduleAppointment(id: string, date: string, time: string, reason: string) {
  if (!date || !time) return { ok: false, error: "Escolha a nova data e o horário." } as ActionResult<string>;
  return rpc<string>("reschedule_appointment", { p_appointment: id, p_when: localInputToIso(date, time), p_reason: reason }, ["/agenda"]);
}

export async function cancelAppointment(id: string, reason: string) {
  return rpc("cancel_appointment", { p_appointment: id, p_reason: reason }, ["/agenda"]);
}

export async function markAttendance(id: string, status: "presente" | "falta_justificada" | "falta_injustificada" | "agendado", reason?: string) {
  return rpc("mark_attendance", { p_appointment: id, p_status: status, p_reason: reason || null }, ["/agenda", "/inicio"]);
}

export async function recordSession(id: string, objective: string, summary: string, evolution: string) {
  return rpc<number>("record_session", { p_appointment: id, p_objective: objective, p_summary: summary, p_evolution: evolution }, ["/agenda", `/atendimentos/${id}`]);
}

// ------------------------------------------------------------ Encaminhamentos
const referralSchema = z.object({
  patient_id: uuid, origin_service_id: uuid, destination_service_id: uuid,
  specialty_id: z.string().uuid().nullish(), priority,
  reason: z.string().trim().min(10, "Descreva o motivo (mínimo de 10 caracteres)."),
});

export async function createReferral(input: z.input<typeof referralSchema>) {
  const r = parse(referralSchema, input);
  if (bad(r)) return { ok: false, error: r.__error } as ActionResult<string>;
  return rpc<string>("create_referral", {
    p_patient: r.patient_id, p_origin: r.origin_service_id, p_destination: r.destination_service_id,
    p_specialty: r.specialty_id ?? null, p_reason: r.reason, p_priority: r.priority,
  }, ["/encaminhamentos", `/pacientes/${r.patient_id}`]);
}

export async function respondReferral(id: string, action: "aceito" | "devolvido" | "complemento_solicitado", notes: string, addToQueue = true) {
  return rpc<{ queue_entry_id: string | null }>("respond_referral", { p_referral: id, p_action: action, p_notes: notes || null, p_add_to_queue: addToQueue }, ["/encaminhamentos", "/fila"]);
}

export async function resubmitReferral(id: string, complement: string) {
  return rpc("resubmit_referral", { p_referral: id, p_complement: complement }, ["/encaminhamentos"]);
}

// ------------------------------------------------------------ Plano compartilhado e jornada
export async function createCarePlan(patientId: string, serviceId: string, goal: string, reviewDue: string | null) {
  return rpc<string>("create_care_plan", { p_patient: patientId, p_reference_service: serviceId, p_goal: goal, p_review_due: reviewDue || null }, [`/pacientes/${patientId}`]);
}

export async function addCarePlanItem(planId: string, patientId: string, input: { description: string; service_id: string | null; responsible_id: string | null; due_date: string | null }) {
  return rpc<string>("add_care_plan_item", {
    p_plan: planId, p_description: input.description, p_service: input.service_id || null, p_responsible: input.responsible_id || null, p_due: input.due_date || null,
  }, [`/pacientes/${patientId}`]);
}

export async function updateCarePlanItem(itemId: string, patientId: string, status: "pendente" | "em_andamento" | "concluido") {
  return rpc("update_care_plan_item", { p_item: itemId, p_status: status }, [`/pacientes/${patientId}`]);
}

export async function closeCarePlan(planId: string, patientId: string) {
  return rpc("close_care_plan", { p_plan: planId }, [`/pacientes/${patientId}`]);
}

export async function addJourneyNote(patientId: string, text: string) {
  return rpc<string>("add_journey_note", { p_patient: patientId, p_description: text }, [`/pacientes/${patientId}`]);
}

// ------------------------------------------------------------ Alertas
export async function reviewAlert(id: string, notes: string) {
  return rpc("review_alert", { p_alert: id, p_notes: notes }, ["/alertas", "/inicio"]);
}

export async function refreshAlerts() {
  return rpc<number>("refresh_care_alerts", {});
}
