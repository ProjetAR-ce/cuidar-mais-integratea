import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, compact, tagline = true }: { className?: string; compact?: boolean; tagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image src="/brand/symbol.png" alt="" width={44} height={44} priority className="size-10 shrink-0 sm:size-11" />
      {!compact && (
        <div className="leading-none">
          <div className="text-[1.75rem] font-extrabold tracking-[-0.02em] text-ink">
            Cuidar<span className="text-mint-edge">+</span>
          </div>
          {tagline && <div className="mt-0.5 text-[0.6875rem] font-medium text-ink-muted">Inovação que transforma o cuidado.</div>}
        </div>
      )}
      <span className="sr-only">Cuidar+</span>
    </div>
  );
}

/** "Conexões orgânicas": bolhas suaves da identidade visual */
const PATHS = [
  "M44.7,-58.4C57.2,-49.6,66,-35.4,70.6,-19.6C75.2,-3.8,75.5,13.6,68.3,27.3C61.1,41,46.4,51,31,58.6C15.6,66.2,-0.5,71.4,-17.4,69.1C-34.3,66.8,-52,57,-62.7,42.1C-73.4,27.2,-77.1,7.2,-72.9,-10.3C-68.7,-27.8,-56.6,-42.8,-42.1,-51.4C-27.6,-60,-10.8,-62.2,3.9,-67.2C18.6,-72.2,32.2,-67.2,44.7,-58.4Z",
  "M39.5,-49.2C51.1,-38.2,60.2,-25.6,63.5,-11.1C66.8,3.4,64.3,19.8,55.9,31.9C47.5,44,33.2,51.8,17.6,57.9C2,64,-14.9,68.4,-30.2,63.3C-45.5,58.2,-59.2,43.6,-65.7,26.5C-72.2,9.4,-71.5,-10.2,-63.3,-25.4C-55.1,-40.6,-39.4,-51.4,-24.2,-61C-9,-70.6,5.7,-79,19.3,-75.6C32.9,-72.2,27.9,-60.2,39.5,-49.2Z",
  "M51.3,-62.3C64.4,-50.8,71.2,-32.4,72.2,-14.7C73.2,3,68.3,20,58.9,33.6C49.5,47.2,35.6,57.4,19.9,63.3C4.2,69.2,-13.3,70.8,-29.3,65.2C-45.3,59.6,-59.8,46.8,-66.5,30.7C-73.2,14.6,-72.1,-4.8,-65.4,-21.3C-58.7,-37.8,-46.4,-51.4,-32,-62.4C-17.6,-73.4,-1.1,-81.8,15.2,-80.3C31.5,-78.8,38.2,-73.8,51.3,-62.3Z",
];

export function Blob({ tone = "mint", variant = 0, className, opacity = 0.55 }: { tone?: "mint" | "peach" | "lilac" | "sun" | "rose"; variant?: 0 | 1 | 2; className?: string; opacity?: number }) {
  return (
    <svg viewBox="-80 -80 160 160" aria-hidden className={cn("pointer-events-none absolute", className)}>
      <path d={PATHS[variant]} fill={`var(--color-${tone})`} fillOpacity={opacity} />
    </svg>
  );
}
