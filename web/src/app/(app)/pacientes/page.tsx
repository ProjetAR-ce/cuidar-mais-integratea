import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";
import { PageHeader, Card, Avatar } from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { age, fmtDate, fromNow } from "@/lib/format";
import { PatientSearch } from "./patient-search";

export const metadata = { title: "Pacientes" };

export default async function PacientesPage() {
  const profile = await requirePermission("patients.read");
  const supabase = await createClient();
  const [{ data: recent }, { count }] = await Promise.all([
    supabase.from("patients").select("id, full_name, social_name, birth_date, mother_name, created_at, neighborhood").neq("status", "mesclado").order("created_at", { ascending: false }).limit(8),
    supabase.from("patients").select("id", { count: "exact", head: true }).neq("status", "mesclado"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Cadastro único"
        title="Pacientes"
        subtitle={`${count ?? 0} pessoas na rede. Antes de cadastrar, busque para não criar um registro duplicado.`}
        actions={can(profile.role, "patients.create") && <Button asChild variant="lilac"><Link href="/pacientes/digitalizar"><ScanLine /> Digitalizar ficha em papel</Link></Button>}
      />
      <PatientSearch />

      <section className="mt-10">
        <h2 className="mb-3 text-title-2">Cadastrados recentemente</h2>
        <Card className="divide-y divide-line overflow-hidden">
          {(recent ?? []).map((p) => (
            <Link key={p.id} href={`/pacientes/${p.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/70">
              <Avatar name={p.full_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink-strong">{p.social_name ?? p.full_name}</p>
                <p className="truncate text-footnote text-ink-muted">
                  {age(p.birth_date)} · nasc. {fmtDate(p.birth_date)} · mãe: {p.mother_name}
                </p>
              </div>
              <span className="hidden text-footnote text-ink-muted sm:block">cadastrado {fromNow(p.created_at)}</span>
              <ChevronRight className="size-5 text-ink-faint" aria-hidden />
            </Link>
          ))}
        </Card>
      </section>
    </>
  );
}
