import Link from "next/link";
import { Target, Settings2 } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoals, getSettings, getUnits } from "@/lib/queries";
import { analyze } from "@/lib/strategy";
import { todaySP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Card, Stat } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { fmtBRL, fmtBRLShort, fmtPct } from "@/lib/format";
import { StrategyChart } from "./chart";
import { cn } from "@/lib/utils";

export const metadata = { title: "RPE 2030" };

export default async function Rpe2030Page() {
  const s = await requireMember();
  const supabase = await createClient();
  const [settings, units, goals, { data: targets }, { data: unitRev }, { data: itemsByGoal }, { data: expsByGoal }] = await Promise.all([
    getSettings(),
    getUnits(),
    getGoals(),
    supabase.from("annual_targets").select("*").order("year"),
    supabase.from("unit_annual_revenue").select("*"),
    supabase.from("agenda_items").select("strategic_goal_id,status").not("strategic_goal_id", "is", null).is("deleted_at", null),
    supabase.from("growth_ideas").select("strategic_goal_id,status").not("strategic_goal_id", "is", null),
  ]);
  const goal = settings.goal2030.revenue_target;
  const year = Number(todaySP().slice(0, 4));
  const rows = targets ?? [];
  const a = analyze(rows, settings.goal2030.year, goal, year);
  const lastYear = a.last?.year ?? year - 1;
  const contrib = units.map((u) => ({ unit: u, ...(unitRev ?? []).find((r) => r.unit_id === u.id && r.year === lastYear) }));
  const contribTotal = contrib.reduce((acc, c) => acc + (c.revenue_actual ?? 0), 0);

  const goalStats = goals.map((g) => {
    const items = (itemsByGoal ?? []).filter((i) => i.strategic_goal_id === g.id);
    const ideas = (expsByGoal ?? []).filter((i) => i.strategic_goal_id === g.id);
    const executing = items.filter((i) => ["scheduled", "discussed"].includes(i.status)).length + ideas.filter((i) => ["executing", "done", "scaled"].includes(i.status)).length;
    return { goal: g, total: items.length + ideas.length, executing };
  });

  return (
    <div className="fade-in">
      <PageHeader
        title="RPE 2030"
        label="Estratégia"
        dark
        action={s.isAdmin ? (
          <Button asChild variant="outline" size="sm" className="border-offwhite/30 text-offwhite">
            <Link href="/admin/metas">
              <Settings2 /> Metas
            </Link>
          </Button>
        ) : undefined}
      >
        <div className="mt-3">
          <div className="t-display text-5xl text-green md:text-6xl">{fmtBRLShort(goal)}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.15em] text-offwhite/60">de receita anual até {settings.goal2030.year}</div>
          <div className="mt-4 h-2 w-full bg-offwhite/10">
            <div className="h-2 bg-green" style={{ width: `${a.progress}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-offwhite/60 tabular">
            <span>{a.last ? `${fmtBRLShort(a.last.revenue_actual!)} em ${a.last.year}` : "Realizado não informado"}</span>
            <span>{a.progress.toFixed(0)}% da meta</span>
          </div>
        </div>
      </PageHeader>
      <Container className="space-y-6 pt-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat value={a.last ? fmtBRLShort(a.last.revenue_actual!) : "—"} label={`Receita ${a.last?.year ?? "anual"}`} />
          <Stat value={a.yoy != null ? fmtPct(a.yoy * 100) : "—"} label="Crescimento a/a" tone={a.yoy != null ? (a.yoy >= 0 ? "green" : "alert") : "default"} />
          <Stat value={a.realizedCagr != null ? fmtPct(a.realizedCagr * 100) : "—"} label="CAGR realizado" />
          <Stat value={a.requiredCagr != null ? fmtPct(a.requiredCagr * 100) : "—"} label="CAGR necessário" tone="amber" />
          <Stat value={a.projected2030 != null ? fmtBRLShort(a.projected2030) : "—"} label="Projeção 2030 (ritmo atual)" tone={a.projected2030 != null && a.projected2030 >= goal ? "green" : "alert"} className="col-span-2" />
          <Stat value={fmtBRLShort(a.gap)} label="Gap para a meta" tone="alert" className="col-span-2" />
        </div>

        <Card>
          <div className="section-label mb-2">Rota e cenários</div>
          {rows.length ? (
            <StrategyChart
              goal={goal}
              data={rows.map((r) => ({ year: String(r.year), realizado: r.revenue_actual, orcado: r.revenue_budget, meta: r.revenue_target, conservador: r.scenario_conservative, base: r.scenario_base, otimista: r.scenario_optimistic }))}
            />
          ) : (
            <p className="text-sm text-mute">Metas anuais ainda não cadastradas.</p>
          )}
          <p className="mt-2 text-[11px] text-mute">Cenários consideram crescimento orgânico e expansão separadamente; a contribuição de novos negócios é informada à parte para não contar receita duas vezes.</p>
        </Card>

        <Card>
          <div className="section-label mb-2">Metas intermediárias</div>
          <div className="scroll-x -mx-4 px-4">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="t-label text-left">
                  <th className="py-1">Ano</th>
                  <th className="py-1 text-right">Meta</th>
                  <th className="py-1 text-right">Orçado</th>
                  <th className="py-1 text-right">Realizado</th>
                  <th className="py-1 text-right">Expansão</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.year} className={cn("border-t border-line", r.year === settings.goal2030.year && "font-semibold")}>
                    <td className="py-1.5">{r.year}</td>
                    <td className="py-1.5 text-right">{r.revenue_target != null ? fmtBRLShort(r.revenue_target) : "—"}</td>
                    <td className="py-1.5 text-right">{r.revenue_budget != null ? fmtBRLShort(r.revenue_budget) : "—"}</td>
                    <td className="py-1.5 text-right">{r.revenue_actual != null ? fmtBRLShort(r.revenue_actual) : <span className="text-mute">Não inf.</span>}</td>
                    <td className="py-1.5 text-right">{r.expansion_contribution != null ? fmtBRLShort(r.expansion_contribution) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="section-label mb-2">Contribuição por unidade · {lastYear}</div>
          {contribTotal > 0 ? (
            <div className="space-y-2">
              {contrib
                .sort((x, y) => (y.revenue_actual ?? 0) - (x.revenue_actual ?? 0))
                .map((c) => {
                  const pct = c.revenue_actual ? (c.revenue_actual / contribTotal) * 100 : 0;
                  return (
                    <div key={c.unit.id}>
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{c.unit.name}</span>
                        <span className="tabular text-mute">
                          {c.revenue_actual != null ? fmtBRL(c.revenue_actual) : "Não inf."} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-black/8">
                        <div className="h-1.5 bg-black" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-mute">Receita anual por unidade ainda não informada (Administração → Metas).</p>
          )}
        </Card>

        <Card>
          <div className="section-label mb-2">Objetivos estratégicos × iniciativas</div>
          <div className="space-y-2">
            {goalStats.map(({ goal: g, total, executing }) => (
              <div key={g.id} className="flex items-center gap-3">
                <Target className={cn("size-4 shrink-0", total === 0 ? "text-mute" : executing === 0 ? "text-amber" : "text-green-dark")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{g.name}</div>
                  <div className="text-[11px] text-mute">
                    {total} iniciativa{total === 1 ? "" : "s"} · {executing} em execução{total > 0 && executing === 0 ? " · baixa execução" : ""}
                  </div>
                </div>
                <span className="t-display text-xl tabular">{total}</span>
              </div>
            ))}
          </div>
        </Card>
      </Container>
    </div>
  );
}
