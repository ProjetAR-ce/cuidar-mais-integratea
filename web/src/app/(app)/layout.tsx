import { AppShell } from "@/components/shell/app-shell";
import { requireProfile } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const referralsQuery = () => {
    let q = supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "pendente");
    if (profile.role === "profissional" && profile.service_id) q = q.eq("destination_service_id", profile.service_id);
    return q;
  };

  const [alerts, referrals, duplicates] = await Promise.all([
    can(profile.role, "alerts.review")
      ? supabase.from("care_alerts").select("id", { count: "exact", head: true }).eq("status", "pendente")
      : Promise.resolve({ count: 0 }),
    can(profile.role, "referrals.manage") ? referralsQuery() : Promise.resolve({ count: 0 }),
    can(profile.role, "duplicates.resolve")
      ? supabase.from("patient_duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "pendente")
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <AppShell profile={profile} counts={{ alerts: alerts.count ?? 0, referrals: referrals.count ?? 0, duplicates: duplicates.count ?? 0 }}>
      {children}
    </AppShell>
  );
}
