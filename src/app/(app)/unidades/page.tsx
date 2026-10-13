import Link from "next/link";
import { Store, ChevronRight } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnits, getUnitsRevenueSnapshot } from "@/lib/queries";
import { todaySP, weekStart } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { fmtBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Unidades" };

export default async function UnidadesPage() {
  const s = await requireMember();
  const supabase = await createClient();
  const units = await getUnits();
  const ws = weekStart(todaySP());
  const [snapshot, { data: checkins }, { data: members }] = await Promise.all([
    getUnitsRevenueSnapshot(units.map((u) => u.id)),
    supabase.from("weekly_checkins").select("unit_id").eq("week_start", ws),
    supabase.from("business_unit_members").select("unit_id, is_lead, profile:profiles(short_name,full_name)"),
  ]);
  const checked = new Set((checkins ?? []).map((c) => c.unit_id));
  const myIds = new Set(s.units.map((u) => u.unit_id));
  const ordered = [...units].sort((a, b) => Number(myIds.has(b.id)) - Number(myIds.has(a.id)) || a.sort_order - b.sort_order);

  return (
    <div className="fade-in">
      <PageHeader title="Unidades" label="Business Review" />
      <Container>
        {ordered.length === 0 ? (
          <EmptyState title="Nenhuma unidade cadastrada" icon={<Store />} />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {ordered.map((u) => {
              const r = snapshot.find((x) => x.unit_id === u.id);
              const leads = (members ?? []).filter((m) => m.unit_id === u.id && m.is_lead).map((m) => m.profile?.short_name ?? m.profile?.full_name).filter(Boolean);
              const vsBudget = r?.value != null && r.budget_value ? ((r.value - r.budget_value) / r.budget_value) * 100 : null;
              const stale = !r?.period_start || r.period_start < ws;
              return (
                <Link key={u.id} href={`/unidades/${u.slug}`} className={cn("flex items-center gap-3 border bg-surface p-4 transition-colors hover:border-black", myIds.has(u.id) ? "border-black" : "border-line")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="t-display text-xl">{u.name}</span>
                      {myIds.has(u.id) ? <Badge variant="green">Minha</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-mute">
                      {u.pillar}
                      {leads.length ? ` · ${leads.join(", ")}` : " · sem responsável"}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="t-display text-lg tabular">{r?.value != null ? fmtBRL(r.value) : <span className="text-mute">Não informado</span>}</span>
                      {vsBudget != null ? <span className={cn("text-xs font-semibold tabular", vsBudget >= 0 ? "text-green-dark" : "text-alert")}>{`${vsBudget >= 0 ? "+" : ""}${vsBudget.toFixed(1)}% vs orçado`}</span> : null}
                      {stale ? <Badge variant="amber">Indicadores</Badge> : null}
                      {!checked.has(u.id) ? <Badge variant="amber">Check-in</Badge> : <Badge variant="greenSoft">Check-in ok</Badge>}
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-mute" />
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
