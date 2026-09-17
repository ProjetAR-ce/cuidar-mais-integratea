import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas por URL (funciona sem JS e mantém o estado no link) */
export function TabLinks({ tabs, active, label }: { tabs: { href: string; key: string; label: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-[16px] bg-surface-2 p-1">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[12px] px-4 text-callout font-semibold transition",
                  on ? "bg-surface text-ink-strong shadow-[0_1px_3px_rgb(16_24_40/0.12)]" : "text-ink-muted hover:text-ink"
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={cn("rounded-full px-1.5 text-caption tabular", on ? "bg-lilac-soft text-lilac-ink" : "bg-line text-ink-muted")}>{t.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
