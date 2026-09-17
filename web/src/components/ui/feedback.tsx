"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { Blob } from "./brand";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, className, celebrate }: { title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string; celebrate?: boolean }) {
  return (
    <div className={cn("relative flex flex-col items-center overflow-hidden rounded-xl px-6 py-12 text-center", className)}>
      <Blob tone="mint" variant={0} className="-top-10 -left-10 size-40" opacity={0.35} />
      <Blob tone="lilac" variant={1} className="-right-8 -bottom-12 size-44" opacity={0.3} />
      <div className="relative mb-4">
        {celebrate ? (
          <span className="flex size-20 animate-pop items-center justify-center rounded-full bg-primary text-white">
            <Check className="size-10" strokeWidth={3} />
          </span>
        ) : (
          <Image src="/brand/symbol.png" alt="" width={72} height={72} className="animate-float opacity-90" />
        )}
      </div>
      <h3 className="relative text-title-2">{title}</h3>
      {description && <p className="relative mt-1 max-w-sm text-callout text-ink-muted">{description}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

/** Microcelebração (Duolingo): check que pula + confete leve. Respeita reduced-motion via CSS. */
export function Celebrate({ show, message, onDone }: { show: boolean; message: string; onDone?: () => void }) {
  React.useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onDone?.(), 1900);
    return () => clearTimeout(t);
  }, [show, onDone]);

  const dots = React.useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ angle: (i / 18) * Math.PI * 2, dist: 70 + (i % 3) * 28, color: ["primary", "mint-edge", "peach-edge", "lilac-edge", "sun-edge"][i % 5] })),
    []
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="status" aria-live="polite"
        >
          <div className="relative flex flex-col items-center">
            {dots.map((d, i) => (
              <motion.span
                key={i}
                className="absolute top-10 left-1/2 size-3 rounded-full"
                style={{ background: `var(--color-${d.color})` }}
                initial={{ x: 0, y: 0, scale: 0 }}
                animate={{ x: Math.cos(d.angle) * d.dist, y: Math.sin(d.angle) * d.dist, scale: [0, 1.2, 0.8], opacity: [1, 1, 0] }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
            ))}
            <motion.span
              className="flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_30px_rgb(107_78_255/0.35)]"
              initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.45 }}
            >
              <Check className="size-11" strokeWidth={3.2} />
            </motion.span>
            <motion.p
              className="glass mt-4 rounded-full px-5 py-2 text-headline font-bold text-ink-strong shadow-float"
              initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
            >
              {message}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
