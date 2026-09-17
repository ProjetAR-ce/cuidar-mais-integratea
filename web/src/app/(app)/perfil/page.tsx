import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui/primitives";
import { ServiceChip } from "@/components/care/service-chip";
import { ProfileForm } from "./profile-form";
import { ROLE_LABEL } from "@/types/domain";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("phone").eq("id", profile.id).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Meu perfil" subtitle="Seu perfil define o que você pode ver e fazer. Mudanças de perfil e serviço são feitas pela administração." />
      <Card className="mb-6 flex flex-wrap items-center gap-5 p-6">
        <Avatar name={profile.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-title-2">{profile.full_name}</h2>
          <p className="text-callout text-ink-muted">{profile.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="lilac">{ROLE_LABEL[profile.role]}</Badge>
            {profile.job_title && <Badge>{profile.job_title}</Badge>}
            {profile.service ? <ServiceChip name={profile.service.name} color={profile.service.color} /> : <Badge tone="mint">Rede toda</Badge>}
          </div>
        </div>
      </Card>
      <ProfileForm fullName={profile.full_name} phone={data?.phone ?? ""} />
    </div>
  );
}
