import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { NewPatientForm } from "./new-patient-form";

export const metadata = { title: "Novo paciente" };

export default async function NovoPacientePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requirePermission("patients.create");
  const sp = await searchParams;
  return <NewPatientForm initialName={typeof sp.nome === "string" ? sp.nome : ""} initialBirth={typeof sp.nascimento === "string" ? sp.nascimento : ""} clinical={can(profile.role, "patients.clinical")} />;
}
