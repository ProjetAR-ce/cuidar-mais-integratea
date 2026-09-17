import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { TONE, toneFromText } from "./tone";
import type { Tone } from "@/types/domain";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({
  title, icon: Icon, tone = "lilac", action, className, subtitle,
}: { title: React.ReactNode; icon?: LucideIcon; tone?: Tone; action?: React.ReactNode; className?: string; subtitle?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-3 px-5 pt-5 pb-3", className)}>
      {Icon && <IconBubble icon={Icon} tone={tone} size="sm" />}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-headline font-bold text-ink-strong">{title}</h2>
        {subtitle && <p className="truncate text-footnote text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const bubbleSize = { xs: "size-7 rounded-[9px] [&_svg]:size-4", sm: "size-9 rounded-[12px] [&_svg]:size-[18px]", md: "size-12 rounded-[16px] [&_svg]:size-6", lg: "size-16 rounded-[22px] [&_svg]:size-8" };

export function IconBubble({ icon: Icon, tone = "lilac", size = "md", className, solid }: { icon: LucideIcon; tone?: Tone; size?: keyof typeof bubbleSize; className?: string; solid?: boolean }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center", bubbleSize[size], solid ? cn(TONE[tone].bg, "text-ink-strong") : cn(TONE[tone].soft, TONE[tone].ink), className)}>
      <Icon strokeWidth={2.2} />
    </span>
  );
}

export function Badge({ tone = "ink", icon: Icon, children, className, size = "md" }: { tone?: Tone; icon?: LucideIcon; children: React.ReactNode; className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold", size === "sm" ? "h-6 px-2 text-caption" : "h-7 px-2.5 text-footnote", TONE[tone].soft, TONE[tone].ink, className)}>
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.4} aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const tone = toneFromText(name);
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink-strong", TONE[tone].bg, size === "sm" ? "size-8 text-caption" : size === "lg" ? "size-16 text-title-2" : "size-10 text-footnote", className)}>
      {initials(name)}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-footnote font-semibold text-ink-muted">{eyebrow}</div>}
        <h1 className="text-title-1 sm:text-large-title">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-callout text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function ProgressBar({ value, max = 100, tone = "mint", className, label }: { value: number; max?: number; tone?: Tone; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className={cn("relative h-4 overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="relative h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: TONE[tone].fill }}>
        <span className="absolute inset-x-2 top-[3px] h-[4px] rounded-full bg-white/45" />
      </div>
    </div>
  );
}

export function ProgressRing({ value, max = 100, tone = "mint", size = 64, stroke = 9, children, label }: { value: number; max?: number; tone?: Tone; size?: number; stroke?: number; children?: React.ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE[tone].fill} strokeOpacity={0.25} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE[tone].strong} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-caption font-semibold text-ink-muted">{children}</kbd>;
}
