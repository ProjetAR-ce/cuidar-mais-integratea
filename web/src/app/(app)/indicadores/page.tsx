import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReference } from "@/lib/data/reference";
import { todayLocalISODate } from "@/lib/format";
import { IndicatorsBoard, type Indicators } from "./indicators-board";

export const metadata = { title: "Indicadores" };

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("indicators.read");
  const sp = await searchParams;
  const to = typeof sp.ate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.ate) ? sp.ate : todayLocalISODate();
  const from = typeof sp.de === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.de) ? sp.de : todayLocalISODate(-180);
  const serviceId = typeof sp.servico === "string" && sp.servico !== "todos" ? sp.servico : null;

  const supabase = await createClient();
  const ref = await getReference();
  const { data, error } = await supabase.rpc("get_indicators", { p_from: from, p_to: to, p_service: serviceId });
  if (error) throw new Error(error.message);

  return <IndicatorsBoard data={data as Indicators} filters={{ from, to, serviceId: serviceId ?? "todos" }} services={ref.services} />;
}
