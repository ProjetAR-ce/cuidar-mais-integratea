import {
  Activity, BarChart3, Bell, CalendarDays, ClipboardList, Copy, Gauge, Home, ListOrdered, Send, Settings, ShieldCheck, Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";
import type { Tone } from "@/types/domain";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission?: Permission; tone: Tone; badge?: "alerts" | "referrals" | "duplicates"; mobile?: boolean };

export const NAV: NavItem[] = [
  { href: "/inicio", label: "Início", icon: Home, tone: "lilac", mobile: true },
  { href: "/pacientes", label: "Pacientes", icon: Users, permission: "patients.read", tone: "mint", mobile: true },
  { href: "/triagem", label: "Triagem", icon: ClipboardList, permission: "triage.create", tone: "peach" },
  { href: "/fila", label: "Fila de atendimento", icon: ListOrdered, permission: "queue.read", tone: "sun", mobile: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, permission: "agenda.read", tone: "mint", mobile: true },
  { href: "/encaminhamentos", label: "Encaminhamentos", icon: Send, permission: "referrals.manage", tone: "lilac", badge: "referrals" },
  { href: "/alertas", label: "Alertas", icon: Bell, permission: "alerts.review", tone: "rose", badge: "alerts" },
  { href: "/duplicidades", label: "Duplicidades", icon: Copy, permission: "duplicates.resolve", tone: "peach", badge: "duplicates" },
  { href: "/capacidade", label: "Capacidade", icon: Gauge, permission: "capacity.read", tone: "sun" },
  { href: "/indicadores", label: "Indicadores", icon: BarChart3, permission: "indicators.read", tone: "mint" },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck, permission: "audit.read", tone: "ink" },
  { href: "/admin", label: "Administração", icon: Settings, permission: "admin", tone: "ink" },
];

export { Activity };
