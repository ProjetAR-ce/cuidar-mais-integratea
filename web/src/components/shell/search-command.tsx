"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { Loader2, Search, UserPlus, UserRound } from "lucide-react";
import { searchPatients, type PatientHit } from "@/lib/actions/search";
import { age, fmtDate, maskCns } from "@/lib/format";
import { Avatar } from "@/components/ui/primitives";

export function SearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<PatientHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) { setQuery(""); setHits([]); setError(null); }
  }

  const onQuery = (v: string) => {
    setQuery(v);
    if (v.trim().length >= 2) setLoading(true);
  };

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      const res = await searchPatients(q);
      setLoading(false);
      if (res.error) setError(res.error);
      else { setError(null); setHits(res.data ?? []); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const go = (href: string) => { onOpenChange(false); router.push(href); };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-strong/25 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed top-[10vh] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-[28px] border border-line bg-surface shadow-float outline-none animate-[fade-up_200ms_ease-out]">
          <Dialog.Title className="sr-only">Buscar paciente</Dialog.Title>
          <Dialog.Description className="sr-only">Busque por nome, CNS, CPF, nome da mãe ou do responsável.</Dialog.Description>
          <Command shouldFilter={false} label="Buscar paciente">
            <div className="flex items-center gap-3 border-b border-line px-5">
              {loading ? <Loader2 className="size-6 animate-spin text-ink-muted" /> : <Search className="size-6 text-ink-muted" />}
              <Command.Input
                value={query}
                onValueChange={onQuery}
                autoFocus
                placeholder="Nome, CNS, CPF ou nome da mãe"
                className="h-16 flex-1 bg-transparent text-title-2 font-semibold text-ink-strong outline-none placeholder:font-normal placeholder:text-ink-faint"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {error && <p className="px-4 py-6 text-center text-callout text-rose-ink">{error}</p>}
              {query.trim().length < 2 && (
                <p className="px-4 py-8 text-center text-callout text-ink-muted">Digite pelo menos 2 letras. A busca aceita erros de digitação e nomes sem acento.</p>
              )}
              {query.trim().length >= 2 && !loading && !error && hits.length === 0 && (
                <Command.Empty className="px-4 py-8 text-center">
                  <p className="font-semibold text-ink-strong">Nenhum paciente encontrado</p>
                  <p className="text-footnote text-ink-muted">Confira a grafia ou cadastre uma nova pessoa.</p>
                </Command.Empty>
              )}
              {query.trim().length >= 2 && hits.length > 0 && (
                <Command.Group heading={<span className="px-3 text-caption font-bold tracking-wide text-ink-muted uppercase">Pacientes</span>}>
                  {hits.map((h) => (
                    <Command.Item
                      key={h.id}
                      value={h.id}
                      onSelect={() => go(`/pacientes/${h.id}`)}
                      className="flex cursor-pointer items-center gap-3 rounded-[16px] px-3 py-2.5 data-[selected=true]:bg-lilac-soft"
                    >
                      <Avatar name={h.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink-strong">{h.social_name ?? h.full_name}</p>
                        <p className="truncate text-footnote text-ink-muted">
                          {age(h.birth_date)} · nasc. {fmtDate(h.birth_date)} · mãe: {h.mother_name}
                          {h.cns ? ` · CNS ${maskCns(h.cns)}` : ""}
                        </p>
                      </div>
                      <span className="hidden rounded-full bg-surface-2 px-2 py-0.5 text-caption font-semibold text-ink-muted sm:inline">{h.match_reason}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {query.trim().length >= 2 && !loading && (
                <Command.Item
                  value="__novo"
                  onSelect={() => go(`/pacientes/novo?nome=${encodeURIComponent(query.trim())}`)}
                  className="mt-1 flex cursor-pointer items-center gap-3 rounded-[16px] px-3 py-3 data-[selected=true]:bg-mint-soft"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-mint text-ink-strong"><UserPlus className="size-4" /></span>
                  <span className="font-semibold text-ink-strong">Não encontrei — cadastrar “{query.trim()}”</span>
                </Command.Item>
              )}
            </Command.List>
            <div className="flex items-center gap-2 border-t border-line bg-surface-2/60 px-5 py-2.5 text-caption text-ink-muted">
              <UserRound className="size-3.5" /> Toda busca é registrada na auditoria.
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
