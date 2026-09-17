import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/primitives";
import { DuplicatesBoard, type DupPair, type DupPatient } from "./duplicates-board";

export const metadata = { title: "Duplicidades" };

export default async function DuplicidadesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("duplicates.resolve");
  const sp = await searchParams;
  const status = sp.situacao === "revisadas" ? "revisadas" : "pendentes";
  const supabase = await createClient();

  let q = supabase.from("patient_duplicate_candidates").select("id, patient_id, candidate_id, score, reasons, status, created_at, reviewed_at, review_notes, kept_patient_id, reviewer:profiles!reviewed_by(full_name)").order("created_at", { ascending: false }).limit(50);
  q = status === "pendentes" ? q.eq("status", "pendente") : q.neq("status", "pendente");
  const { data: pairs } = await q;

  const ids = [...new Set((pairs ?? []).flatMap((p) => [p.patient_id, p.candidate_id]))];
  const [{ data: patients }, { data: queues }, { data: appts }] = await Promise.all([
    ids.length ? supabase.from("patients").select("id, full_name, social_name, birth_date, mother_name, cns, cpf, guardian_name, guardian_phone, neighborhood, aps_reference, school_name, created_at, status").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("queue_entries").select("patient_id").in("patient_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("appointments").select("patient_id").in("patient_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const count = (rows: { patient_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.patient_id === id).length;
  const byId = Object.fromEntries((patients ?? []).map((p) => [p.id, { ...p, queues: count(queues, p.id), appointments: count(appts, p.id) }])) as Record<string, DupPatient>;

  return (
    <>
      <PageHeader eyebrow="Cadastro único" title="Possíveis duplicidades" subtitle="O sistema aponta cadastros parecidos, mas nunca une registros sozinho. Compare e decida." />
      <DuplicatesBoard
        status={status}
        pairs={((pairs ?? []) as unknown as Omit<DupPair, "a" | "b">[]).filter((p) => byId[p.patient_id] && byId[p.candidate_id]).map((p) => ({ ...p, a: byId[p.patient_id], b: byId[p.candidate_id] }))}
      />
    </>
  );
}
