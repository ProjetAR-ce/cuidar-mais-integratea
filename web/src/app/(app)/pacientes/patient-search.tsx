"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { CalendarSearch, ChevronRight, Loader2, Search, UserPlus } from "lucide-react";
import { searchPatients, type PatientHit } from "@/lib/actions/search";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card } from "@/components/ui/primitives";
import { age, fmtDate, maskCns } from "@/lib/format";

export function PatientSearch() {
  const [query, setQuery] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [hits, setHits] = React.useState<PatientHit[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searched, setSearched] = React.useState("");

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2 && !birth) { setError("Digite pelo menos 2 letras, o CNS/CPF ou a data de nascimento."); return; }
    setLoading(true);
    setError(null);
    const r = await searchPatients(query, birth || null);
    setLoading(false);
    if (r.error) { setError(r.error); setHits(null); return; }
    setHits(r.data ?? []);
    setSearched(query.trim());
  }

  const newHref = `/pacientes/novo?nome=${encodeURIComponent(searched)}${birth ? `&nascimento=${birth}` : ""}`;

  return (
    <div>
      <Card className="relative overflow-hidden p-4 sm:p-5">
        <form onSubmit={run} className="flex flex-col gap-3 md:flex-row" role="search">
          <label htmlFor="busca" className="sr-only">Nome, CNS, CPF, nome da mãe ou do responsável</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-5 size-6 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input
              id="busca"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, CNS, CPF, nome da mãe ou do responsável"
              className="h-16 w-full rounded-[20px] border-2 border-line bg-surface-2/60 pr-4 pl-14 text-title-2 font-semibold text-ink-strong placeholder:text-headline placeholder:font-normal placeholder:text-ink-faint focus:border-lilac-edge focus:bg-surface focus:ring-4 focus:ring-lilac/25 focus:outline-none"
            />
          </div>
          <div className="relative md:w-56">
            <label htmlFor="nasc" className="sr-only">Data de nascimento (opcional)</label>
            <CalendarSearch className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input id="nasc" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} title="Data de nascimento (opcional)" className="h-16 w-full rounded-[20px] border-2 border-line bg-surface-2/60 pr-3 pl-12 text-body text-ink-strong focus:border-lilac-edge focus:bg-surface focus:ring-4 focus:ring-lilac/25 focus:outline-none" />
          </div>
          <Button type="submit" size="lg" className="h-16 md:px-8" loading={loading}>
            {!loading && <Search />} Buscar
          </Button>
        </form>
        {error && <p role="alert" className="mt-3 text-callout font-semibold text-rose-ink">{error}</p>}
      </Card>

      <div aria-live="polite">
        <AnimatePresence mode="wait">
          {hits && (
            <motion.div key={searched + hits.length} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-callout text-ink-muted">
                  {hits.length === 0 ? "Nenhum cadastro encontrado para esta busca." : `${hits.length} ${hits.length === 1 ? "resultado" : "resultados"} — confira se a pessoa já está na lista.`}
                </p>
                <Button asChild variant="mint">
                  <Link href={newHref}><UserPlus /> {hits.length ? "Não é nenhuma dessas pessoas" : "Cadastrar nova pessoa"}</Link>
                </Button>
              </div>
              {hits.length > 0 && (
                <Card className="divide-y divide-line overflow-hidden">
                  {hits.map((h) => (
                    <Link key={h.id} href={`/pacientes/${h.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-lilac-soft/50">
                      <Avatar name={h.full_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-headline font-bold text-ink-strong">{h.social_name ?? h.full_name}</p>
                        <p className="text-footnote text-ink-muted">
                          {age(h.birth_date)} · nasc. {fmtDate(h.birth_date)} · mãe: {h.mother_name}
                          {h.guardian_name && h.guardian_name !== h.mother_name ? ` · resp.: ${h.guardian_name}` : ""}
                        </p>
                        <p className="text-caption text-ink-muted">{h.cns ? `CNS ${maskCns(h.cns)}` : "Sem CNS informado"}{h.aps_reference ? ` · ${h.aps_reference}` : ""}</p>
                      </div>
                      <Badge tone={h.score >= 0.99 ? "mint" : h.score >= 0.6 ? "lilac" : "ink"} size="sm" className="hidden sm:inline-flex">{h.match_reason}</Badge>
                      <ChevronRight className="size-5 text-ink-faint" aria-hidden />
                    </Link>
                  ))}
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {loading && !hits && <p className="mt-6 flex items-center gap-2 text-ink-muted"><Loader2 className="size-4 animate-spin" /> Buscando…</p>}
      </div>
    </div>
  );
}
