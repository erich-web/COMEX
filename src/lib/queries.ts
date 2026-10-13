import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isoWeek, todaySP, weekStart } from "@/lib/dates";
import type { Tables } from "@/lib/types";

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key,value");
  const map: Record<string, unknown> = {};
  (data ?? []).forEach((r) => (map[r.key] = r.value));
  return {
    calendar: (map.calendar ?? { weekday: 2, time: "09:00", duration_minutes: 180 }) as { weekday: number; time: string; duration_minutes: number },
    agendaDeadline: (map.agenda_deadline ?? { weekday: 5, time: "17:00", label: "Sexta-feira até 17h" }) as { weekday: number; time: string; label: string },
    prepDeadline: (map.prep_deadline ?? { weekday: 1, time: "18:00", label: "Segunda-feira até 18h" }) as { weekday: number; time: string; label: string },
    goal2030: (map.goal_2030 ?? { year: 2030, revenue_target: 200000000 }) as { year: number; revenue_target: number; label?: string },
    defaultBlocks: (map.default_blocks ?? []) as { order: number; kind: string; title: string; minutes: number }[],
  };
});

/** Próxima reunião (preparando/publicada/em andamento), garantindo que exista. */
export const getNextMeeting = cache(async () => {
  const supabase = await createClient();
  const today = todaySP();
  let { data } = await supabase
    .from("meetings")
    .select("*, prompt:weekly_prompts(*)")
    .in("status", ["preparing", "published", "in_progress"])
    .gte("series_date", today)
    .order("series_date")
    .limit(1)
    .maybeSingle();
  if (!data) {
    await supabase.rpc("ensure_upcoming_meetings", { p_weeks: 8 });
    ({ data } = await supabase.from("meetings").select("*, prompt:weekly_prompts(*)").in("status", ["preparing", "published", "in_progress"]).gte("series_date", today).order("series_date").limit(1).maybeSingle());
  }
  return data;
});

export const getLastClosedMeeting = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("*, minutes:meeting_minutes(id,status,title)").eq("status", "closed").order("series_date", { ascending: false }).limit(1).maybeSingle();
  return data;
});

/** Provocação da semana: a definida na reunião ou rodízio determinístico pela semana ISO. */
export const getWeeklyPrompt = cache(async (): Promise<Tables<"weekly_prompts"> | null> => {
  const meeting = await getNextMeeting();
  const m = meeting as (typeof meeting & { prompt?: Tables<"weekly_prompts"> | null }) | null;
  if (m?.prompt) return m.prompt;
  const supabase = await createClient();
  const { data } = await supabase.from("weekly_prompts").select("*").eq("is_active", true).order("created_at");
  if (!data?.length) return null;
  return data[isoWeek(todaySP()) % data.length];
});

export const getProfiles = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("is_active", true).order("full_name");
  return data ?? [];
});

export const getUnits = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("business_units").select("*").eq("is_active", true).order("sort_order");
  return data ?? [];
});

export const getGoals = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("strategic_goals").select("*").eq("is_active", true).order("sort_order");
  return data ?? [];
});

/** KPIs aplicáveis a uma unidade (gerais + específicos). */
export async function getUnitKpis(unitId: string) {
  const supabase = await createClient();
  const [{ data: all }, { data: specific }] = await Promise.all([
    supabase.from("kpi_definitions").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("unit_kpis").select("kpi_id,is_active").eq("unit_id", unitId),
  ]);
  const spec = new Map((specific ?? []).map((s) => [s.kpi_id, s.is_active]));
  return (all ?? []).filter((k) => (k.applies_to_all && spec.get(k.id) !== false) || spec.get(k.id) === true);
}

export type TaskRow = Tables<"tasks"> & { owner?: Pick<Tables<"profiles">, "id" | "short_name" | "full_name"> | null; unit?: Pick<Tables<"business_units">, "id" | "name"> | null };

export async function getMyTasks(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*, owner:profiles!tasks_owner_id_fkey(id,short_name,full_name), unit:business_units(id,name)")
    .or(`owner_id.eq.${profileId},created_by.eq.${profileId}`)
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(300);
  return (data ?? []) as TaskRow[];
}

export function taskStats(tasks: TaskRow[], today = todaySP()) {
  const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const late = open.filter((t) => t.due_date && t.due_date < today);
  const eow = weekStart(today);
  const week = open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= addDaysStr(eow, 6));
  const blocked = open.filter((t) => t.status === "blocked");
  const done = tasks.filter((t) => t.status === "done");
  const doneOnTime = done.filter((t) => !t.due_date || !t.completed_at || t.completed_at.slice(0, 10) <= t.due_date);
  return { open, late, week, blocked, done, onTimeRate: done.length ? Math.round((doneOnTime.length / done.length) * 100) : null };
}

function addDaysStr(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Última receita semanal informada por unidade (para dashboard). */
export async function getUnitsRevenueSnapshot(unitIds: string[]) {
  if (!unitIds.length) return [];
  const supabase = await createClient();
  const { data: kpi } = await supabase.from("kpi_definitions").select("id").eq("key", "revenue").maybeSingle();
  if (!kpi) return [];
  const { data } = await supabase
    .from("kpi_entries")
    .select("unit_id, period_start, value, budget_value, prior_year_value, updated_at")
    .eq("kpi_id", kpi.id)
    .eq("period", "week")
    .in("unit_id", unitIds)
    .order("period_start", { ascending: false })
    .limit(unitIds.length * 8);
  const latest = new Map<string, { period_start: string; value: number | null; budget_value: number | null; prior_year_value: number | null; prev: number | null; updated_at: string }>();
  for (const r of data ?? []) {
    const cur = latest.get(r.unit_id);
    if (!cur) latest.set(r.unit_id, { ...r, prev: null });
    else if (cur.prev == null && r.period_start < cur.period_start) cur.prev = r.value;
  }
  return unitIds.map((id) => ({ unit_id: id, ...(latest.get(id) ?? { period_start: null, value: null, budget_value: null, prior_year_value: null, prev: null, updated_at: null }) }));
}
