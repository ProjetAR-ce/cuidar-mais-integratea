"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { removeOffer, updateOffer } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";
import { ServiceChip } from "@/components/care/service-chip";
import type { Service, Specialty } from "@/types/domain";

type Offer = { service_id: string; specialty_id: string; monthly_capacity: number; professionals_count: number };

export function ServicesPanel({ services, specialties, offers }: { services: Service[]; specialties: Specialty[]; offers: Offer[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {services.map((s) => <ServiceCard key={s.id} service={s} specialties={specialties} offers={offers.filter((o) => o.service_id === s.id)} />)}
    </div>
  );
}

function ServiceCard({ service, specialties, offers }: { service: Service; specialties: Specialty[]; offers: Offer[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(offers);
  const [adding, setAdding] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [prevOffers, setPrevOffers] = React.useState(offers);
  if (offers !== prevOffers) { setPrevOffers(offers); setRows(offers); }
  const spName = Object.fromEntries(specialties.map((s) => [s.id, s.name]));
  const total = rows.reduce((a, r) => a + Number(r.monthly_capacity || 0), 0);

  const save = async (r: Offer) => {
    setBusy(r.specialty_id);
    const res = await updateOffer(service.id, r.specialty_id, Number(r.monthly_capacity), Number(r.professionals_count));
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Capacidade de ${spName[r.specialty_id]} atualizada`);
    router.refresh();
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <ServiceChip name={service.name} color={service.color} />
        <span className="text-footnote text-ink-muted">{service.description} · {service.secretaria}</span>
        <span className="ml-auto text-footnote font-bold text-ink-strong tabular">{total} vagas/mês</span>
      </div>
      <table className="w-full text-left">
        <caption className="sr-only">Especialidades ofertadas em {service.name}</caption>
        <thead>
          <tr className="text-caption font-bold tracking-wide text-ink-muted uppercase">
            <th scope="col" className="px-5 py-2">Especialidade</th>
            <th scope="col" className="w-28 px-2 py-2">Vagas/mês</th>
            <th scope="col" className="w-28 px-2 py-2">Profissionais</th>
            <th scope="col" className="w-24 px-5 py-2"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const changed = offers[i] && (offers[i].monthly_capacity !== Number(r.monthly_capacity) || offers[i].professionals_count !== Number(r.professionals_count));
            return (
              <tr key={r.specialty_id} className="border-t border-line">
                <th scope="row" className="px-5 py-2 font-semibold text-ink-strong">{spName[r.specialty_id]}</th>
                <td className="px-2 py-2"><Input aria-label={`Vagas por mês de ${spName[r.specialty_id]}`} type="number" min={0} className="h-10" value={r.monthly_capacity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, monthly_capacity: Number(e.target.value) } : x)))} /></td>
                <td className="px-2 py-2"><Input aria-label={`Profissionais de ${spName[r.specialty_id]}`} type="number" min={0} className="h-10" value={r.professionals_count} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, professionals_count: Number(e.target.value) } : x)))} /></td>
                <td className="px-5 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant={changed ? "mint" : "ghost"} aria-label="Salvar" loading={busy === r.specialty_id} onClick={() => save(r)} disabled={!changed}><Save /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remover ${spName[r.specialty_id]}`} onClick={async () => {
                      const res = await removeOffer(service.id, r.specialty_id);
                      if (!res.ok) return toast.error(res.error);
                      toast.success("Especialidade removida do serviço");
                      router.refresh();
                    }}><Trash2 /></Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex gap-2 border-t border-line p-4">
        <label htmlFor={`add-${service.id}`} className="sr-only">Adicionar especialidade</label>
        <Select id={`add-${service.id}`} value={adding} onChange={(e) => setAdding(e.target.value)} className="h-10">
          <option value="">Adicionar especialidade…</option>
          {specialties.filter((s) => !rows.some((r) => r.specialty_id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Button variant="secondary" disabled={!adding} onClick={async () => {
          const res = await updateOffer(service.id, adding, 10, 1);
          if (!res.ok) return toast.error(res.error);
          setAdding("");
          toast.success("Especialidade adicionada");
          router.refresh();
        }}><Plus /> Adicionar</Button>
      </div>
    </Card>
  );
}
