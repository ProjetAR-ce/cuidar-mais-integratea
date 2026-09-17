"use client";

import * as React from "react";
import { Bell, CalendarDays, Clock, Heart, Plus, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, IconBubble, PageHeader, ProgressBar, ProgressRing, Avatar } from "@/components/ui/primitives";
import { ChoiceCards, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Celebrate, EmptyState } from "@/components/ui/feedback";
import { StatCard } from "@/components/ui/stat-card";
import { Logo } from "@/components/ui/brand";
import { AppointmentStatusBadge, PriorityBadge, QueueStatusBadge, ReferralStatusBadge, SeverityBadge } from "@/components/ui/status";

const SWATCHES = [
  ["ink", "#344054"], ["mint", "#91DCC1"], ["peach", "#F6B978"], ["lilac", "#B99BCB"], ["sun", "#F6D76F"], ["rose", "#F2B9C5"],
] as const;

export function StyleguideDemo() {
  const [seg, setSeg] = React.useState("dia");
  const [choice, setChoice] = React.useState<"P1" | "P2" | "P3" | null>("P2");
  const [open, setOpen] = React.useState(false);
  const [party, setParty] = React.useState(false);

  return (
    <div className="mx-auto max-w-6xl overflow-x-hidden px-5 py-10">
      <Logo className="mb-8" />
      <PageHeader eyebrow="Fase 1 · Fundação" title="Design system Cuidar+" subtitle="Estrutura e respiro da Apple, volume e alegria do Duolingo, com a paleta acolhedora da marca." />

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {SWATCHES.map(([name, hex]) => (
          <div key={name} className="card overflow-hidden">
            <div className="h-20" style={{ background: `var(--color-${name})` }} />
            <div className="p-3">
              <p className="font-bold text-ink-strong capitalize">{name}</p>
              <p className="text-footnote text-ink-muted">{hex}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pacientes cadastrados" value="1.248" icon={Users} tone="lilac" current={112} previous={100} />
        <StatCard label="Em atendimento" value="186" icon={CalendarDays} tone="mint" current={108} previous={100} />
        <StatCard label="Encaminhamentos" value="72" icon={Send} tone="peach" current={115} previous={100} />
        <StatCard label="Tempo médio de espera" value="12" suffix="dias" icon={Clock} tone="rose" current={72} previous={100} invert />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Botões" icon={Heart} tone="rose" />
          <div className="flex flex-wrap gap-3 px-5 pb-6">
            <Button>Primário</Button>
            <Button variant="mint"><Plus /> Cadastrar</Button>
            <Button variant="peach">Pêssego</Button>
            <Button variant="lilac">Lavanda</Button>
            <Button variant="sun">Amarelo</Button>
            <Button variant="danger">Cancelar</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button size="lg" variant="mint" onClick={() => setParty(true)}>Celebrar 🎉</Button>
            <Button loading>Salvando</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Estados (cor + ícone + texto)" icon={Bell} tone="sun" />
          <div className="flex flex-wrap gap-2 px-5 pb-6">
            <PriorityBadge priority="P1" /><PriorityBadge priority="P2" /><PriorityBadge priority="P3" />
            <AppointmentStatusBadge status="agendado" /><AppointmentStatusBadge status="presente" />
            <AppointmentStatusBadge status="falta_justificada" /><AppointmentStatusBadge status="falta_injustificada" />
            <QueueStatusBadge status="aguardando" /><QueueStatusBadge status="em_atendimento" />
            <ReferralStatusBadge status="pendente" /><ReferralStatusBadge status="complemento_solicitado" /><ReferralStatusBadge status="devolvido" />
            <SeverityBadge severity="critico" /><SeverityBadge severity="atencao" />
            <Badge tone="mint">NASF</Badge><Badge tone="lilac">NAPE</Badge><Badge tone="peach">CREAES</Badge><Badge tone="sun">Casa Mais Azul</Badge><Badge tone="rose">CRASF</Badge>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-headline">Formulário</h2>
          <div className="space-y-4">
            <Field label="Nome completo" htmlFor="sg-nome" required hint="Como aparece na certidão.">
              <Input id="sg-nome" placeholder="Ex.: Ana Clara Souza" />
            </Field>
            <Field label="Serviço" htmlFor="sg-servico">
              <Select id="sg-servico" defaultValue="NASF"><option>NASF</option><option>CREAES</option></Select>
            </Field>
            <Field label="Justificativa" htmlFor="sg-just" error="A prioridade precisa de justificativa.">
              <Textarea id="sg-just" aria-invalid />
            </Field>
            <ChoiceCards name="prio" value={choice} onChange={setChoice} options={[
              { value: "P1", label: "P1", description: "Alta" }, { value: "P2", label: "P2", description: "Média" }, { value: "P3", label: "P3", description: "Baixa" },
            ]} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-headline">Navegação, progresso e janelas</h2>
          <SegmentedControl label="Período" value={seg} onChange={setSeg} options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana", count: 12 }, { value: "mes", label: "Mês" }]} />
          <div className="mt-6 space-y-3">
            <ProgressBar value={72} tone="mint" label="Metas" />
            <ProgressBar value={40} tone="peach" label="Fila" />
          </div>
          <div className="mt-6 flex items-center gap-4">
            <ProgressRing value={8} max={10} tone="mint"><span className="font-bold">8</span></ProgressRing>
            <ProgressRing value={3} max={5} tone="lilac" size={56}><span className="text-footnote font-bold">3/5</span></ProgressRing>
            <ProgressRing value={1} max={4} tone="rose" size={48} stroke={7} />
            <IconBubble icon={Users} tone="mint" size="lg" />
            <Avatar name="Maria Silva" size="lg" />
          </div>
          <Button className="mt-6" variant="secondary" onClick={() => setOpen(true)}>Abrir janela</Button>
        </Card>
      </section>

      <Card className="mt-8">
        <EmptyState title="Tudo em dia por aqui" description="Nenhum alerta pendente. Que tal revisar os encaminhamentos?" action={<Button variant="mint">Ver encaminhamentos</Button>} />
      </Card>

      <Modal open={open} onOpenChange={setOpen} title="Registrar presença" description="Confirme a situação do atendimento." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Voltar</Button><Button variant="mint" onClick={() => { setOpen(false); setParty(true); }}>Confirmar</Button></>}>
        <p className="text-callout text-ink-muted">No celular esta janela sobe como uma folha (sheet), no desktop fica centralizada.</p>
      </Modal>
      <Celebrate show={party} message="Presença registrada!" onDone={() => setParty(false)} />
    </div>
  );
}
