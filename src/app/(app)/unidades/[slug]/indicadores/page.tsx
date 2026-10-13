import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnitKpis } from "@/lib/queries";
import { todaySP, weekStart, addDays } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { KpiForm } from "./kpi-form";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Atualizar indicadores" };

export default async function IndicadoresPage({ params, searchParams }: PageProps<"/unidades/[slug]/indicadores">) {
  const { slug } = await params;
  const sp = await searchParams;
  const s = await requireMember();
  const supabase = await createClient();
  const { data: unit } = await supabase.from("business_units").select("*").eq("slug", slug).maybeSingle();
  if (!unit) notFound();
  const canEdit = s.isAdmin || s.units.some((u) => u.unit_id === unit.id && u.can_edit);
  if (!canEdit) redirect(`/unidades/${slug}`);

  const today = todaySP();
  // semana a informar: por padrão a semana anterior (dados fechados), ou ?semana=YYYY-MM-DD
  const requested = typeof sp.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : addDays(weekStart(today), -7);
  const ws = weekStart(requested);
  const kpis = await getUnitKpis(unit.id);
  const [{ data: current }, { data: prev }] = await Promise.all([
    supabase.from("kpi_entries").select("*").eq("unit_id", unit.id).eq("period", "week").eq("period_start", ws),
    supabase.from("kpi_entries").select("kpi_id,value").eq("unit_id", unit.id).eq("period", "week").eq("period_start", addDays(ws, -7)),
  ]);

  return (
    <div className="fade-in">
      <PageHeader title="Atualizar indicadores" label={unit.name} back={`/unidades/${slug}`}>
        <p className="mt-2 text-xs text-mute">
          Semana de {fmtDate(ws, { day: "2-digit", month: "short" })} a {fmtDate(addDays(ws, 6), { day: "2-digit", month: "short" })}. Deixe em branco o que não souber — nunca estimamos valores.
        </p>
      </PageHeader>
      <Container>
        <KpiForm
          unitId={unit.id}
          slug={slug}
          weekStart={ws}
          kpis={kpis.map((k) => ({ id: k.id, key: k.key, name: k.name, unit_type: k.unit_type, has_budget: k.has_budget, has_prior_year: k.has_prior_year, category: k.category }))}
          current={(current ?? []).map((c) => ({ kpi_id: c.kpi_id, value: c.value, budget_value: c.budget_value, prior_year_value: c.prior_year_value, note: c.note }))}
          previous={(prev ?? []).map((p) => ({ kpi_id: p.kpi_id, value: p.value }))}
        />
      </Container>
    </div>
  );
}
