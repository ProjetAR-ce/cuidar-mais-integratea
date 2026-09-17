"use server";

import { getCurrentProfile } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";

/**
 * Digitalização de fichas em papel (RF extra): a foto é lida por um modelo com visão,
 * os campos voltam para uma tela de revisão humana e só então viram cadastro.
 * A imagem é processada em memória e descartada: nada da foto é gravado (LGPD, minimização).
 */

export type ScanField =
  | "full_name" | "social_name" | "birth_date" | "sex" | "mother_name" | "cns" | "cpf" | "phone" | "race_color"
  | "guardian_relationship" | "guardian_name" | "guardian_cns" | "guardian_birth_date" | "guardian_phone"
  | "aps_reference" | "school_name" | "address" | "neighborhood" | "municipality" | "state" | "zone" | "school_grade" | "school_shift"
  | "diagnostic_hypothesis";

export type ScanResult = {
  formType: string;
  fields: Partial<Record<ScanField, string>>;
  uncertain: ScanField[];
  notes: string[];
  recordNumber: string | null;
  openedAt: string | null;
};

const MAX_BYTES = 4.4 * 1024 * 1024;
const MEDIA = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

const str = (description: string) => ({ type: ["string", "null"], description });
const TOOL = {
  name: "registrar_ficha",
  description: "Registra os dados lidos da ficha em papel. Use null quando o campo não existir ou estiver em branco.",
  input_schema: {
    type: "object",
    properties: {
      tipo_ficha: { type: "string", description: "Qual ficha é: 'NASF A.1 - Prontuário', 'NAPE - Anamnese psicológica', 'NAPE - Anamnese psicopedagógica', 'NAPE - Educação física', 'NAPE - Síntese de acompanhamento' ou 'Outra'." },
      legivel: { type: "boolean", description: "false se a foto estiver ilegível, cortada ou não for uma ficha de cadastro." },
      numero_prontuario: str("Nº do prontuário físico, se houver."),
      data_abertura: str("Data da abertura do prontuário, AAAA-MM-DD."),
      full_name: str("Nome completo do paciente/aluno."),
      social_name: str("Nome social, se escrito."),
      birth_date: str("Data de nascimento do paciente, AAAA-MM-DD. Datas no papel vêm como DD/MM/AAAA."),
      sex: { type: ["string", "null"], enum: ["feminino", "masculino", "intersexo", "nao_informado", null] },
      mother_name: str("Nome da mãe."),
      cns: str("CNS do paciente, só dígitos (15)."),
      cpf: str("CPF do paciente, só dígitos (11)."),
      phone: str("Telefone do paciente ou da família, só dígitos com DDD."),
      race_color: { type: ["string", "null"], enum: ["branca", "preta", "parda", "amarela", "indigena", "nao_informado", null], description: "Campo 'Cor'." },
      guardian_relationship: { type: ["string", "null"], enum: ["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Responsável legal", "Próprio paciente", null] },
      guardian_name: str("Nome do(a) responsável."),
      guardian_cns: str("CNS do(a) responsável, só dígitos."),
      guardian_birth_date: str("Nascimento do(a) responsável, AAAA-MM-DD."),
      guardian_phone: str("Telefone do responsável, só dígitos com DDD."),
      aps_reference: str("APS / unidade básica de saúde de referência."),
      school_name: str("Escola."),
      address: str("Endereço e número."),
      neighborhood: str("Bairro."),
      municipality: str("Município."),
      state: str("UF com 2 letras."),
      zone: { type: ["string", "null"], enum: ["urbana", "rural", null] },
      school_grade: str("Série/turma."),
      school_shift: { type: ["string", "null"], enum: ["manha", "tarde", "noite", "integral", null] },
      diagnostic_hypothesis: str("H.D. (hipótese diagnóstica), exatamente como escrita."),
      campos_incertos: { type: "array", items: { type: "string" }, description: "Chaves dos campos cuja leitura ficou duvidosa (letra difícil, rasura, borrão, dígito ambíguo)." },
      observacoes: { type: "array", items: { type: "string" }, description: "Avisos curtos para quem vai revisar, em português. Ex.: 'CNS com um dígito rasurado'." },
    },
    required: ["tipo_ficha", "legivel", "campos_incertos", "observacoes"],
  },
} as const;

const PROMPT = `Você digitaliza fichas em papel da rede de cuidado a pessoas com TEA de Crateús-CE (NASF e NAPE).
Leia a ficha da imagem e chame a ferramenta registrar_ficha.

Regras:
- Transcreva somente o que está escrito. Nunca invente, complete ou deduza dados ausentes.
- Campo em branco, riscado ou inexistente: null.
- Datas em AAAA-MM-DD. CNS, CPF e telefones apenas com dígitos.
- Nomes próprios com iniciais maiúsculas, sem abreviar o que estiver por extenso.
- Marque em campos_incertos todo campo com qualquer dúvida de leitura, principalmente dígitos de CNS/CPF e datas.
- Se o responsável for a mãe, guardian_relationship = "Mãe".
- Não faça diagnóstico nem interprete a H.D.: apenas copie o texto.`;

const ALLOWED = new Set<ScanField>(Object.keys(TOOL.input_schema.properties).filter((k) => !["tipo_ficha", "legivel", "numero_prontuario", "data_abertura", "campos_incertos", "observacoes"].includes(k)) as ScanField[]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function extractPatientForm(formData: FormData): Promise<{ ok: true; data: ScanResult } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || !can(profile.role, "patients.create")) return { ok: false, error: "Seu perfil não pode cadastrar pacientes." };

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.API_claude;
  if (!apiKey) return { ok: false, error: "A leitura de fichas não está configurada neste ambiente (chave da IA ausente)." };

  const file = formData.get("ficha");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Envie a foto da ficha." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Arquivo muito grande. Use uma foto ou PDF de até 4 MB." };
  const mediaType = MEDIA.find((m) => m === file.type);
  if (!mediaType) return { ok: false, error: "Formato não suportado. Use JPG, PNG, WEBP ou PDF." };

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const source = { type: "base64", media_type: mediaType, data };

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
        max_tokens: 2048,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: [{ type: mediaType === "application/pdf" ? "document" : "image", source }, { type: "text", text: PROMPT }] }],
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    return { ok: false, error: "A leitura demorou demais. Tente de novo com uma foto mais nítida." };
  }
  if (!res.ok) {
    console.error("[scan] Anthropic", res.status, (await res.text()).slice(0, 300));
    return { ok: false, error: res.status === 401 ? "Chave da IA inválida." : "Não foi possível ler a ficha agora. Tente novamente." };
  }

  const body = (await res.json()) as { content?: { type: string; name?: string; input?: Record<string, unknown> }[] };
  const raw = body.content?.find((c) => c.type === "tool_use" && c.name === TOOL.name)?.input;
  if (!raw) return { ok: false, error: "Não foi possível ler a ficha. Tente outra foto." };
  if (raw.legivel === false) return { ok: false, error: "A foto não parece uma ficha legível. Enquadre a folha inteira, com boa luz, e tente de novo." };

  return { ok: true, data: normalize(raw, can(profile.role, "patients.clinical")) };
}

/** Confere formato de cada campo; o que não passa vira "incerto" em vez de ser descartado em silêncio. */
function normalize(raw: Record<string, unknown>, clinical: boolean): ScanResult {
  const fields: ScanResult["fields"] = {};
  const uncertain = new Set<ScanField>((Array.isArray(raw.campos_incertos) ? raw.campos_incertos : []).filter((k): k is ScanField => ALLOWED.has(k as ScanField)));
  const today = new Date().toISOString().slice(0, 10);

  for (const key of ALLOWED) {
    const v = raw[key];
    if (typeof v !== "string" || !v.trim()) continue;
    let value = v.trim();
    if (key === "diagnostic_hypothesis" && !clinical) continue; // recepção não recebe conteúdo clínico
    if (key === "cns" || key === "guardian_cns" || key === "cpf" || key === "phone" || key === "guardian_phone") value = value.replace(/\D/g, "");
    if ((key === "cns" || key === "guardian_cns") && value.length !== 15) uncertain.add(key);
    if (key === "cpf" && value.length !== 11) uncertain.add(key);
    if ((key === "phone" || key === "guardian_phone") && value.length < 10) uncertain.add(key);
    if (key.endsWith("birth_date")) {
      if (!DATE.test(value) || value > today) { uncertain.add(key); if (!DATE.test(value)) continue; }
    }
    if (key === "state") value = value.toUpperCase().slice(0, 2);
    fields[key] = value;
  }
  // Campo obrigatório que a IA não achou também precisa de atenção na revisão
  (["full_name", "birth_date", "mother_name"] as const).forEach((k) => { if (!fields[k]) uncertain.add(k); });

  const notes = (Array.isArray(raw.observacoes) ? raw.observacoes : []).filter((n): n is string => typeof n === "string" && !!n.trim()).slice(0, 6);
  if (!clinical && typeof raw.diagnostic_hypothesis === "string" && raw.diagnostic_hypothesis.trim()) notes.push("A ficha tem H.D. Ela não foi importada porque seu perfil não acessa conteúdo clínico.");

  return {
    formType: typeof raw.tipo_ficha === "string" ? raw.tipo_ficha : "Ficha em papel",
    fields,
    uncertain: [...uncertain].filter((k) => clinical || k !== "diagnostic_hypothesis"),
    notes,
    recordNumber: typeof raw.numero_prontuario === "string" && raw.numero_prontuario.trim() ? raw.numero_prontuario.trim() : null,
    openedAt: typeof raw.data_abertura === "string" && DATE.test(raw.data_abertura) ? raw.data_abertura : null,
  };
}
