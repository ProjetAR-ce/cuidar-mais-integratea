export type Role = "recepcao" | "profissional" | "coordenacao" | "gestao" | "admin" | "responsavel";
export type Priority = "P1" | "P2" | "P3";
export type QueueStatus = "aguardando" | "em_atendimento" | "concluido" | "cancelado";
export type AppointmentStatus = "agendado" | "presente" | "falta_justificada" | "falta_injustificada" | "cancelado";
export type ReferralStatus = "pendente" | "aceito" | "devolvido" | "complemento_solicitado";
export type AlertSeverity = "atencao" | "critico";
export type AlertStatus = "pendente" | "revisado";
export type Tone = "mint" | "peach" | "lilac" | "sun" | "rose" | "ink";

export type Service = { id: string; name: string; code: string; color: Tone | null; description?: string | null; secretaria?: string | null };
export type Specialty = { id: string; name: string; code: string };

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  email: string | null;
  job_title: string | null;
  service_id: string | null;
  specialty_id: string | null;
  active: boolean;
  service: Service | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  recepcao: "Recepção",
  profissional: "Profissional",
  coordenacao: "Coordenação",
  gestao: "Gestão",
  admin: "Administração",
  responsavel: "Responsável",
};
