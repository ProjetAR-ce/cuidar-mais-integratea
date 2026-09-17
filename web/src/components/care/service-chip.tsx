import { cn } from "@/lib/utils";
import { TONE, toneOf } from "@/components/ui/tone";

export function ServiceChip({ name, color, className, size = "md" }: { name: string; color?: string | null; className?: string; size?: "sm" | "md" }) {
  const t = TONE[toneOf(color)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold", size === "sm" ? "h-6 px-2 text-caption" : "h-7 px-2.5 text-footnote", t.soft, t.ink, className)}>
      <span aria-hidden className={cn("size-2 rounded-full", t.bg)} />
      {name}
    </span>
  );
}
