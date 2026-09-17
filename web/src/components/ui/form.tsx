import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border-2 border-line bg-surface px-4 text-body text-ink-strong placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-lilac-edge focus:outline-none focus:ring-4 focus:ring-lilac/25 disabled:bg-surface-2 disabled:text-ink-muted aria-[invalid=true]:border-rose-edge aria-[invalid=true]:focus:ring-rose/25";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, "h-12 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
    </div>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-callout font-semibold text-ink-strong", className)} {...props} />;
}

export function Field({
  label, htmlFor, hint, error, required, children, className,
}: { label: string; htmlFor: string; hint?: React.ReactNode; error?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-rose-ink" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-footnote font-semibold text-rose-ink">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-footnote text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Seleção em cartões (radio visual estilo Duolingo) */
export function ChoiceCards<T extends string>({
  name, value, onChange, options, columns = 3,
}: {
  name: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string; icon?: React.ReactNode; tone?: string }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div role="radiogroup" className={cn("grid gap-3", columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-3")}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "relative flex cursor-pointer flex-col gap-1 rounded-lg border-2 bg-surface p-4 transition-all",
              "shadow-[0_4px_0_var(--color-line)] active:translate-y-1 active:shadow-none",
              checked ? "border-lilac-edge bg-lilac-soft shadow-[0_4px_0_var(--color-lilac-edge)]" : "border-line hover:border-line-strong"
            )}
          >
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="flex items-center gap-2 text-headline font-bold text-ink-strong">
              {o.icon}
              {o.label}
            </span>
            {o.description && <span className="text-footnote text-ink-muted">{o.description}</span>}
          </label>
        );
      })}
    </div>
  );
}
