import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { PageHeader } from "@/components/ui/primitives";
import { TabLinks } from "@/components/ui/tab-links";
import { UsersPanel, type UserRow } from "./users-panel";
import { ServicesPanel } from "./services-panel";
import { ParametersPanel, type Parameter } from "./parameters-panel";

export const metadata = { title: "Administração" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requirePermission("admin");
  const sp = await searchParams;
  const tab = typeof sp.aba === "string" ? sp.aba : "usuarios";
  const supabase = await createClient();
  const ref = await getReference();

  const [{ data: users }, { data: params }, { data: allOffers }] = await Promise.all([
    tab === "usuarios" ? supabase.from("profiles").select("id, full_name, email, role, service_id, specialty_id, job_title, active, created_at").order("full_name") : Promise.resolve({ data: [] }),
    tab === "parametros" ? supabase.from("system_parameters").select("key, value, label, description, updated_at").order("key") : Promise.resolve({ data: [] }),
    tab === "servicos" ? supabase.from("service_specialties").select("service_id, specialty_id, monthly_capacity, professionals_count, active") : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Acesso auditado" title="Administração" subtitle="Usuários, perfis, serviços, capacidade e parâmetros da rede. Toda alteração fica na auditoria." />
      <div className="mb-6">
        <TabLinks label="Seções da administração" active={tab} tabs={[
          { key: "usuarios", label: "Usuários", href: "/admin" },
          { key: "servicos", label: "Serviços e capacidade", href: "/admin?aba=servicos" },
          { key: "parametros", label: "Parâmetros", href: "/admin?aba=parametros" },
        ]} />
      </div>
      {tab === "usuarios" && <UsersPanel users={(users ?? []) as UserRow[]} services={ref.services} specialties={ref.specialties} currentUserId={profile.id} />}
      {tab === "servicos" && <ServicesPanel services={ref.services} specialties={ref.specialties} offers={(allOffers ?? []).filter((o) => o.active)} />}
      {tab === "parametros" && <ParametersPanel params={(params ?? []) as Parameter[]} />}
    </>
  );
}
