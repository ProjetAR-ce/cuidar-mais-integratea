/**
 * Popula o Supabase com dados 100% fictícios para demonstração (RN-014).
 *
 *   npx tsx scripts/seed.ts          → só roda se ainda não houver pacientes
 *   npx tsx scripts/seed.ts --force  → roda mesmo assim (acrescenta dados)
 *
 * Usa SUPABASE_SECRET_KEY: rode apenas na sua máquina.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

process.loadEnvFile(".env.local");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DEMO_PASSWORD = "Cuidar+2026";
const DAY = 86_400_000;
const NOW = Date.now();

// ---------------------------------------------------------------- aleatório determinístico
let seed = 20260916;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;

// Fortaleza = UTC-3
function localDate(daysFromToday: number, hour: number, minute = 0) {
  const today = new Date(NOW - 3 * 3600_000);
  const d = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysFromToday, hour + 3, minute);
  return new Date(d);
}
const iso = (d: Date | number) => new Date(d).toISOString();
const isWeekend = (d: Date) => {
  const wd = new Date(d.getTime() - 3 * 3600_000).getUTCDay();
  return wd === 0 || wd === 6;
};

// ---------------------------------------------------------------- documentos válidos
function cns() {
  for (;;) {
    const d = [pick([7, 8, 9])];
    for (let i = 0; i < 13; i++) d.push(int(0, 9));
    const sum = d.reduce((s, x, i) => s + x * (15 - i), 0);
    const last = (11 - (sum % 11)) % 11;
    if (last < 10) return [...d, last].join("");
  }
}
function cpf() {
  const d = Array.from({ length: 9 }, () => int(0, 9));
  for (const len of [9, 10]) {
    const s = d.slice(0, len).reduce((acc, x, i) => acc + x * (len + 1 - i), 0);
    const r = (s * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d.join("");
}

// ---------------------------------------------------------------- nomes fictícios
const GIRLS = ["Ana Beatriz", "Laura", "Helena", "Alice", "Manuela", "Valentina", "Sophia", "Isabela", "Lívia", "Giovanna", "Cecília", "Heloísa", "Luíza", "Yasmin", "Clara", "Lorena", "Ana Júlia", "Rebeca", "Esther", "Maitê"];
const BOYS = ["Pedro Henrique", "Miguel", "Arthur", "Heitor", "Davi", "Gabriel", "Bernardo", "Samuel", "Enzo", "Rafael", "Theo", "Lorenzo", "Benício", "Nicolas", "Guilherme", "Matheus", "Isaac", "Caio", "Luiz Felipe", "Otávio", "Bento", "Joaquim", "Emanuel", "Davi Lucca"];
const SURNAMES = ["Silva", "Souza", "Oliveira", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araújo", "Ribeiro", "Gomes", "Martins", "Rocha", "Barbosa", "Freitas", "Cavalcante", "Bezerra", "Holanda", "Mota", "Sampaio", "Farias", "Teixeira", "Moreira", "Pinheiro", "Loiola", "Mourão", "Veras", "Magalhães"];
const MOTHERS = ["Francisca", "Antônia", "Raimunda", "Luciana", "Patrícia", "Juliana", "Adriana", "Cristiane", "Fernanda", "Jéssica", "Aline", "Débora", "Sabrina", "Tatiane", "Kelly", "Márcia", "Rosângela", "Sandra", "Camila", "Priscila", "Maria José", "Eliane"];
const NEIGHBORHOODS = ["Centro", "São Vicente", "Fátima", "Venâncios", "Planalto", "Campo Velho", "Altamira", "Maratoan", "Cidade Nova", "Nova Terra", "Morada do Sol", "Vila Holanda"];
const SCHOOLS = ["Escola Municipal Aurora", "Escola Municipal Sol Nascente", "Escola Municipal Caminhos do Saber", "CEI Pequenos Passos", "Escola Municipal Horizonte", "CEI Arco-Íris"];
const RELATIONS = ["Mãe", "Mãe", "Mãe", "Pai", "Avó", "Tia"];

// ---------------------------------------------------------------- textos de apoio (não diagnósticos)
const NEEDS: Record<string, string[]> = {
  FONO: ["Comunicação verbal reduzida para a idade", "Dificuldade de compreender comandos simples", "Família relata fala pouco funcional"],
  TO: ["Dificuldades nas atividades de vida diária", "Sensibilidade sensorial intensa na rotina", "Precisa de apoio na alimentação e no vestir"],
  PSICO: ["Crises frequentes na rotina escolar", "Família pede apoio para manejo de comportamentos", "Ansiedade em mudanças de rotina"],
  NEUROPED: ["Avaliação neurológica solicitada pela equipe", "Acompanhamento do desenvolvimento neuropsicomotor", "Revisão de acompanhamento especializado"],
  PSIQ: ["Avaliação de irritabilidade e sono", "Acompanhamento em saúde mental infantojuvenil"],
  PSICOPED: ["Dificuldades na alfabetização", "Escola pede apoio para adaptação de atividades"],
  FISIO: ["Atraso motor relatado pela família", "Dificuldade de equilíbrio e coordenação"],
  NUTRI: ["Seletividade alimentar importante", "Família pede orientação sobre alimentação"],
  SERV_SOCIAL: ["Família precisa de orientação sobre benefícios", "Dificuldade de transporte para os atendimentos"],
  AEE: ["Plano de atendimento educacional especializado", "Adaptação curricular na sala regular"],
  MUSICO: ["Interesse por música como forma de interação", "Oficina de expressão e convivência"],
  EDFIS: ["Atividade física adaptada e socialização", "Coordenação motora em atividades em grupo"],
};
const GOALS = ["Ampliar a comunicação funcional em casa e na escola", "Fortalecer a autonomia nas atividades de vida diária", "Garantir a continuidade do cuidado entre saúde e educação", "Apoiar a família na organização da rotina", "Favorecer a participação nas atividades escolares"];
const STEPS = ["Reavaliar metas com a família", "Enviar relatório para a escola", "Agendar retorno com neuropediatria", "Visita domiciliar para conhecer a rotina", "Orientar a família sobre o BPC", "Reunião com a equipe da escola", "Revisar a frequência dos atendimentos"];
const SUMMARIES = [
  "Atividade lúdica estruturada com boa participação. Família orientada sobre continuidade em casa.",
  "Sessão com foco na rotina visual. Houve engajamento na maior parte do tempo, com pausas combinadas.",
  "Trabalhadas trocas comunicativas com apoio de figuras. Mãe participou dos últimos 10 minutos.",
  "Atividade sensorial com boa regulação ao final. Combinado registro da semana pela família.",
  "Retomadas metas do plano. Evolução positiva na espera da vez em jogos.",
  "Sessão em grupo com participação ativa. Orientações repassadas ao responsável.",
];
const OBJECTIVES = ["Ampliar trocas comunicativas", "Trabalhar rotina e previsibilidade", "Fortalecer autonomia em atividades diárias", "Favorecer regulação sensorial", "Apoiar a participação em grupo"];

// ---------------------------------------------------------------- tipos
type Row = Record<string, unknown>;
const out = {
  patients: [] as Row[],
  triages: [] as Row[],
  referrals: [] as Row[],
  queue_entries: [] as Row[],
  appointments: [] as Row[],
  care_plans: [] as Row[],
  care_plan_items: [] as Row[],
};

async function insertAll(table: keyof typeof out, rows: Row[], chunk = 250) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table}: ${error.message} ${error.details ?? ""}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

async function main() {
  const force = process.argv.includes("--force");
  const { count } = await sb.from("patients").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0 && !force) {
    console.log(`Já existem ${count} pacientes. Use --force para acrescentar mais dados.`);
    return;
  }

  // ------------------------------------------------------------ referência
  const { data: services } = await sb.from("services").select("id, code, name");
  const { data: specialties } = await sb.from("specialties").select("id, code, name");
  const { data: offers } = await sb.from("service_specialties").select("service_id, specialty_id, monthly_capacity");
  const svc = Object.fromEntries(services!.map((s) => [s.code, s]));
  const spc = Object.fromEntries(specialties!.map((s) => [s.code, s]));
  const spById = Object.fromEntries(specialties!.map((s) => [s.id, s]));
  const offerList = offers!.map((o) => ({
    service: services!.find((s) => s.id === o.service_id)!.code as string,
    specialty: spById[o.specialty_id].code as string,
  }));

  // ------------------------------------------------------------ usuários
  console.log("Usuários de demonstração");
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    data.users.forEach((u) => existing.set(u.email!, u.id));
    if (data.users.length < 200) break;
  }

  type Staff = { id: string; email: string; name: string; role: string; service?: string; specialty?: string; title?: string };
  const STAFF: Omit<Staff, "id">[] = [
    { email: "admin@cuidarmais.demo", name: "Helena Rocha", role: "admin", title: "Administradora do sistema" },
    { email: "recepcao@cuidarmais.demo", name: "Maria Silva", role: "recepcao", service: "NASF", title: "Recepção" },
    { email: "recepcao.creaes@cuidarmais.demo", name: "Antônio Carvalho", role: "recepcao", service: "CREAES", title: "Recepção" },
    { email: "coordenacao@cuidarmais.demo", name: "Rafael Martins", role: "coordenacao", title: "Coordenação da rede TEA" },
    { email: "gestao@cuidarmais.demo", name: "Juliana Freitas", role: "gestao", title: "Gestão municipal" },
    { email: "profissional@cuidarmais.demo", name: "Camila Andrade", role: "profissional", service: "NASF", specialty: "FONO", title: "Fonoaudióloga" },
    { email: "aline.moraes@cuidarmais.demo", name: "Aline Moraes", role: "profissional", service: "NASF", specialty: "FONO", title: "Fonoaudióloga" },
    { email: "lucas.ribeiro@cuidarmais.demo", name: "Lucas Ribeiro", role: "profissional", service: "NASF", specialty: "PSICO", title: "Psicólogo" },
    { email: "diego.farias@cuidarmais.demo", name: "Diego Farias", role: "profissional", service: "NASF", specialty: "PSICO", title: "Psicólogo" },
    { email: "patricia.nunes@cuidarmais.demo", name: "Patrícia Nunes", role: "profissional", service: "NASF", specialty: "FISIO", title: "Fisioterapeuta" },
    { email: "renata.lopes@cuidarmais.demo", name: "Renata Lopes", role: "profissional", service: "NASF", specialty: "NUTRI", title: "Nutricionista" },
    { email: "sergio.almeida@cuidarmais.demo", name: "Sérgio Almeida", role: "profissional", service: "NASF", specialty: "SERV_SOCIAL", title: "Assistente social" },
    { email: "nape@cuidarmais.demo", name: "Fernanda Costa", role: "profissional", service: "NAPE", specialty: "PSICOPED", title: "Psicopedagoga" },
    { email: "marcos.vieira@cuidarmais.demo", name: "Marcos Vieira", role: "profissional", service: "NAPE", specialty: "AEE", title: "Professor de AEE" },
    { email: "tatiane.barros@cuidarmais.demo", name: "Tatiane Barros", role: "profissional", service: "NAPE", specialty: "AEE", title: "Professora de AEE" },
    { email: "larissa.pinto@cuidarmais.demo", name: "Larissa Pinto", role: "profissional", service: "NAPE", specialty: "FONO", title: "Fonoaudióloga" },
    { email: "creaes@cuidarmais.demo", name: "Bruno Tavares", role: "profissional", service: "CREAES", specialty: "NEUROPED", title: "Neuropediatra" },
    { email: "isabela.monteiro@cuidarmais.demo", name: "Isabela Monteiro", role: "profissional", service: "CREAES", specialty: "PSIQ", title: "Psiquiatra infantojuvenil" },
    { email: "gustavo.lima@cuidarmais.demo", name: "Gustavo Lima", role: "profissional", service: "CREAES", specialty: "TO", title: "Terapeuta ocupacional" },
    { email: "thiago.mendes@cuidarmais.demo", name: "Thiago Mendes", role: "profissional", service: "CREAES", specialty: "TO", title: "Terapeuta ocupacional" },
    { email: "priscila.gomes@cuidarmais.demo", name: "Priscila Gomes", role: "profissional", service: "CREAES", specialty: "FONO", title: "Fonoaudióloga" },
    { email: "vanessa.araujo@cuidarmais.demo", name: "Vanessa Araújo", role: "profissional", service: "CREAES", specialty: "PSICO", title: "Psicóloga" },
    { email: "casa@cuidarmais.demo", name: "Joana Freire", role: "profissional", service: "CASA_MAIS_AZUL", specialty: "MUSICO", title: "Musicoterapeuta" },
    { email: "paulo.sales@cuidarmais.demo", name: "Paulo Henrique Sales", role: "profissional", service: "CASA_MAIS_AZUL", specialty: "EDFIS", title: "Educador físico" },
    { email: "debora.castro@cuidarmais.demo", name: "Débora Castro", role: "profissional", service: "CASA_MAIS_AZUL", specialty: "TO", title: "Terapeuta ocupacional" },
    { email: "crasf@cuidarmais.demo", name: "Cláudia Pereira", role: "profissional", service: "CRASF", specialty: "SERV_SOCIAL", title: "Assistente social" },
    { email: "rodrigo.batista@cuidarmais.demo", name: "Rodrigo Batista", role: "profissional", service: "CRASF", specialty: "SERV_SOCIAL", title: "Assistente social" },
    { email: "simone.rocha@cuidarmais.demo", name: "Simone Rocha", role: "profissional", service: "CRASF", specialty: "PSICO", title: "Psicóloga" },
    { email: "responsavel@cuidarmais.demo", name: "Luciana Ferreira da Silva", role: "responsavel", title: "Responsável" },
    { email: "responsavel2@cuidarmais.demo", name: "Adriana Souza Lima", role: "responsavel", title: "Responsável" },
  ];

  const staff: Staff[] = [];
  for (const s of STAFF) {
    let id = existing.get(s.email);
    if (!id) {
      const { data, error } = await sb.auth.admin.createUser({
        email: s.email, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: { full_name: s.name, role: s.role },
      });
      if (error) throw new Error(`${s.email}: ${error.message}`);
      id = data.user.id;
    }
    const { error } = await sb.from("profiles").upsert({
      id, full_name: s.name, role: s.role, email: s.email, job_title: s.title, active: true,
      service_id: s.service ? svc[s.service].id : null,
      specialty_id: s.specialty ? spc[s.specialty].id : null,
    });
    if (error) throw new Error(`profile ${s.email}: ${error.message}`);
    staff.push({ ...s, id });
  }
  console.log(`  ${staff.length} usuários (senha: ${DEMO_PASSWORD})`);
  const byEmail = (e: string) => staff.find((s) => s.email === e)!;
  const profsFor = (service: string, specialty: string) => {
    const exact = staff.filter((s) => s.role === "profissional" && s.service === service && s.specialty === specialty);
    return exact.length ? exact : staff.filter((s) => s.role === "profissional" && s.service === service);
  };

  // ------------------------------------------------------------ agenda sem conflito
  const busy = new Set<string>();
  function slot(prof: string, day: number, preferredHour?: number, minute = 0) {
    for (let d = day; d < day + 14; d++) {
      const hours = preferredHour !== undefined && d === day ? [preferredHour] : [8, 9, 10, 11, 13, 14, 15, 16];
      const start = int(0, hours.length - 1);
      for (let k = 0; k < hours.length; k++) {
        const h = hours[(start + k) % hours.length];
        const when = localDate(d, h, preferredHour !== undefined && d === day ? minute : 0);
        if (isWeekend(when)) break;
        const key = `${prof}|${when.toISOString()}`;
        if (!busy.has(key)) { busy.add(key); return when; }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ geradores
  const usedNames = new Set<string>();
  function makePatient(opts: Partial<Row> & { createdDaysAgo: number; sex?: string }) {
    const sex = opts.sex ?? (chance(0.78) ? "masculino" : "feminino"); // TEA é mais diagnosticado em meninos
    let full = opts.full_name as string | undefined;
    const s1 = pick(SURNAMES), s2 = pick(SURNAMES);
    while (!full || usedNames.has(full)) full = `${pick(sex === "masculino" ? BOYS : GIRLS)} ${s1} ${s2}`;
    usedNames.add(full);
    const age = pick([3, 4, 5, 5, 6, 6, 7, 7, 8, 9, 10, 11, 12, 13, 14, 16]);
    const birth = new Date(NOW - age * 365.25 * DAY - int(0, 360) * DAY);
    const mother = (opts.mother_name as string) ?? `${pick(MOTHERS)} ${pick(SURNAMES)} ${full.split(" ").at(-1)}`;
    const relation = pick(RELATIONS);
    const created = new Date(NOW - opts.createdDaysAgo * DAY - int(0, 8) * 3600_000);
    const row: Row = {
      id: randomUUID(),
      full_name: full,
      birth_date: (opts.birth_date as string) ?? birth.toISOString().slice(0, 10),
      mother_name: mother,
      sex,
      cns: opts.cns !== undefined ? opts.cns : chance(0.85) ? cns() : null,
      cpf: chance(0.35) ? cpf() : null,
      guardian_name: relation === "Mãe" ? mother : `${pick(MOTHERS)} ${pick(SURNAMES)}`,
      guardian_relationship: relation,
      guardian_phone: `(88) 9${int(8100, 9999)}-${int(1000, 9999)}`,
      neighborhood: pick(NEIGHBORHOODS),
      address: `Rua ${pick(["das Flores", "José de Alencar", "Padre Anchieta", "Santos Dumont", "Coronel Zezé", "Tabelião Brasil"])}, ${int(10, 999)}`,
      aps_reference: `UBS ${pick(NEIGHBORHOODS)}`,
      school_name: age >= 3 ? pick(SCHOOLS) : null,
      created_at: iso(created),
      updated_at: iso(created),
      ...Object.fromEntries(Object.entries(opts).filter(([k]) => !["createdDaysAgo", "sex"].includes(k))),
    };
    out.patients.push(row);
    return row;
  }

  const pct = (a: number) => Math.min(a, NOW);
  function triage(patient: Row, service: string, specialty: string, atMs: number, priority?: string) {
    const prof = pick(profsFor(service, specialty));
    const pr = priority ?? pick(["P1", "P2", "P2", "P3", "P3", "P2"]);
    const need = pick(NEEDS[specialty] ?? ["Acompanhamento especializado"]);
    const t: Row = {
      id: randomUUID(), patient_id: patient.id, service_id: svc[service].id, professional_id: prof.id,
      priority: pr, specialty_id: spc[specialty].id, need_description: need,
      priority_justification: pr === "P1" ? "Prejuízo funcional importante e nenhum acompanhamento em curso." : pr === "P2" ? "Prejuízo relevante na comunicação e na rotina escolar." : "Demanda de acompanhamento sem prejuízo imediato.",
      clinical_notes: `${need}. Observações registradas na triagem com a família.`,
      created_at: iso(pct(atMs)),
    };
    out.triages.push(t);
    return t;
  }

  function queue(patient: Row, service: string, specialty: string, atMs: number, status: string, extra: Partial<Row> = {}) {
    const q: Row = {
      id: randomUUID(), patient_id: patient.id, service_id: svc[service].id, specialty: spc[specialty].name,
      specialty_id: spc[specialty].id, priority: extra.priority ?? "P2", status, origin: "triagem",
      entered_at: iso(pct(atMs)), updated_at: iso(pct(atMs)), ...extra,
    };
    out.queue_entries.push(q);
    return q;
  }

  // Sessões: do início até hoje + próximas semanas
  function sessions(
    patient: Row, service: string, specialty: string, startMs: number, queueId: string,
    opts: { every?: number; endMs?: number; future?: number; forceAbsencesAtEnd?: number; prof?: Staff } = {}
  ) {
    const prof = opts.prof ?? pick(profsFor(service, specialty));
    const every = opts.every ?? pick([7, 7, 14]);
    const end = opts.endMs ?? NOW;
    const past: Row[] = [];
    for (let t = startMs; t < end; t += every * DAY) {
      const day = Math.round((t - NOW) / DAY);
      const when = slot(prof.id, day);
      if (!when || when.getTime() > end) break;
      past.push({ when, prof });
    }
    const statuses = past.map(() => {
      const r = rand();
      return r < 0.82 ? "presente" : r < 0.9 ? "falta_injustificada" : r < 0.96 ? "falta_justificada" : "cancelado";
    });
    // evita sequências acidentais de faltas
    for (let i = 2; i < statuses.length; i++) {
      const f = (s: string) => s.startsWith("falta");
      if (f(statuses[i]) && f(statuses[i - 1]) && f(statuses[i - 2])) statuses[i] = "presente";
    }
    const n = opts.forceAbsencesAtEnd ?? 0;
    for (let i = Math.max(0, statuses.length - n); i < statuses.length; i++) statuses[i] = i % 2 ? "falta_justificada" : "falta_injustificada";

    past.forEach((p, i) => {
      const when = p.when as Date;
      const status = statuses[i];
      out.appointments.push({
        id: randomUUID(), patient_id: patient.id, service_id: svc[service].id, professional_id: prof.id,
        specialty_id: spc[specialty].id, queue_entry_id: queueId, scheduled_for: iso(when), duration_minutes: 50,
        status,
        objective: status === "presente" ? pick(OBJECTIVES) : null,
        summary: status === "presente" ? pick(SUMMARIES) : null,
        evolution_notes: status === "presente" && chance(0.4) ? "Manter a frequência atual e revisar as metas no próximo mês." : null,
        absence_reason: status === "falta_justificada" ? pick(["Criança com febre", "Sem transporte no dia", "Consulta em outro serviço", "Chuva forte no bairro"]) : null,
        cancel_reason: status === "cancelado" ? pick(["Profissional em capacitação", "Feriado municipal", "Família pediu remarcação"]) : null,
        attendance_marked_at: status === "cancelado" ? null : iso(when.getTime() + 10 * 60_000),
        attendance_marked_by: status === "cancelado" ? null : prof.id,
        created_by: prof.id,
        created_at: iso(when.getTime() - int(3, 10) * DAY),
      });
    });
    for (let k = 0; k < (opts.future ?? 2); k++) {
      const when = slot(prof.id, 1 + k * every + int(0, 2));
      if (!when) continue;
      out.appointments.push({
        id: randomUUID(), patient_id: patient.id, service_id: svc[service].id, professional_id: prof.id,
        specialty_id: spc[specialty].id, queue_entry_id: queueId, scheduled_for: iso(when), duration_minutes: 50,
        status: "agendado", created_by: prof.id, created_at: iso(NOW - int(1, 6) * DAY),
      });
    }
    return prof;
  }

  function referral(patient: Row, from: string, to: string, specialty: string | null, atMs: number, status: string, priority = "P2") {
    const origin = pick(staff.filter((s) => s.role === "profissional" && s.service === from));
    const destProf = pick(staff.filter((s) => s.role === "profissional" && s.service === to));
    const responded = status === "pendente" ? null : atMs + int(1, 6) * DAY;
    const r: Row = {
      id: randomUUID(), patient_id: patient.id, origin_service_id: svc[from].id, destination_service_id: svc[to].id,
      specialty_id: specialty ? spc[specialty].id : null, priority, status,
      reason: specialty ? `Solicitamos avaliação e acompanhamento em ${spc[specialty].name}. ${pick(NEEDS[specialty] ?? ["Demanda identificada no acompanhamento."])}.` : "Família em situação de vulnerabilidade; solicitamos acompanhamento socioassistencial.",
      response_notes: status === "devolvido" ? "Demanda não compatível com a oferta atual do serviço. Sugerimos procurar o CREAES." : status === "complemento_solicitado" ? "Pedimos o relatório escolar mais recente antes do aceite." : status === "aceito" ? "Aceito. Paciente incluído na fila." : null,
      created_by: origin.id, responded_by: responded ? destProf.id : null, responded_at: responded ? iso(pct(responded)) : null,
      due_at: iso(atMs + 7 * DAY), created_at: iso(atMs), updated_at: iso(pct(responded ?? atMs)),
    };
    out.referrals.push(r);
    return r;
  }

  function plan(patient: Row, service: string, atMs: number, coordinator: Staff, stepCount = 2) {
    const p: Row = {
      id: randomUUID(), patient_id: patient.id, reference_service_id: svc[service].id, coordinator_id: coordinator.id,
      goal: pick(GOALS), status: "ativo", review_due_at: new Date(atMs + 90 * DAY).toISOString().slice(0, 10),
      created_by: coordinator.id, created_at: iso(atMs), updated_at: iso(atMs),
    };
    out.care_plans.push(p);
    for (let i = 0; i < stepCount; i++) {
      const done = i === 0 && chance(0.6);
      const due = atMs + (20 + i * 25) * DAY;
      const svcCode = pick([service, service, "NAPE", "CREAES", "CRASF"]);
      out.care_plan_items.push({
        id: randomUUID(), plan_id: p.id, patient_id: patient.id, description: pick(STEPS), service_id: svc[svcCode].id,
        responsible_id: pick(staff.filter((s) => s.role === "profissional" && s.service === svcCode)).id,
        due_date: new Date(due).toISOString().slice(0, 10), status: done ? "concluido" : due < NOW ? "em_andamento" : "pendente",
        completed_at: done ? iso(Math.min(due - 2 * DAY, NOW)) : null, created_by: coordinator.id,
        created_at: iso(atMs + DAY), updated_at: iso(atMs + DAY),
      });
    }
    return p;
  }

  const coord = byEmail("coordenacao@cuidarmais.demo");
  const camila = byEmail("profissional@cuidarmais.demo");
  const bruno = byEmail("creaes@cuidarmais.demo");

  // ============================================================ CENÁRIOS MONTADOS
  // 1. Paciente vitrine: jornada completa em 3 serviços
  const lucas = makePatient({
    full_name: "Lucas Ferreira da Silva", mother_name: "Luciana Ferreira da Silva", sex: "masculino",
    birth_date: localDate(-6 * 365 - 120, 12).toISOString().slice(0, 10), createdDaysAgo: 200,
    responsible_id: byEmail("responsavel@cuidarmais.demo").id, guardian_name: "Luciana Ferreira da Silva", guardian_relationship: "Mãe",
    neighborhood: "São Vicente", school_name: "Escola Municipal Aurora",
  });
  {
    const t0 = new Date(lucas.created_at as string).getTime();
    const tr = triage(lucas, "NASF", "FONO", t0 + DAY, "P1");
    const q = queue(lucas, "NASF", "FONO", t0 + DAY + 600_000, "em_atendimento", { priority: "P1", triage_id: tr.id, priority_justification: tr.priority_justification, started_at: iso(t0 + 15 * DAY) });
    sessions(lucas, "NASF", "FONO", t0 + 15 * DAY, q.id as string, { every: 7, future: 0, prof: camila });
    const when = localDate(0, 8);
    busy.add(`${camila.id}|${when.toISOString()}`);
    out.appointments.push({ id: randomUUID(), patient_id: lucas.id, service_id: svc.NASF.id, professional_id: camila.id, specialty_id: spc.FONO.id, queue_entry_id: q.id, scheduled_for: iso(when), duration_minutes: 50, status: "agendado", objective: "Ampliar trocas comunicativas", created_by: camila.id, created_at: iso(NOW - 6 * DAY) });
    const ref = referral(lucas, "NASF", "CREAES", "NEUROPED", t0 + 40 * DAY, "aceito", "P2");
    const q2 = queue(lucas, "CREAES", "NEUROPED", t0 + 44 * DAY, "em_atendimento", { priority: "P2", origin: "encaminhamento", referral_id: ref.id, started_at: iso(t0 + 70 * DAY), priority_justification: "Prioridade definida no encaminhamento" });
    sessions(lucas, "CREAES", "NEUROPED", t0 + 70 * DAY, q2.id as string, { every: 45, future: 1, prof: bruno });
    const ref2 = referral(lucas, "NASF", "NAPE", "AEE", t0 + 90 * DAY, "aceito", "P2");
    const q3 = queue(lucas, "NAPE", "AEE", t0 + 92 * DAY, "em_atendimento", { origin: "encaminhamento", referral_id: ref2.id, started_at: iso(t0 + 100 * DAY) });
    sessions(lucas, "NAPE", "AEE", t0 + 100 * DAY, q3.id as string, { every: 14, future: 1 });
    referral(lucas, "NASF", "CRASF", null, NOW - 3 * DAY, "pendente", "P3");
    plan(lucas, "NASF", t0 + 45 * DAY, coord, 3);
  }

  // 2. Possíveis duplicidades (AL-01)
  const dupBase = [
    { a: "Maria Eduarda Alves", b: "Maria Eduarda Alvez", ma: "Francisca Alves", mb: "Francisca Alvez", sex: "feminino" },
    { a: "João Pedro Nascimento", b: "Joao Pedro do Nascimento", ma: "Antônia Maria Nascimento", mb: "Antonia Maria do Nascimento", sex: "masculino" },
    { a: "Heitor Bezerra Lima", b: "Heitor Bezera Lima", ma: "Raimunda Bezerra Lima", mb: "Raimunda Bezerra Lima", sex: "masculino" },
  ];
  for (const d of dupBase) {
    const first = makePatient({ full_name: d.a, mother_name: d.ma, sex: d.sex, createdDaysAgo: int(60, 150) });
    const t0 = new Date(first.created_at as string).getTime();
    const off = pick(offerList.filter((o) => o.service === "NASF"));
    const tr = triage(first, off.service, off.specialty, t0 + DAY);
    const q = queue(first, off.service, off.specialty, t0 + DAY + 1000, "em_atendimento", { priority: tr.priority, triage_id: tr.id, started_at: iso(t0 + 20 * DAY) });
    sessions(first, off.service, off.specialty, t0 + 20 * DAY, q.id as string, {});
    makePatient({ full_name: d.b, mother_name: d.mb, sex: d.sex, birth_date: first.birth_date, cns: null, createdDaysAgo: int(1, 12) });
  }

  // 3. Sobreposição (AL-02): mesma especialidade ativa em dois serviços
  for (const [a, b, sp] of [["NASF", "CREAES", "FONO"], ["NASF", "CRASF", "PSICO"]] as const) {
    const p = makePatient({ createdDaysAgo: int(90, 160) });
    const t0 = new Date(p.created_at as string).getTime();
    const tr = triage(p, a, sp, t0 + DAY);
    const q = queue(p, a, sp, t0 + DAY + 1000, "em_atendimento", { priority: tr.priority, triage_id: tr.id, started_at: iso(t0 + 25 * DAY) });
    sessions(p, a, sp, t0 + 25 * DAY, q.id as string, {});
    const tr2 = triage(p, b, sp, NOW - int(4, 15) * DAY);
    queue(p, b, sp, new Date(tr2.created_at as string).getTime() + 1000, "aguardando", { priority: tr2.priority, triage_id: tr2.id });
  }

  // 4. Faltas consecutivas (AL-04)
  for (let i = 0; i < 4; i++) {
    const off = pick(offerList.filter((o) => ["NASF", "CREAES", "NAPE"].includes(o.service)));
    const p = makePatient({ createdDaysAgo: int(100, 180) });
    const t0 = new Date(p.created_at as string).getTime();
    const tr = triage(p, off.service, off.specialty, t0 + DAY);
    const q = queue(p, off.service, off.specialty, t0 + DAY + 1000, "em_atendimento", { priority: tr.priority, triage_id: tr.id, started_at: iso(t0 + 20 * DAY) });
    sessions(p, off.service, off.specialty, t0 + 20 * DAY, q.id as string, { every: 7, forceAbsencesAtEnd: 3, future: 1 });
  }

  // 5. Cuidado sem atualização (AL-05): último registro há mais de 30 dias
  for (let i = 0; i < 3; i++) {
    const off = pick(offerList);
    const p = makePatient({ createdDaysAgo: int(120, 200) });
    const t0 = new Date(p.created_at as string).getTime();
    const tr = triage(p, off.service, off.specialty, t0 + DAY);
    const q = queue(p, off.service, off.specialty, t0 + DAY + 1000, "em_atendimento", { priority: tr.priority, triage_id: tr.id, started_at: iso(t0 + 15 * DAY) });
    sessions(p, off.service, off.specialty, t0 + 15 * DAY, q.id as string, { endMs: NOW - int(38, 55) * DAY, future: 0, every: 14 });
  }

  // 6. Fila acima da capacidade (AL-06): Neuropediatria no CREAES (20 vagas/mês)
  for (let i = 0; i < 26; i++) {
    const p = makePatient({ createdDaysAgo: int(10, 140) });
    const t0 = new Date(p.created_at as string).getTime();
    const tr = triage(p, "NASF", pick(["FONO", "PSICO", "FISIO"]), t0 + DAY);
    const q0 = queue(p, "NASF", spById[tr.specialty_id as string].code, t0 + DAY + 1000, "em_atendimento", { priority: tr.priority, triage_id: tr.id, started_at: iso(t0 + 12 * DAY) });
    sessions(p, "NASF", spById[tr.specialty_id as string].code, t0 + 12 * DAY, q0.id as string, { every: 14, future: 1 });
    const refAt = Math.min(t0 + int(14, 60) * DAY, NOW - 2 * DAY);
    const ref = referral(p, "NASF", "CREAES", "NEUROPED", refAt, "aceito", pick(["P1", "P2", "P2", "P3"]));
    queue(p, "CREAES", "NEUROPED", new Date(ref.responded_at as string).getTime(), "aguardando", { priority: ref.priority, origin: "encaminhamento", referral_id: ref.id, priority_justification: "Prioridade definida no encaminhamento" });
  }

  // Encaminhamentos parados (AL-03)
  for (let i = 0; i < 3; i++) {
    const p = makePatient({ createdDaysAgo: int(40, 90) });
    const t0 = new Date(p.created_at as string).getTime();
    const tr = triage(p, "NAPE", "PSICOPED", t0 + DAY);
    const q = queue(p, "NAPE", "PSICOPED", t0 + DAY + 1000, "em_atendimento", { priority: tr.priority, triage_id: tr.id, started_at: iso(t0 + 8 * DAY) });
    sessions(p, "NAPE", "PSICOPED", t0 + 8 * DAY, q.id as string, { every: 14 });
    referral(p, "NAPE", pick(["CREAES", "CASA_MAIS_AZUL"]), pick(["TO", "PSICO"]) === "TO" ? "TO" : null, NOW - int(10, 25) * DAY, "pendente");
  }

  // Agenda de hoje parecida com o mockup
  const todayPatients = [
    { name: "Ana Beatriz Lima", sex: "feminino", service: "CREAES", sp: "TO", prof: "gustavo.lima@cuidarmais.demo", h: 9, m: 30 },
    { name: "Pedro Henrique Souza", sex: "masculino", service: "NASF", sp: "PSICO", prof: "lucas.ribeiro@cuidarmais.demo", h: 11, m: 0 },
    { name: "Maria Clara Alves", sex: "feminino", service: "CREAES", sp: "NEUROPED", prof: "creaes@cuidarmais.demo", h: 14, m: 0 },
  ];
  for (const tp of todayPatients) {
    const p = makePatient({ full_name: tp.name, sex: tp.sex, createdDaysAgo: int(90, 150) });
    const t0 = new Date(p.created_at as string).getTime();
    const tr = triage(p, tp.service, tp.sp, t0 + DAY);
    const q = queue(p, tp.service, tp.sp, t0 + DAY + 1000, "em_atendimento", { priority: tr.priority, triage_id: tr.id, started_at: iso(t0 + 20 * DAY) });
    const prof = byEmail(tp.prof);
    sessions(p, tp.service, tp.sp, t0 + 20 * DAY, q.id as string, { every: 14, future: 0, prof, endMs: NOW - 2 * DAY });
    const when = localDate(0, tp.h, tp.m);
    busy.add(`${prof.id}|${when.toISOString()}`);
    out.appointments.push({ id: randomUUID(), patient_id: p.id, service_id: svc[tp.service].id, professional_id: prof.id, specialty_id: spc[tp.sp].id, queue_entry_id: q.id, scheduled_for: iso(when), duration_minutes: 50, status: "agendado", created_by: prof.id, created_at: iso(NOW - 10 * DAY) });
  }

  // ============================================================ POPULAÇÃO GERAL
  const coordinators = [coord, ...staff.filter((s) => s.role === "profissional")];
  for (let i = 0; i < 115; i++) {
    const r = rand();
    const kind = r < 0.07 ? "novo" : r < 0.4 ? "aguardando" : r < 0.9 ? "ativo" : "concluido";
    const off = pick(offerList.filter((o) => !(o.service === "CREAES" && o.specialty === "NEUROPED")));
    const p = makePatient({ createdDaysAgo: kind === "novo" ? int(0, 12) : kind === "aguardando" ? int(5, 100) : int(60, 240) });
    if (kind === "novo") continue;
    const t0 = new Date(p.created_at as string).getTime();
    const tr = triage(p, off.service, off.specialty, t0 + int(1, 4) * DAY);
    const trAt = new Date(tr.created_at as string).getTime();

    if (kind === "aguardando") {
      queue(p, off.service, off.specialty, trAt + 1000, "aguardando", { priority: tr.priority, triage_id: tr.id, priority_justification: tr.priority_justification });
      continue;
    }
    const start = trAt + int(5, 45) * DAY;
    if (start > NOW - 7 * DAY) {
      queue(p, off.service, off.specialty, trAt + 1000, "aguardando", { priority: tr.priority, triage_id: tr.id, priority_justification: tr.priority_justification });
      continue;
    }
    const finished = kind === "concluido" ? Math.min(start + int(60, 150) * DAY, NOW - int(5, 30) * DAY) : null;
    const q = queue(p, off.service, off.specialty, trAt + 1000, finished ? "concluido" : "em_atendimento", {
      priority: tr.priority, triage_id: tr.id, priority_justification: tr.priority_justification,
      started_at: iso(start), finished_at: finished ? iso(finished) : null,
    });
    const prof = sessions(p, off.service, off.specialty, start, q.id as string, { endMs: finished ?? NOW, future: finished ? 0 : int(1, 3) });

    if (!finished && chance(0.35)) {
      const destOffers = offerList.filter((o) => o.service !== off.service && o.specialty !== off.specialty);
      const dest = pick(destOffers);
      const refAt = Math.min(start + int(10, 90) * DAY, NOW - DAY);
      const status = pick(["aceito", "aceito", "aceito", "devolvido", "complemento_solicitado", "pendente", "pendente"]);
      const ref = referral(p, off.service, dest.service, dest.specialty, refAt, status, tr.priority as string);
      if (status === "aceito") {
        const accAt = new Date(ref.responded_at as string).getTime();
        if (chance(0.5) && accAt < NOW - 20 * DAY) {
          const q2 = queue(p, dest.service, dest.specialty, accAt, "em_atendimento", { priority: ref.priority, origin: "encaminhamento", referral_id: ref.id, started_at: iso(accAt + int(7, 15) * DAY) });
          sessions(p, dest.service, dest.specialty, accAt + int(7, 15) * DAY, q2.id as string, { every: 14, future: 1 });
        } else {
          queue(p, dest.service, dest.specialty, accAt, "aguardando", { priority: ref.priority, origin: "encaminhamento", referral_id: ref.id, priority_justification: "Prioridade definida no encaminhamento" });
        }
      }
    }
    if (!finished && chance(0.4)) plan(p, off.service, start + int(5, 30) * DAY < NOW ? start + int(5, 30) * DAY : start, chance(0.5) ? coord : prof, int(1, 3));
    else if (!finished && chance(0.05)) void coordinators;
  }

  // ============================================================ GRAVAÇÃO
  console.log("Gravando…");
  out.appointments.sort((a, b) => String(a.scheduled_for).localeCompare(String(b.scheduled_for)));
  await insertAll("patients", out.patients);
  await insertAll("triages", out.triages);
  await insertAll("referrals", out.referrals);
  await insertAll("queue_entries", out.queue_entries);
  await insertAll("appointments", out.appointments, 200);
  await insertAll("care_plans", out.care_plans);
  await insertAll("care_plan_items", out.care_plan_items);

  const { data: n, error } = await sb.rpc("run_care_alert_checks");
  if (error) throw error;
  console.log(`  alertas periódicos criados: ${n}`);

  const { data: alerts } = await sb.from("care_alerts").select("code, status");
  const summary = (alerts ?? []).reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.code]: (acc[a.code] ?? 0) + 1 }), {});
  console.log("  alertas por tipo:", summary);
  const { count: ev } = await sb.from("journey_events").select("id", { count: "exact", head: true });
  console.log(`  eventos na linha do tempo: ${ev}`);
  console.log("\nPronto! Contas de demonstração (senha " + DEMO_PASSWORD + "):");
  for (const e of ["recepcao", "profissional", "creaes", "coordenacao", "gestao", "admin", "responsavel"]) console.log(`  ${e}@cuidarmais.demo`);
}

main().catch((e) => {
  console.error("ERRO:", e.message ?? e);
  process.exit(1);
});
