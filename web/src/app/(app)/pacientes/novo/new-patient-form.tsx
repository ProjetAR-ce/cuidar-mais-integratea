"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ExternalLink, HeartHandshake, IdCard, MapPin } from "lucide-react";
import { toast } from "sonner";
import { checkDuplicates, createPatient, type DuplicateHit } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { Field, Input, Select } from "@/components/ui/form";
import { Celebrate } from "@/components/ui/feedback";
import { age, fmtDate, maskCns } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "id", label: "Identificação", icon: IdCard },
  { key: "resp", label: "Responsável", icon: HeartHandshake },
  { key: "ref", label: "Referência", icon: MapPin },
] as const;

type Form = {
  full_name: string; social_name: string; birth_date: string; sex: string; mother_name: string; cns: string; cpf: string;
  guardian_relationship: string; guardian_name: string; guardian_phone: string;
  aps_reference: string; school_name: string; address: string; neighborhood: string;
  phone: string; race_color: string; guardian_cns: string; guardian_birth_date: string; municipality: string; state: string;
  zone: string; school_grade: string; school_shift: string; diagnostic_hypothesis: string;
};

const digits = (v: string) => v.replace(/\D/g, "");
const maskCnsInput = (v: string) => digits(v).slice(0, 15).replace(/^(\d{3})(\d{0,4})(\d{0,4})(\d{0,4}).*/, (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(" "));
const maskCpfInput = (v: string) => {
  const d = digits(v).slice(0, 11);
  return d.replace(/^(\d{3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, e) => a + (b ? "." + b : "") + (c ? "." + c : "") + (e ? "-" + e : ""));
};
const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export function NewPatientForm({ initialName, initialBirth, clinical }: { initialName: string; initialBirth: string; clinical: boolean }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [dups, setDups] = React.useState<DuplicateHit[]>([]);
  const [ack, setAck] = React.useState(false);
  const [party, setParty] = React.useState<string | null>(null);
  const [f, setF] = React.useState<Form>({
    full_name: /\d/.test(initialName) ? "" : initialName, social_name: "", birth_date: initialBirth, sex: "", mother_name: "",
    cns: /^\d{15}$/.test(digits(initialName)) ? maskCnsInput(initialName) : "", cpf: "",
    guardian_relationship: "Mãe", guardian_name: "", guardian_phone: "", aps_reference: "", school_name: "", address: "", neighborhood: "",
    phone: "", race_color: "", guardian_cns: "", guardian_birth_date: "", municipality: "Crateús", state: "CE",
    zone: "", school_grade: "", school_shift: "", diagnostic_hypothesis: "",
  });
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let v = e.target.value;
    if (k === "cns") v = maskCnsInput(v);
    if (k === "cpf") v = maskCpfInput(v);
    if (k === "guardian_phone" || k === "phone") v = maskPhone(v);
    if (k === "guardian_cns") v = maskCnsInput(v);
    setF((s) => ({ ...s, [k]: v }));
    setErrors((s) => ({ ...s, [k]: undefined }));
  };

  // Verificação de duplicidade em tempo real
  React.useEffect(() => {
    const t = setTimeout(async () => {
      const r = await checkDuplicates({ full_name: f.full_name, birth_date: f.birth_date, mother_name: f.mother_name, cns: f.cns, cpf: f.cpf });
      if (r.ok) { setDups(r.data ?? []); setAck(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [f.full_name, f.birth_date, f.mother_name, f.cns, f.cpf]);

  const exactDoc = dups.find((d) => d.reasons.some((r) => r.startsWith("CNS igual") || r === "CPF igual"));

  function validate(s: number) {
    const e: Partial<Record<keyof Form, string>> = {};
    if (s === 0) {
      if (f.full_name.trim().split(/\s+/).length < 2) e.full_name = "Informe nome e sobrenome.";
      if (!f.birth_date) e.birth_date = "Informe a data de nascimento.";
      else if (new Date(f.birth_date) > new Date()) e.birth_date = "A data não pode estar no futuro.";
      if (f.mother_name.trim().length < 5) e.mother_name = "Informe o nome da mãe. Se não houver, escreva “Não declarado”.";
      if (f.cns && digits(f.cns).length !== 15) e.cns = "O CNS tem 15 dígitos.";
      if (f.cpf && digits(f.cpf).length !== 11) e.cpf = "O CPF tem 11 dígitos.";
      if (!f.cns && !f.cpf) e.cns = "Sem CNS? Informe o CPF, se houver. Se não tiver nenhum, deixe em branco e siga.";
    }
    if (s === 1 && f.guardian_phone && digits(f.guardian_phone).length < 10) e.guardian_phone = "Telefone incompleto.";
    if (s === 1 && f.guardian_cns && digits(f.guardian_cns).length !== 15) e.guardian_cns = "O CNS tem 15 dígitos.";
    const blocking = Object.entries(e).filter(([k]) => !(k === "cns" && !f.cns && !f.cpf));
    setErrors(e);
    return blocking.length === 0;
  }

  function next() {
    if (!validate(step)) return;
    if (step === 0 && exactDoc) return;
    if (step === 0 && dups.length > 0 && !ack) { document.getElementById("dup-panel")?.focus(); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!validate(0) || !validate(1)) { setStep(0); return; }
    setSaving(true);
    const r = await createPatient({
      ...f,
      sex: (f.sex || undefined) as "feminino" | "masculino" | "intersexo" | "nao_informado" | undefined,
      race_color: (f.race_color || undefined) as "branca" | "preta" | "parda" | "amarela" | "indigena" | "nao_informado" | undefined,
      zone: (f.zone || undefined) as "urbana" | "rural" | undefined,
      school_shift: (f.school_shift || undefined) as "manha" | "tarde" | "noite" | "integral" | undefined,
      guardian_cns: digits(f.guardian_cns) || undefined,
      guardian_birth_date: f.guardian_birth_date || undefined,
      diagnostic_hypothesis: clinical ? f.diagnostic_hypothesis : undefined,
      guardian_name: f.guardian_relationship === "Mãe" && !f.guardian_name ? f.mother_name : f.guardian_name,
      cns: digits(f.cns) || undefined, cpf: digits(f.cpf) || undefined,
    });
    setSaving(false);
    if (!r.ok) { toast.error("Não foi possível cadastrar", { description: r.error }); return; }
    setParty(r.data as string);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link href="/pacientes"><ArrowLeft /> Voltar para a busca</Link></Button>
      <PageHeader title="Novo cadastro" subtitle="Colete só o necessário para o cuidado e a coordenação da rede." />

      {/* Stepper */}
      <div className="mb-6">
        <ProgressBar value={step + 1} max={STEPS.length} tone="mint" label="Progresso do cadastro" />
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className={cn("flex items-center gap-2 text-footnote font-semibold", i <= step ? "text-ink-strong" : "text-ink-muted")} aria-current={i === step ? "step" : undefined}>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", i < step ? "bg-mint text-ink-strong" : i === step ? "bg-ink text-white" : "bg-surface-2")}>
                {i < step ? <Check className="size-4" strokeWidth={3} /> : <s.icon className="size-4" />}
              </span>
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <Card className="p-5 sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
            {step === 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="Nome completo" htmlFor="full_name" required error={errors.full_name}>
                  <Input id="full_name" value={f.full_name} onChange={set("full_name")} autoFocus aria-invalid={!!errors.full_name} />
                </Field>
                <Field label="Nome social" htmlFor="social_name" hint="Opcional. Será usado na tela.">
                  <Input id="social_name" value={f.social_name} onChange={set("social_name")} />
                </Field>
                <Field label="Data de nascimento" htmlFor="birth_date" required error={errors.birth_date}>
                  <Input id="birth_date" type="date" value={f.birth_date} onChange={set("birth_date")} max={new Date().toISOString().slice(0, 10)} aria-invalid={!!errors.birth_date} />
                </Field>
                <Field className="sm:col-span-2" label="Nome da mãe" htmlFor="mother_name" required error={errors.mother_name}>
                  <Input id="mother_name" value={f.mother_name} onChange={set("mother_name")} aria-invalid={!!errors.mother_name} />
                </Field>
                <Field label="CNS (Cartão SUS)" htmlFor="cns" error={f.cns ? errors.cns : undefined} hint={!f.cns ? errors.cns ?? "15 dígitos. CNS igual não pode ser duplicado." : undefined}>
                  <Input id="cns" inputMode="numeric" value={f.cns} onChange={set("cns")} placeholder="000 0000 0000 0000" aria-invalid={!!(f.cns && errors.cns)} />
                </Field>
                <Field label="CPF" htmlFor="cpf" error={errors.cpf}>
                  <Input id="cpf" inputMode="numeric" value={f.cpf} onChange={set("cpf")} placeholder="000.000.000-00" aria-invalid={!!errors.cpf} />
                </Field>
                <Field label="Raça/cor" htmlFor="race_color">
                  <Select id="race_color" value={f.race_color} onChange={set("race_color")}>
                    <option value="">Prefiro não informar agora</option>
                    <option value="branca">Branca</option>
                    <option value="preta">Preta</option>
                    <option value="parda">Parda</option>
                    <option value="amarela">Amarela</option>
                    <option value="indigena">Indígena</option>
                    <option value="nao_informado">Não informado</option>
                  </Select>
                </Field>
                <Field label="Telefone do paciente" htmlFor="phone">
                  <Input id="phone" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="(88) 90000-0000" />
                </Field>
                <Field label="Sexo" htmlFor="sex">
                  <Select id="sex" value={f.sex} onChange={set("sex")}>
                    <option value="">Prefiro não informar agora</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="intersexo">Intersexo</option>
                    <option value="nao_informado">Não informado</option>
                  </Select>
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Relação com o paciente" htmlFor="guardian_relationship">
                  <Select id="guardian_relationship" value={f.guardian_relationship} onChange={set("guardian_relationship")}>
                    {["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Responsável legal", "Próprio paciente"].map((o) => <option key={o}>{o}</option>)}
                  </Select>
                </Field>
                <Field label="Nome do responsável" htmlFor="guardian_name" hint={f.guardian_relationship === "Mãe" ? "Se deixar em branco, usamos o nome da mãe." : undefined}>
                  <Input id="guardian_name" value={f.guardian_name} onChange={set("guardian_name")} placeholder={f.guardian_relationship === "Mãe" ? f.mother_name : ""} />
                </Field>
                <Field label="CNS do responsável" htmlFor="guardian_cns" error={errors.guardian_cns}>
                  <Input id="guardian_cns" inputMode="numeric" value={f.guardian_cns} onChange={set("guardian_cns")} placeholder="000 0000 0000 0000" aria-invalid={!!errors.guardian_cns} />
                </Field>
                <Field label="Nascimento do responsável" htmlFor="guardian_birth_date">
                  <Input id="guardian_birth_date" type="date" value={f.guardian_birth_date} onChange={set("guardian_birth_date")} max={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Telefone para contato" htmlFor="guardian_phone" error={errors.guardian_phone}>
                  <Input id="guardian_phone" inputMode="tel" value={f.guardian_phone} onChange={set("guardian_phone")} placeholder="(88) 90000-0000" aria-invalid={!!errors.guardian_phone} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Unidade de saúde de referência (APS)" htmlFor="aps_reference">
                  <Input id="aps_reference" value={f.aps_reference} onChange={set("aps_reference")} placeholder="Ex.: UBS Centro" />
                </Field>
                <Field label="Escola" htmlFor="school_name">
                  <Input id="school_name" value={f.school_name} onChange={set("school_name")} />
                </Field>
                <Field label="Endereço" htmlFor="address">
                  <Input id="address" value={f.address} onChange={set("address")} />
                </Field>
                <Field label="Bairro" htmlFor="neighborhood">
                  <Input id="neighborhood" value={f.neighborhood} onChange={set("neighborhood")} />
                </Field>
                <div className="grid grid-cols-[1fr_5rem] gap-3">
                  <Field label="Município" htmlFor="municipality"><Input id="municipality" value={f.municipality} onChange={set("municipality")} /></Field>
                  <Field label="UF" htmlFor="state"><Input id="state" maxLength={2} value={f.state} onChange={set("state")} /></Field>
                </div>
                <Field label="Zona" htmlFor="zone">
                  <Select id="zone" value={f.zone} onChange={set("zone")}>
                    <option value="">—</option><option value="urbana">Urbana</option><option value="rural">Rural</option>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                  <Field label="Série/turma" htmlFor="school_grade"><Input id="school_grade" value={f.school_grade} onChange={set("school_grade")} placeholder="Ex.: 2º ano B" /></Field>
                  <Field label="Turno" htmlFor="school_shift">
                    <Select id="school_shift" value={f.school_shift} onChange={set("school_shift")}>
                      <option value="">—</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option><option value="integral">Integral</option>
                    </Select>
                  </Field>
                </div>
                {clinical && (
                  <Field className="sm:col-span-2" label="Hipótese diagnóstica (H.D.)" htmlFor="diagnostic_hypothesis" hint="Opcional. Fica separada da identificação e só a equipe clínica vê.">
                    <Input id="diagnostic_hypothesis" value={f.diagnostic_hypothesis} onChange={set("diagnostic_hypothesis")} />
                  </Field>
                )}
                <div className="rounded-lg bg-surface-2 p-4 sm:col-span-2">
                  <p className="text-footnote font-bold text-ink-strong">Confira antes de salvar</p>
                  <p className="text-callout text-ink">{f.full_name} · {f.birth_date ? `${fmtDate(f.birth_date)} (${age(f.birth_date)})` : "—"} · mãe: {f.mother_name}</p>
                  <p className="text-footnote text-ink-muted">{f.cns ? `CNS ${f.cns}` : "Sem CNS"}{f.cpf ? ` · CPF ${f.cpf}` : ""}{f.guardian_phone ? ` · ${f.guardian_phone}` : ""}</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Duplicidades */}
        {dups.length > 0 && step === 0 && (
          <div id="dup-panel" tabIndex={-1} className={cn("mt-6 rounded-lg border-2 p-4 outline-none", exactDoc ? "border-rose-edge bg-rose-soft" : "border-sun-edge bg-sun-soft")} role="alert">
            <p className={cn("flex items-center gap-2 font-bold", exactDoc ? "text-rose-ink" : "text-sun-ink")}>
              <AlertTriangle className="size-5" />
              {exactDoc ? "Esta pessoa já está cadastrada" : "Encontramos cadastros parecidos"}
            </p>
            <p className="mt-1 text-footnote text-ink">
              {exactDoc ? "O documento informado já pertence a outro cadastro. Abra o cadastro existente." : "Confira se não é a mesma pessoa. O sistema não une cadastros automaticamente."}
            </p>
            <ul className="mt-3 space-y-2">
              {dups.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-surface p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink-strong">{d.full_name}</p>
                    <p className="text-caption text-ink-muted">nasc. {fmtDate(d.birth_date)} · mãe: {d.mother_name}{d.cns ? ` · CNS ${maskCns(d.cns)}` : ""}</p>
                    <p className="text-caption font-semibold text-ink">{d.reasons.join(" · ")}</p>
                  </div>
                  <Button asChild size="sm" variant="secondary"><Link href={`/pacientes/${d.id}`} target="_blank">Abrir <ExternalLink /></Link></Button>
                </li>
              ))}
            </ul>
            {!exactDoc && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-callout font-semibold text-ink-strong">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="size-5 accent-[var(--color-ink)]" />
                Conferi e não é nenhuma dessas pessoas
              </label>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft /> Voltar</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={step === 0 && (!!exactDoc || (dups.length > 0 && !ack))}>Continuar <ArrowRight /></Button>
          ) : (
            <Button variant="mint" size="lg" onClick={submit} loading={saving}><Check /> Salvar cadastro</Button>
          )}
        </div>
      </Card>

      <Celebrate show={!!party} message="Cadastro criado!" onDone={() => party && router.push(`/pacientes/${party}`)} />
    </div>
  );
}
