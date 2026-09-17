import {
  AlertOctagon, AlertTriangle, ArrowDownCircle, CalendarClock, CheckCircle2, ChevronsUp, ChevronUp, CircleDot,
  Clock, FileQuestion, Minus, PlayCircle, Undo2, UserX, XCircle,
} from "lucide-react";
import { Badge } from "./primitives";
import type { AlertSeverity, AppointmentStatus, Priority, QueueStatus, ReferralStatus } from "@/types/domain";

// Estados sempre com cor + ícone + texto (manual de marca e RNF-006)

export const PRIORITY_META = {
  P1: { label: "P1 · Urgente", short: "P1", tone: "rose", icon: ChevronsUp },
  P2: { label: "P2 · Curto prazo", short: "P2", tone: "sun", icon: ChevronUp },
  P3: { label: "P3 · Lista de espera", short: "P3", tone: "mint", icon: Minus },
} as const;

export function PriorityBadge({ priority, short, size }: { priority: Priority; short?: boolean; size?: "sm" | "md" }) {
  const m = PRIORITY_META[priority];
  return <Badge tone={m.tone} icon={m.icon} size={size}>{short ? m.short : m.label}</Badge>;
}

export const APPOINTMENT_META: Record<AppointmentStatus, { label: string; tone: "mint" | "sun" | "rose" | "lilac" | "ink"; icon: typeof Clock }> = {
  agendado: { label: "Agendado", tone: "lilac", icon: CalendarClock },
  presente: { label: "Presente", tone: "mint", icon: CheckCircle2 },
  falta_justificada: { label: "Falta justificada", tone: "sun", icon: FileQuestion },
  falta_injustificada: { label: "Falta", tone: "rose", icon: UserX },
  cancelado: { label: "Cancelado", tone: "ink", icon: XCircle },
};

export function AppointmentStatusBadge({ status, size }: { status: AppointmentStatus; size?: "sm" | "md" }) {
  const m = APPOINTMENT_META[status];
  return <Badge tone={m.tone} icon={m.icon} size={size}>{m.label}</Badge>;
}

export const QUEUE_META: Record<QueueStatus, { label: string; tone: "mint" | "sun" | "lilac" | "ink"; icon: typeof Clock }> = {
  aguardando: { label: "Aguardando", tone: "sun", icon: Clock },
  em_atendimento: { label: "Em acompanhamento", tone: "lilac", icon: PlayCircle },
  concluido: { label: "Concluído", tone: "mint", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", tone: "ink", icon: XCircle },
};

export function QueueStatusBadge({ status, size }: { status: QueueStatus; size?: "sm" | "md" }) {
  const m = QUEUE_META[status];
  return <Badge tone={m.tone} icon={m.icon} size={size}>{m.label}</Badge>;
}

export const REFERRAL_META: Record<ReferralStatus, { label: string; tone: "mint" | "sun" | "rose" | "peach"; icon: typeof Clock }> = {
  pendente: { label: "Aguardando resposta", tone: "sun", icon: Clock },
  aceito: { label: "Aceito", tone: "mint", icon: CheckCircle2 },
  devolvido: { label: "Devolvido", tone: "rose", icon: Undo2 },
  complemento_solicitado: { label: "Complemento pedido", tone: "peach", icon: FileQuestion },
};

export function ReferralStatusBadge({ status, size }: { status: ReferralStatus; size?: "sm" | "md" }) {
  const m = REFERRAL_META[status];
  return <Badge tone={m.tone} icon={m.icon} size={size}>{m.label}</Badge>;
}

export function SeverityBadge({ severity, size }: { severity: AlertSeverity; size?: "sm" | "md" }) {
  return severity === "critico"
    ? <Badge tone="rose" icon={AlertOctagon} size={size}>Crítico</Badge>
    : <Badge tone="sun" icon={AlertTriangle} size={size}>Atenção</Badge>;
}

export const ALERT_CODE_LABEL: Record<string, string> = {
  "AL-01": "Possível duplicidade",
  "AL-02": "Sobreposição",
  "AL-03": "Encaminhamento parado",
  "AL-04": "Faltas consecutivas",
  "AL-05": "Cuidado sem atualização",
  "AL-06": "Fila acima da capacidade",
};

export { CircleDot, ArrowDownCircle };
