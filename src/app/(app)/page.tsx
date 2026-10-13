import Link from "next/link";
import { ArrowRight, ListPlus, BarChart3, CheckSquare, FileText, CalendarDays, AlertTriangle, ClipboardCheck } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyTasks, getNextMeeting, getSettings, getUnitsRevenueSnapshot, getWeeklyPrompt, getLastClosedMeeting, taskStats } from "@/lib/queries";
import { greeting, todaySP, weekStart, daysBetween } from "@/lib/dates";
import { fmtBRL, fmtDate, fmtTime, plural } from "@/lib/format";
import { GoalBanner } from "@/components/app/goal-banner";
import { Container } from "@/components/app/page-header";
import { Badge, Card, Stat } from "@/components/ui/primitives";
import { TaskListItem } from "@/components/app/task-item";
import { AGENDA_STATUS_LABELS, MEETING_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Início" };

export default async function HomePage() {
  const s = await requireMember();
  const supabase = await createClient();
  const today = todaySP();
  const ws = weekStart(today);
  const unitIds = s.units.map((u) => u.unit_id);

  const [settings, meeting, prompt, tasks, lastMeeting, { data: myItems }, revenue, { data: checkins }, { count: unread }] = await Promise.all([
    getSettings(),
    getNextMeeting(),
    getWeeklyPrompt(),
    getMyTasks(s.profile.id),
    getLastClosedMeeting(),
    supabase.from("agenda_items").select("id,title,status,created_at,meeting_id").eq("submitted_by", s.profile.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    getUnitsRevenueSnapshot(unitIds),
    unitIds.length ? supabase.from("weekly_checkins").select("unit_id").eq("week_start", ws).in("unit_id", unitIds) : Promise.resolve({ data: [] as { unit_id: string }[] }),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", s.profile.id).is("read_at", null),
  ]);

  const mine = tasks.filter((t) => t.owner_id === s.profile.id);
  const st = taskStats(mine, today);
  const lastMeetingTasks = lastMeeting ? mine.filter((t) => t.meeting_id === lastMeeting.id && !["done", "cancelled"].includes(t.status)) : [];
  const items = myItems ?? [];
  const pending = items.filter((i) => ["received", "in_review"].includes(i.status));
  const approved = items.filter((i) => ["approved", "scheduled"].includes(i.status));
  const returned = items.filter((i) => i.status === "returned");
  const discussed = items.filter((i) => i.status === "discussed");
  const checkedIn = new Set((checkins ?? []).map((c) => c.unit_id));
  const daysToMeeting = meeting ? daysBetween(today, meeting.series_date) : null;
  const firstName = (s.profile.short_name || s.profile.full_name || "").split(" ")[0];

  return (
    <div className="fade-in">
      {/* Cabeçalho */}
      <div className="bg-black px-4 pt-5 text-offwhite md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="t-label text-offwhite/50">{fmtDate(today, { weekday: "long", day: "2-digit", month: "long" })}</div>
            <h1 className="t-display mt-1 text-3xl md:text-4xl">
              {greeting()}, <span className="text-green">{firstName}</span>
            </h1>
          </div>
          <Link href="/perfil" className="relative flex size-10 items-center justify-center border border-space text-offwhite/70 hover:border-green" aria-label="Notificações">
            <span className="t-display text-sm">{(s.profile.short_name || s.profile.full_name || "?")[0]}</span>
            {(unread ?? 0) > 0 ? <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center bg-alert text-[10px] font-bold">{unread}</span> : null}
          </Link>
        </div>
        {meeting ? (
          <Link href="/proximo-comex" className="mt-4 flex items-center justify-between gap-3 border border-space bg-dark px-4 py-3 hover:border-green">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 text-green" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-offwhite/50">Próximo COMEX</div>
                <div className="text-sm font-semibold">
                  {fmtDate(meeting.series_date, { weekday: "long", day: "2-digit", month: "short" })} · {fmtTime(meeting.scheduled_at)}
                  <span className="ml-2 text-offwhite/50">{daysToMeeting === 0 ? "é hoje" : daysToMeeting === 1 ? "amanhã" : `em ${daysToMeeting} dias`}</span>
                </div>
              </div>
            </div>
            <Badge variant={meeting.status === "published" ? "green" : "light"}>{MEETING_STATUS_LABELS[meeting.status]}</Badge>
          </Link>
        ) : null}
      </div>
      <GoalBanner goal={settings.goal2030.revenue_target} prompt={prompt?.text} className="border-t border-space" />

      <Container className="space-y-6 pt-5">
        {/* Acesso rápido */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Quick href="/pautas/nova" icon={ListPlus} label="Enviar pautas" primary />
          <Quick href={s.units[0] ? `/unidades/${s.units[0].unit.slug}/indicadores` : "/unidades"} icon={BarChart3} label="Atualizar indicadores" />
          <Quick href="/tarefas" icon={CheckSquare} label="Minhas tarefas" badge={st.late.length ? `${st.late.length}` : undefined} />
          <Quick href={lastMeeting ? `/reunioes/${lastMeeting.id}` : "/reunioes"} icon={FileText} label="Última ata" />
          <Quick href="/proximo-comex" icon={CalendarDays} label="Próxima reunião" />
        </div>

        {/* Alertas acionáveis */}
        {(st.late.length > 0 || returned.length > 0 || s.units.some((u) => !checkedIn.has(u.unit_id))) && (
          <div className="space-y-2">
            {st.late.length > 0 ? (
              <Alert href="/tarefas?f=late" text={`${plural(st.late.length, "tarefa atrasada", "tarefas atrasadas")} — será cobrado no próximo COMEX`} tone="alert" />
            ) : null}
            {returned.length > 0 ? <Alert href="/pautas" text={`${plural(returned.length, "pauta devolvida", "pautas devolvidas")} aguardando complementação`} tone="amber" /> : null}
            {s.units
              .filter((u) => !checkedIn.has(u.unit_id))
              .map((u) => (
                <Alert key={u.unit_id} href={`/unidades/${u.unit.slug}/checkin`} text={`Check-in semanal pendente — ${u.unit.name} (${settings.prepDeadline.label})`} tone="amber" icon={ClipboardCheck} />
              ))}
          </div>
        )}

        {/* Minhas tarefas */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="t-display text-2xl">Minhas tarefas</h2>
            <Link href="/tarefas" className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-2">
              Ver todas <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={st.open.length} label="Pendentes" />
            <Stat value={st.late.length} label="Atrasadas" tone={st.late.length ? "alert" : "default"} />
            <Stat value={st.week.length} label="Vencem na semana" tone={st.week.length ? "amber" : "default"} />
          </div>
          {lastMeetingTasks.length > 0 ? (
            <div className="mt-4">
              <div className="t-label mb-2">Compromissos do último COMEX ({fmtDate(lastMeeting!.series_date)})</div>
              <div className="divide-y divide-line border border-line bg-surface">
                {lastMeetingTasks.slice(0, 5).map((t) => (
                  <TaskListItem key={t.id} task={t} today={today} />
                ))}
              </div>
            </div>
          ) : null}
          {st.open.length > 0 ? (
            <div className="mt-4">
              <div className="t-label mb-2">Próximos vencimentos</div>
              <div className="divide-y divide-line border border-line bg-surface">
                {[...st.late, ...st.open.filter((t) => !st.late.includes(t))].slice(0, 5).map((t) => (
                  <TaskListItem key={t.id} task={t} today={today} />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-mute">Nenhuma tarefa pendente. Bom sinal — ou hora de assumir um compromisso novo.</p>
          )}
        </section>

        {/* Minhas pautas */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="t-display text-2xl">Minhas pautas</h2>
            <Link href="/pautas" className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-2">
              Ver todas <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Stat value={items.length} label="Enviadas" />
            <Stat value={approved.length} label="Aprovadas" tone="green" />
            <Stat value={pending.length} label="Em análise" tone="mute" />
            <Stat value={discussed.length} label="Discutidas" tone="mute" />
          </div>
          {items.slice(0, 3).length ? (
            <div className="mt-3 divide-y divide-line border border-line bg-surface">
              {items.slice(0, 3).map((i) => (
                <Link key={i.id} href={`/pautas/${i.id}`} className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-black/[0.03]">
                  <span className="truncate text-sm font-medium">{i.title}</span>
                  <Badge variant={i.status === "scheduled" || i.status === "approved" ? "green" : i.status === "returned" ? "alertSoft" : "soft"}>{AGENDA_STATUS_LABELS[i.status]}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-mute">Você ainda não enviou pautas para o próximo COMEX.</p>
              <Link href="/pautas/nova" className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-green-dark">
                Enviar agora
              </Link>
            </Card>
          )}
        </section>

        {/* Minhas unidades */}
        {s.units.length > 0 ? (
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="t-display text-2xl">{s.units.length === 1 ? "Minha unidade" : "Minhas unidades"}</h2>
              <Link href="/unidades" className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-2">
                Ver todas <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {s.units.map((u) => {
                const r = revenue.find((x) => x.unit_id === u.unit_id);
                const vsBudget = r?.value != null && r.budget_value ? ((r.value - r.budget_value) / r.budget_value) * 100 : null;
                const vsPrev = r?.value != null && r.prev ? ((r.value - r.prev) / r.prev) * 100 : null;
                const stale = !r?.period_start || r.period_start < ws;
                return (
                  <Link key={u.unit_id} href={`/unidades/${u.unit.slug}`} className="border border-line bg-surface p-4 transition-colors hover:border-black">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="t-label">{u.unit.pillar}</div>
                        <div className="t-display mt-0.5 text-xl">{u.unit.name}</div>
                      </div>
                      {stale ? <Badge variant="amber">Atualizar</Badge> : <Badge variant="greenSoft">Semana ok</Badge>}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="t-label">Receita sem.</div>
                        <div className="t-display mt-0.5 text-lg tabular">{r?.value != null ? fmtBRL(r.value) : "—"}</div>
                      </div>
                      <div>
                        <div className="t-label">vs orçado</div>
                        <div className={cn("mt-0.5 font-semibold tabular", vsBudget == null ? "text-mute" : vsBudget >= 0 ? "text-green-dark" : "text-alert")}>{vsBudget == null ? "Não inf." : `${vsBudget >= 0 ? "+" : ""}${vsBudget.toFixed(1)}%`}</div>
                      </div>
                      <div>
                        <div className="t-label">vs sem. ant.</div>
                        <div className={cn("mt-0.5 font-semibold tabular", vsPrev == null ? "text-mute" : vsPrev >= 0 ? "text-green-dark" : "text-alert")}>{vsPrev == null ? "Não inf." : `${vsPrev >= 0 ? "+" : ""}${vsPrev.toFixed(1)}%`}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}

function Quick({ href, icon: Icon, label, primary, badge }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; primary?: boolean; badge?: string }) {
  return (
    <Link href={href} className={cn("relative flex min-h-[72px] flex-col justify-between border p-3 transition-colors", primary ? "border-green bg-green text-black hover:bg-green-dark" : "border-line bg-surface hover:border-black")}>
      <Icon className="size-5" />
      <span className="text-[11px] font-bold uppercase leading-tight tracking-[0.1em]">{label}</span>
      {badge ? <span className="absolute right-2 top-2 flex size-5 items-center justify-center bg-alert text-[10px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
}

function Alert({ href, text, tone, icon: Icon = AlertTriangle }: { href: string; text: string; tone: "alert" | "amber"; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 border px-3 py-2.5 text-sm font-medium", tone === "alert" ? "border-alert/40 bg-alert/10 text-alert" : "border-amber/40 bg-amber/10 text-amber")}>
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  );
}
