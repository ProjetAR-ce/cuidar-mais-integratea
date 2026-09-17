import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { Card, IconBubble } from "./primitives";
import { Blob } from "./brand";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types/domain";

export function StatCard({
  label, value, icon, tone, current, previous, invert, suffix, href, hint,
}: {
  label: string; value: React.ReactNode; icon: LucideIcon; tone: Exclude<Tone, "ink">;
  current?: number | null; previous?: number | null; invert?: boolean; suffix?: string; href?: string; hint?: string;
}) {
  let delta: number | null = null;
  if (current != null && previous != null && previous > 0) delta = Math.round(((current - previous) / previous) * 100);
  const good = delta == null ? null : invert ? delta <= 0 : delta >= 0;
  const body = (
    <Card className={cn("relative h-full overflow-hidden p-5 transition-transform", href && "hover:-translate-y-0.5")}>
      <Blob tone={tone} variant={(label.length % 3) as 0 | 1 | 2} className="-right-10 -bottom-12 size-32" opacity={0.45} />
      <IconBubble icon={icon} tone={tone} />
      <div className="relative mt-4 text-callout font-medium text-ink-muted">{label}</div>
      <div className="relative mt-0.5 text-[2.125rem] leading-tight font-extrabold text-ink-strong tabular">
        {value}
        {suffix && <span className="ml-1 text-title-2 font-bold">{suffix}</span>}
      </div>
      {delta != null ? (
        <div className="relative mt-1 flex items-center gap-1 text-footnote">
          <span className={cn("inline-flex items-center gap-0.5 font-bold", good ? "text-mint-ink" : "text-rose-ink")}>
            {delta >= 0 ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
            {Math.abs(delta)}%
          </span>
          <span className="text-ink-muted">vs. 30 dias anteriores</span>
        </div>
      ) : hint ? (
        <div className="relative mt-1 text-footnote text-ink-muted">{hint}</div>
      ) : null}
    </Card>
  );
  return href ? <Link href={href} className="block rounded-lg">{body}</Link> : body;
}
