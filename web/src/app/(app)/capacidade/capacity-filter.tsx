"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form";
import type { Service } from "@/types/domain";

export function CapacityFilter({ services, value }: { services: Service[]; value: string }) {
  const router = useRouter();
  return (
    <div className="w-56">
      <label htmlFor="cap-service" className="sr-only">Serviço</label>
      <Select id="cap-service" value={value} onChange={(e) => router.push(e.target.value === "todos" ? "/capacidade" : `/capacidade?servico=${e.target.value}`)}>
        <option value="todos">Todos os serviços</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
    </div>
  );
}
