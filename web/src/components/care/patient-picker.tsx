"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { searchPatients, type PatientHit } from "@/lib/actions/search";
import { Avatar } from "@/components/ui/primitives";
import { age, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PickedPatient = { id: string; full_name: string; birth_date: string; mother_name?: string };

/** Busca + seleção de paciente (combobox acessível) */
export function PatientPicker({ value, onChange, id = "patient", autoFocus }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; id?: string; autoFocus?: boolean }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<PatientHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const r = await searchPatients(q);
      setHits(r.data ?? []);
      setLoading(false);
      setOpen(true);
      setActive(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border-2 border-mint-edge bg-mint-soft p-3">
        <Avatar name={value.full_name} />
        <div className="min-w-0 flex-1">
          <Link href={`/pacientes/${value.id}`} className="block truncate font-bold text-ink-strong hover:underline">{value.full_name}</Link>
          <p className="truncate text-footnote text-ink-muted">{age(value.birth_date)} · nasc. {fmtDate(value.birth_date)}{value.mother_name ? ` · mãe: ${value.mother_name}` : ""}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="flex size-9 items-center justify-center rounded-full bg-surface text-ink-muted hover:text-ink" aria-label="Trocar paciente">
          <X className="size-5" />
        </button>
      </div>
    );
  }

  const pick = (h: PatientHit) => { onChange({ id: h.id, full_name: h.full_name, birth_date: h.birth_date, mother_name: h.mother_name }); setQ(""); setOpen(false); };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length >= 2) setLoading(true);
          else { setHits([]); setOpen(false); }
        }}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); pick(hits[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Buscar por nome, CNS, CPF ou nome da mãe"
        className="h-12 w-full rounded-md border-2 border-line bg-surface pr-10 pl-12 text-body text-ink-strong placeholder:text-ink-faint hover:border-line-strong focus:border-lilac-edge focus:ring-4 focus:ring-lilac/25 focus:outline-none"
      />
      {loading && <Loader2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-ink-muted" />}
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-float">
          {hits.length === 0 ? (
            <li className="px-3 py-4 text-center text-callout text-ink-muted">Nenhum paciente encontrado.</li>
          ) : hits.map((h, i) => (
            <li
              key={h.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2", i === active && "bg-lilac-soft")}
            >
              <Avatar name={h.full_name} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-strong">{h.full_name}</p>
                <p className="truncate text-caption text-ink-muted">{age(h.birth_date)} · {fmtDate(h.birth_date)} · mãe: {h.mother_name}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
