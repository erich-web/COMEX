import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getSettings, getUnits, getUnitsRevenueSnapshot } from "@/lib/queries";
import { computeSchedule } from "@/lib/agenda";
import { clockMinutesSP, todaySP } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/constants";
import { Presenter } from "./presenter";

export const metadata = { title: "Modo reunião" };

export default async function ApresentarPage({ params }: PageProps<"/apresentar/[id]">) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const { data: m } = await supabase.from("meetings").select("*, prompt:weekly_prompts(text)").eq("id", id).maybeSingle();
  if (!m) notFound();
  const today = todaySP();
  const [{ data: blocks }, { data: items }, { data: decisions }, { data: lastClosed }, settings, profiles, units] = await Promise.all([
    supabase.from("meeting_blocks").select("*").eq("meeting_id", id).order("sort_order"),
    supabase
      .from("agenda_items")
      .select("id,title,description,category,block_id,allotted_minutes,suggested_minutes,sort_order,requires_decision,expected_outcome,proposed_solution,unit_id,unit:business_units(name,slug),presenter:profiles!agenda_items_presenter_id_fkey(id,short_name),author:profiles!agenda_items_submitted_by_fkey(id,short_name),links")
      .eq("meeting_id", id)
      .eq("status", "scheduled")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase.from("meeting_decisions").select("id,title,owner:profiles!meeting_decisions_owner_id_fkey(short_name),due_date").eq("meeting_id", id).order("created_at"),
    supabase.from("meetings").select("id,series_date").eq("status", "closed").lt("series_date", m.series_date).order("series_date", { ascending: false }).limit(1).maybeSingle(),
    getSettings(),
    getProfiles(),
    getUnits(),
  ]);
  // accountability: tarefas abertas/atrasadas por pessoa
  const { data: openTasks } = await supabase.from("tasks").select("id,title,due_date,status,owner_id,meeting_id,owner:profiles!tasks_owner_id_fkey(short_name),unit:business_units(name)").is("deleted_at", null).not("status", "in", '("done","cancelled")').order("due_date", { ascending: true, nullsFirst: false }).limit(400);
  const { data: doneSince } = lastClosed
    ? await supabase.from("tasks").select("id,title,owner:profiles!tasks_owner_id_fkey(short_name)").eq("status", "done").gte("completed_at", lastClosed.series_date).is("deleted_at", null).order("completed_at", { ascending: false }).limit(40)
    : { data: [] };

  const reviewUnits = units.filter((u) => m.review_unit_ids.includes(u.id));
  const snapshot = await getUnitsRevenueSnapshot(reviewUnits.map((u) => u.id));
  const schedule = computeSchedule(clockMinutesSP(m.scheduled_at), m.duration_minutes, blocks ?? [], (items ?? []).map((i) => ({ id: i.id, block_id: i.block_id, allotted_minutes: i.allotted_minutes, suggested_minutes: i.suggested_minutes, sort_order: i.sort_order })));

  const byOwner = new Map<string, { name: string; late: number; open: number; lateItems: string[] }>();
  for (const t of openTasks ?? []) {
    const key = t.owner_id ?? "none";
    const name = t.owner?.short_name ?? "Sem responsável";
    const e = byOwner.get(key) ?? { name, late: 0, open: 0, lateItems: [] };
    e.open++;
    if (t.due_date && t.due_date < today) {
      e.late++;
      if (e.lateItems.length < 4) e.lateItems.push(t.title);
    }
    byOwner.set(key, e);
  }

  return (
    <Presenter
      meeting={{ id: m.id, title: m.title, series_date: m.series_date, status: m.status, startClock: schedule.blocks[0]?.startClock ?? "09:00", endClock: schedule.endClock, prompt: m.prompt?.text ?? null }}
      goal={settings.goal2030.revenue_target}
      schedule={schedule}
      items={(items ?? []).map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        category: CATEGORY_LABELS[i.category],
        block_id: i.block_id,
        minutes: i.allotted_minutes ?? i.suggested_minutes ?? 10,
        presenter: i.presenter?.short_name ?? i.author?.short_name ?? "",
        presenter_id: i.presenter?.id ?? i.author?.id ?? null,
        unit: i.unit?.name ?? null,
        unit_id: i.unit_id,
        requires_decision: i.requires_decision,
        expected_outcome: i.expected_outcome,
        proposed_solution: i.proposed_solution,
        links: (i.links as { label?: string; url: string }[]) ?? [],
      }))}
      decisions={(decisions ?? []).map((d) => ({ id: d.id, title: d.title, owner: d.owner?.short_name ?? null, due_date: d.due_date }))}
      accountability={[...byOwner.values()].sort((a, b) => b.late - a.late || b.open - a.open)}
      recentlyDone={(doneSince ?? []).map((t) => ({ id: t.id, title: t.title, owner: t.owner?.short_name ?? "" }))}
      reviewUnits={reviewUnits.map((u) => {
        const r = snapshot.find((x) => x.unit_id === u.id);
        return { id: u.id, name: u.name, revenue: r?.value ?? null, budget: r?.budget_value ?? null, prev: r?.prev ?? null, prior: r?.prior_year_value ?? null, week: r?.period_start ?? null };
      })}
      profiles={profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))}
      units={units.map((u) => ({ id: u.id, name: u.name }))}
    />
  );
}
