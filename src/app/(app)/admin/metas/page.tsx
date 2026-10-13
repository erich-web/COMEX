import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoals, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { TargetsEditor, UnitRevenueEditor, GoalsEditor } from "./editors";

export const metadata = { title: "Metas RPE 2030" };

export default async function MetasPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: targets }, units, goals, { data: unitRev }] = await Promise.all([supabase.from("annual_targets").select("*").order("year"), getUnits(), getGoals(), supabase.from("unit_annual_revenue").select("*")]);
  const years = Array.from({ length: 6 }, (_, i) => 2025 + i);
  return (
    <div className="fade-in">
      <PageHeader title="Metas RPE 2030" label="Planejamento estratégico" back="/admin" />
      <Container className="space-y-6">
        <TargetsEditor rows={years.map((y) => (targets ?? []).find((t) => t.year === y) ?? { year: y, revenue_target: null, revenue_budget: null, revenue_actual: null, scenario_conservative: null, scenario_base: null, scenario_optimistic: null, expansion_contribution: null, note: null })} />
        <UnitRevenueEditor units={units.map((u) => ({ id: u.id, name: u.name }))} rows={(unitRev ?? []).map((r) => ({ unit_id: r.unit_id, year: r.year, revenue_actual: r.revenue_actual, revenue_budget: r.revenue_budget }))} years={years} />
        <GoalsEditor goals={goals.map((g) => ({ id: g.id, name: g.name, description: g.description }))} />
      </Container>
    </div>
  );
}
