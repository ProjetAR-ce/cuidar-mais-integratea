"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Camera, CheckCircle2, FileUp, ScanLine, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { toast } from "sonner";
import { extractPatientForm, type ScanResult } from "@/lib/actions/scan";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { NewPatientForm } from "../novo/new-patient-form";

type Stage = { kind: "capture" } | { kind: "reading"; preview: string } | { kind: "review"; preview: string; isPdf: boolean; result: ScanResult };

const READING_STEPS = ["Enviando a foto com segurança", "Lendo a letra da ficha", "Conferindo CNS, CPF e datas", "Preparando a revisão"];

/** Reduz fotos de celular (4–12 MB) para ~1 MB sem perder legibilidade e corrige a rotação. */
async function compress(file: File): Promise<File> {
  if (file.type === "application/pdf" || file.size < 900_000) return file; // PDF segue como está (limite de 4 MB)
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    return blob ? new File([blob], "ficha.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function ScanFlow({ clinical }: { clinical: boolean }) {
  const [stage, setStage] = React.useState<Stage>({ kind: "capture" });
  const [stepIdx, setStepIdx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (stage.kind !== "reading") return;
    const t = setInterval(() => setStepIdx((i) => Math.min(i + 1, READING_STEPS.length - 1)), 2200);
    return () => clearInterval(t);
  }, [stage.kind]);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(file.type)) { toast.error("Formato não suportado", { description: "Use foto (JPG, PNG, WEBP) ou PDF." }); return; }
    const preview = URL.createObjectURL(file);
    setStepIdx(0);
    setStage({ kind: "reading", preview });
    const small = await compress(file);
    const fd = new FormData();
    fd.append("ficha", small);
    const r = await extractPatientForm(fd);
    if (!r.ok) {
      toast.error("Não conseguimos ler a ficha", { description: r.error });
      URL.revokeObjectURL(preview);
      setStage({ kind: "capture" });
      return;
    }
    setStage({ kind: "review", preview, isPdf: file.type === "application/pdf", result: r.data });
  }

  function restart() {
    if (stage.kind !== "capture") URL.revokeObjectURL(stage.preview);
    setStage({ kind: "capture" });
  }

  if (stage.kind === "review") {
    return (
      <NewPatientForm
        initialName=""
        initialBirth=""
        clinical={clinical}
        prefill={stage.result.fields}
        review={{ preview: stage.preview, isPdf: stage.isPdf, result: stage.result, onRestart: restart }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link href="/pacientes"><ArrowLeft /> Voltar para a busca</Link></Button>
      <PageHeader eyebrow="Do papel para o digital" title="Digitalizar ficha" subtitle="Fotografe a ficha em papel. O sistema lê os dados e você confere tudo antes de salvar." />

      <AnimatePresence mode="wait">
        {stage.kind === "capture" ? (
          <motion.div key="capture" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card
              className={cn("relative overflow-hidden border-2 border-dashed p-6 text-center transition-colors sm:p-10", dragging ? "border-primary bg-primary-soft" : "border-line-strong")}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
            >
              <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-lilac/30 blur-2xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-mint/30 blur-2xl" />
              <div className="relative mx-auto flex size-20 items-center justify-center rounded-[26px] bg-primary text-white shadow-lg">
                <ScanLine className="size-10" />
              </div>
              <h2 className="relative mt-5 text-title-2">Fotografe a ficha inteira</h2>
              <p className="relative mx-auto mt-1 max-w-md text-callout text-ink-muted">Prontuário do NASF, anamneses e fichas do NAPE. Também aceita PDF escaneado.</p>
              <div className="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" onClick={() => cameraRef.current?.click()}><Camera /> Tirar foto</Button>
                <Button size="lg" variant="secondary" onClick={() => fileRef.current?.click()}><FileUp /> Escolher arquivo</Button>
              </div>
              <p className="relative mt-3 hidden text-footnote text-ink-muted sm:block">ou arraste a imagem para cá</p>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} aria-label="Tirar foto da ficha" />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => handle(e.target.files?.[0])} aria-label="Escolher arquivo da ficha" />
            </Card>

            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Sun, title: "Boa luz", text: "Sem sombra e sem flash estourado." },
                { icon: ScanLine, title: "Folha inteira", text: "Os quatro cantos aparecendo, bem de frente." },
                { icon: ShieldCheck, title: "Foto não é guardada", text: "Só os dados que você confirmar são salvos." },
              ].map((t) => (
                <li key={t.title} className="flex gap-3 rounded-lg bg-surface p-4 ring-1 ring-line">
                  <t.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div><p className="text-callout font-bold text-ink-strong">{t.title}</p><p className="text-footnote text-ink-muted">{t.text}</p></div>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <motion.div key="reading" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-7" aria-live="polite" aria-busy="true">
              <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:) */}
                <img src={stage.preview} alt="Ficha enviada" className="size-full object-cover opacity-90" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <motion.div
                  aria-hidden
                  className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/35 to-transparent"
                  animate={{ top: ["-15%", "100%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
                />
              </div>
              <div className="flex flex-col justify-center">
                <p className="flex items-center gap-2 text-footnote font-bold text-primary"><Sparkles className="size-4" /> Lendo a ficha</p>
                <h2 className="mt-1 text-title-2">Só um instante…</h2>
                <ol className="mt-4 space-y-3">
                  {READING_STEPS.map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-3 text-callout transition-colors", i <= stepIdx ? "font-semibold text-ink-strong" : "text-ink-faint")}>
                      {i < stepIdx ? <CheckCircle2 className="size-5 text-mint-edge" /> : <span className={cn("size-5 rounded-full border-2", i === stepIdx ? "animate-pulse border-primary" : "border-line-strong")} />}
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
