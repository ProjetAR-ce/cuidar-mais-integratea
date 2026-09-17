import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ScanFlow } from "./scan-flow";

export const metadata = { title: "Digitalizar ficha" };
export const maxDuration = 60;

export default async function DigitalizarPage() {
  const profile = await requirePermission("patients.create");
  return <ScanFlow clinical={can(profile.role, "patients.clinical")} />;
}
