"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Controle segmentado estilo iOS, com indicador que desliza. */
export function SegmentedControl<T extends string>({
  value, onChange, options, className, size = "md", label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
  label: string;
}) {
  const id = React.useId();
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto rounded-[14px] bg-surface-2 p-1 scrollbar-none", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-[10px] font-semibold transition-colors",
              size === "sm" ? "h-8 px-3 text-footnote" : "h-9 px-4 text-callout",
              active ? "text-ink-strong" : "text-ink-muted hover:text-ink"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px] bg-surface shadow-[0_1px_3px_rgb(16_24_40/0.12),0_1px_1px_rgb(16_24_40/0.04)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && (
              <span className={cn("relative rounded-full px-1.5 text-caption tabular", active ? "bg-primary-soft text-primary-ink" : "bg-line text-ink-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
