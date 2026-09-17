import type { Role } from "@/types/domain";

export type Permission =
  | "patients.read" | "patients.create" | "patients.clinical"
  | "triage.create" | "queue.read" | "queue.manage"
  | "agenda.read" | "agenda.manage" | "session.record"
  | "referrals.manage" | "plans.manage" | "alerts.review" | "duplicates.resolve"
  | "capacity.read" | "indicators.read" | "audit.read" | "admin";

const MATRIX: Record<Permission, Role[]> = {
  "patients.read": ["recepcao", "profissional", "coordenacao", "admin"],
  "patients.create": ["recepcao", "profissional", "coordenacao", "admin"],
  "patients.clinical": ["profissional", "coordenacao", "admin"],
  "triage.create": ["profissional", "coordenacao", "admin"],
  "queue.read": ["recepcao", "profissional", "coordenacao", "admin"],
  "queue.manage": ["profissional", "coordenacao", "admin"],
  "agenda.read": ["recepcao", "profissional", "coordenacao", "admin"],
  "agenda.manage": ["recepcao", "profissional", "coordenacao", "admin"],
  "session.record": ["profissional", "coordenacao", "admin"],
  "referrals.manage": ["profissional", "coordenacao", "admin"],
  "plans.manage": ["profissional", "coordenacao", "admin"],
  "alerts.review": ["profissional", "coordenacao", "admin"],
  "duplicates.resolve": ["coordenacao", "admin"],
  "capacity.read": ["profissional", "coordenacao", "gestao", "admin"],
  "indicators.read": ["coordenacao", "gestao", "admin"],
  "audit.read": ["admin"],
  admin: ["admin"],
};

export function can(role: Role | null | undefined, permission: Permission) {
  return Boolean(role && MATRIX[permission].includes(role));
}
