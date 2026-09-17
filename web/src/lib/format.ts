import { differenceInYears, differenceInMonths, format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

export const TZ = "America/Fortaleza";

/** Converte um instante para "hora local de Crateús" (UTC-3, sem horário de verão). */
export function local(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Date(date.getTime() + (date.getTimezoneOffset() - 180) * 60_000);
}

export const fmtDate = (d: string | Date) => format(typeof d === "string" && d.length === 10 ? new Date(d + "T12:00:00") : local(d), "dd/MM/yyyy");
export const fmtTime = (d: string | Date) => format(local(d), "HH:mm");
export const fmtDateTime = (d: string | Date) => format(local(d), "dd/MM/yyyy 'às' HH:mm");
export const fmtDayMonth = (d: string | Date) => format(local(d), "d 'de' MMM", { locale: ptBR });
export const fmtWeekday = (d: string | Date) => format(local(d), "EEEE, d 'de' MMMM", { locale: ptBR });

export function fmtRelativeDay(d: string | Date) {
  const l = local(d);
  const now = local(new Date());
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(l, now)) return "Hoje";
  const t = new Date(now); t.setDate(t.getDate() + 1);
  if (sameDay(l, t)) return "Amanhã";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (sameDay(l, y)) return "Ontem";
  return format(l, "EEE, d MMM", { locale: ptBR });
}
void isToday; void isTomorrow; void isYesterday;

export const fromNow = (d: string | Date) => formatDistanceToNowStrict(new Date(d), { locale: ptBR, addSuffix: true });

export function age(birth: string) {
  const b = new Date(birth + "T12:00:00");
  const years = differenceInYears(new Date(), b);
  if (years >= 2) return `${years} anos`;
  const months = differenceInMonths(new Date(), b);
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export function maskCns(cns?: string | null) {
  if (!cns) return null;
  return cns.replace(/^(\d{3})(\d{4})(\d{4})(\d{4})$/, "$1 $2 $3 $4");
}
export function maskCpf(cpf?: string | null) {
  if (!cpf) return null;
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/** Instante atual. Em função própria para não chamar Date.now() dentro de componentes. */
export function nowMs() {
  return Date.now();
}
export function isoFromNow(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}

export function daysSince(d: string | Date) {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
}

/** Data/hora local (Crateús) → ISO UTC, a partir de "yyyy-MM-dd" e "HH:mm" */
export function localInputToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

export function todayLocalISODate(offsetDays = 0) {
  const l = local(new Date());
  l.setDate(l.getDate() + offsetDays);
  return format(l, "yyyy-MM-dd");
}
