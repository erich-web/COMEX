import { notFound } from "next/navigation";
import Link from "next/link";
import { BarChart3, ClipboardCheck } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnitKpis } from "@/lib/queries";
import { todaySP, weekStart, addDays } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDateTime, fmtKpi } from "@/lib/format";
import { TaskListItem } from "@/components/app/task-item";
import type { TaskRow } from "@/lib/queries";
import { RevenueChart } from "./revenue-chart";
import { cn } from "@/lib/utils";

export default async function UnidadePage({ params }: PageProps<"/unidades/[slug]">) {
  const { slug } = await params;
  const s = await requireMember();
  const supabase = await createClient();
  const { data: unit } = await supabase.from("business_units").select("*").eq("slug", slug).maybeSingle();
  if (!unit) notFound();
  const today = todaySP();
  const ws = weekStart(today);
  const canEdit = s.isAdmin || s.units.some((u) => u.unit_id === unit.id && u.can_edit);

  const [kpis, { data: entries }, { data: checkins }, { data: tasks }, { data: members }] = await Promise.all([
    getUnitKpis(unit.id),
    supabase.from("kpi_entries").select("*").eq("unit_id", unit.id).eq("period", "week").gte("period_start", addDays(ws, -7 * 13)).order("period_start", { ascending: false }),
    supabase.from("weekly_checkins").select("*, author:profiles(short_name,full_name)").eq("unit_id", unit.id).order("week_start", { ascending: false }).limit(4),
    supabase.from("tasks").select("*, owner:profiles!tasks_owner_id_fkey(id,short_name,full_name), unit:business_units(id,name)").eq("unit_id", unit.id).is("deleted_at", null).not("status", "in", '("done","cancelled")').order("due_date", { ascending: true, nullsFirst: false }).limit(10),
    supabase.from("business_unit_members").select("is_lead, profile:profiles(short_name,full_name)").eq("unit_id", unit.id),
  ]);

  const byKpi = new Map<string, typeof entries>();
  for (const e of entries ?? []) {
    if (!byKpi.has(e.kpi_id)) byKpi.set(e.kpi_id, []);
    byKpi.get(e.kpi_id)!.push(e);
  }
  const revenueKpi = kpis.find((k) => k.key === "revenue");
  const revSeries = revenueKpi ? [...(byKpi.get(revenueKpi.id) ?? [])].reverse() : [];
  const latestWeek = (entries ?? [])[0]?.period_start ?? null;
  const stale = !latestWeek || latestWeek < ws;
  const checkin = (checkins ?? [])[0];
  const checkinCurrent = checkin && checkin.week_start === ws;

  // acumulados (mês/ano) a partir das semanas informadas
  const monthStart = today.slice(0, 8) + "01";
  const yearStart = today.slice(0, 5) + "01-01";
  const mtd = revSeries.filter((e) => e.period_start >= monthStart).reduce((a, e) => a + (e.value ?? 0), 0);
  const ytd = revSeries.filter((e) => e.period_start >= yearStart).reduce((a, e) => a + (e.value ?? 0), 0);
  const weeksMtd = revSeries.filter((e) => e.period_start >= monthStart && e.value != null).length;

  return (
    <div className="fade-in">
      <PageHeader
        title={unit.name}
        label={`${unit.pillar}${unit.city ? ` · ${unit.city}` : ""}`}
        back="/unidades"
        action={canEdit ? (
          <Button asChild variant="green" size="sm">
            <Link href={`/unidades/${slug}/indicadores`}>
              <BarChart3 /> Atualizar
            </Link>
          </Button>
        ) : undefined}
      >
        <div className="mt-2 text-[11px] text-mute">
          Responsáveis: {(members ?? []).map((m) => m.profile?.short_name ?? m.profile?.full_name).filter(Boolean).join(", ") || "não definidos"}
          {latestWeek ? ` · última atualização: semana de ${fmtDate(latestWeek, { day: "2-digit", month: "short" })}` : ""}
        </div>
      </PageHeader>
      <Container className="space-y-5">
        {canEdit && (stale || !checkinCurrent) ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {stale ? (
              <Link href={`/unidades/${slug}/indicadores`} className="flex items-center gap-3 border border-amber/40 bg-amber/10 px-3 py-2.5 text-sm font-medium text-amber">
                <BarChart3 className="size-4" /> Indicadores da semana ainda não informados
              </Link>
            ) : null}
            {!checkinCurrent ? (
              <Link href={`/unidades/${slug}/checkin`} className="flex items-center gap-3 border border-amber/40 bg-amber/10 px-3 py-2.5 text-sm font-medium text-amber">
                <ClipboardCheck className="size-4" /> Check-in semanal pendente
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Receita */}
        <section>
          <div className="section-label mb-2">Comercial</div>
          <Card>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="t-label">Receita da última semana informada</div>
                <div className="t-display mt-1 text-3xl tabular">{revSeries.at(-1)?.value != null ? fmtKpi(revSeries.at(-1)!.value, "currency") : "Não informado"}</div>
              </div>
              <div className="text-right text-xs text-mute">
                <div>
                  Mês: <span className="font-semibold text-ink tabular">{weeksMtd ? fmtKpi(mtd, "currency") : "—"}</span>
                </div>
                <div>
                  Ano: <span className="font-semibold text-ink tabular">{ytd ? fmtKpi(ytd, "currency") : "—"}</span>
                </div>
              </div>
            </div>
            {revSeries.filter((e) => e.value != null).length >= 2 ? (
              <div className="mt-4">
                <RevenueChart data={revSeries.map((e) => ({ week: fmtDate(e.period_start, { day: "2-digit", month: "2-digit" }), realizado: e.value, orcado: e.budget_value, anoAnterior: e.prior_year_value }))} />
              </div>
            ) : (
              <p className="mt-3 text-xs text-mute">A tendência aparece após duas semanas informadas.</p>
            )}
          </Card>
        </section>

        {/* Grade de indicadores */}
        <section>
          <div className="section-label mb-2">Indicadores</div>
          {kpis.length === 0 ? (
            <EmptyState title="Sem indicadores configurados" />
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {kpis.map((k) => {
                const list = byKpi.get(k.id) ?? [];
                const cur = list[0];
                const prev = list[1];
                const vsBudget = cur?.value != null && cur.budget_value ? ((cur.value - cur.budget_value) / Math.abs(cur.budget_value)) * 100 : null;
                const vsPrev = cur?.value != null && prev?.value ? ((cur.value - prev.value) / Math.abs(prev.value)) * 100 : null;
                const vsPY = cur?.value != null && cur.prior_year_value ? ((cur.value - cur.prior_year_value) / Math.abs(cur.prior_year_value)) * 100 : null;
                const good = (d: number | null) => (d == null ? null : k.higher_is_better ? d >= 0 : d <= 0);
                return (
                  <div key={k.id} className="border border-line bg-surface p-3">
                    <div className="t-label truncate">{k.name}</div>
                    <div className={cn("t-display mt-1 text-xl tabular", cur?.value == null && "text-mute")}>{cur?.value != null ? fmtKpi(cur.value, k.unit_type) : "Não inf."}</div>
                    <div className="mt-1 space-y-0.5 text-[11px]">
                      <Delta label="vs orçado" d={vsBudget} good={good(vsBudget)} />
                      <Delta label="vs sem. ant." d={vsPrev} good={good(vsPrev)} />
                      {k.has_prior_year ? <Delta label="vs ano ant." d={vsPY} good={good(vsPY)} /> : null}
                    </div>
                    {cur ? <div className="mt-1 text-[10px] text-mute">sem. {fmtDate(cur.period_start, { day: "2-digit", month: "2-digit" })}</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Check-in */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="section-label">Check-in semanal</div>
            {canEdit ? (
              <Link href={`/unidades/${slug}/checkin`} className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">
                {checkinCurrent ? "Editar" : "Fazer check-in"}
              </Link>
            ) : null}
          </div>
          {checkin ? (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-mute">
                  Semana de {fmtDate(checkin.week_start, { day: "2-digit", month: "short" })} · {checkin.author?.short_name ?? checkin.author?.full_name} · {fmtDateTime(checkin.submitted_at)}
                </div>
                {checkin.is_late ? <Badge variant="amber">Fora do prazo</Badge> : null}
              </div>
              <Block label="Como foram as vendas?" text={checkin.sales_summary} />
              {(checkin.problems as { title: string; detail?: string }[])?.length ? (
                <div>
                  <div className="t-label">Principais problemas</div>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                    {(checkin.problems as { title: string; detail?: string }[]).map((p, i) => (
                      <li key={i}>
                        <span className="font-medium">{p.title}</span>
                        {p.detail ? <span className="text-ink-2"> — {p.detail}</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <Block label="Soluções em implementação" text={checkin.solutions} />
              <Block label="O que estamos fazendo para vender mais?" text={checkin.sales_initiatives} />
              <Block label="Iniciativa concreta de receita" text={checkin.growth_initiative} />
              <Block label="O que precisamos do COMEX?" text={checkin.needs_from_comex} />
              <Block label="Compromissos para a próxima semana" text={checkin.commitments} />
            </Card>
          ) : (
            <EmptyState title="Nenhum check-in ainda" icon={<ClipboardCheck />} />
          )}
        </section>

        {/* Tarefas da unidade */}
        {(tasks ?? []).length ? (
          <section>
            <div className="section-label mb-2">Compromissos abertos da unidade</div>
            <div className="divide-y divide-line border border-line bg-surface">
              {(tasks as TaskRow[]).map((t) => (
                <TaskListItem key={t.id} task={t} today={today} showOwner />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}

function Delta({ label, d, good }: { label: string; d: number | null; good: boolean | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-mute">{label}</span>
      <span className={cn("font-semibold tabular", d == null ? "text-mute" : good ? "text-green-dark" : "text-alert")}>{d == null ? "—" : `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`}</span>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <div className="t-label">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}
