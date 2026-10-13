"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { fail, fromZod, msg, optionalNumber, optionalText } from "./_helpers";
import { weekStart, todaySP } from "@/lib/dates";

const entriesSchema = z.object({
  unit_id: z.string().uuid(),
  period: z.enum(["week", "month"]).default("week"),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z
    .array(
      z.object({
        kpi_id: z.string().uuid(),
        value: optionalNumber,
        budget_value: optionalNumber,
        prior_year_value: optionalNumber,
        note: optionalText(500),
      }),
    )
    .min(1),
});

/** Grava/atualiza indicadores de uma unidade para um período (upsert por kpi). */
export async function saveKpiEntries(input: z.input<typeof entriesSchema>): Promise<ActionResult<{ saved: number }>> {
  const s = await requireMember();
  const parsed = entriesSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { unit_id, period, period_start, entries } = parsed.data;
  const ps = period === "week" ? weekStart(period_start) : period_start.slice(0, 8) + "01";
  const supabase = await createClient();
  const rows = entries
    .filter((e) => e.value != null || e.budget_value != null || e.prior_year_value != null || e.note)
    .map((e) => ({ unit_id, kpi_id: e.kpi_id, period, period_start: ps, value: e.value, budget_value: e.budget_value, prior_year_value: e.prior_year_value, note: e.note, updated_by: s.profile.id }));
  if (!rows.length) return fail("Informe pelo menos um valor.");
  const { error } = await supabase.from("kpi_entries").upsert(rows, { onConflict: "unit_id,kpi_id,period,period_start" });
  if (error) return fail(msg(error));
  revalidatePath("/unidades");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, data: { saved: rows.length }, message: `${rows.length} indicador(es) salvos.` };
}

const checkinSchema = z.object({
  unit_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sales_summary: z.string().trim().min(5, "Conte como foram as vendas."),
  problems: z.array(z.object({ title: z.string().trim().min(2).max(200), detail: optionalText(1000) })).max(3, "Até três problemas prioritários."),
  solutions: optionalText(3000),
  sales_initiatives: optionalText(3000),
  growth_initiative: optionalText(1000),
  needs_from_comex: optionalText(2000),
  commitments: z.array(z.object({ title: z.string().trim().min(3).max(300), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable() })).max(10).default([]),
});

export type CheckinInput = z.input<typeof checkinSchema>;

/** Check-in semanal da unidade + cria tarefas a partir dos compromissos. */
export async function saveCheckin(input: CheckinInput): Promise<ActionResult<{ id: string; tasks: number }>> {
  const s = await requireMember();
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;
  const ws = weekStart(d.week_start);
  const supabase = await createClient();

  // prazo de preparação: segunda 18h (editável em app_settings.prep_deadline)
  const { data: prep } = await supabase.from("app_settings").select("value").eq("key", "prep_deadline").maybeSingle();
  const pv = (prep?.value ?? {}) as { weekday?: number; time?: string };
  const deadlineDay = new Date(ws + "T12:00:00Z");
  deadlineDay.setUTCDate(deadlineDay.getUTCDate() + (((pv.weekday ?? 1) + 6) % 7));
  const deadline = new Date(`${deadlineDay.toISOString().slice(0, 10)}T${pv.time ?? "18:00"}:00-03:00`);
  const isLate = new Date() > deadline;

  const { data: row, error } = await supabase
    .from("weekly_checkins")
    .upsert(
      {
        unit_id: d.unit_id,
        week_start: ws,
        author_id: s.profile.id,
        sales_summary: d.sales_summary,
        problems: d.problems,
        solutions: d.solutions,
        sales_initiatives: d.sales_initiatives,
        growth_initiative: d.growth_initiative,
        needs_from_comex: d.needs_from_comex,
        commitments: d.commitments.map((c) => `• ${c.title}${c.due_date ? ` (até ${c.due_date})` : ""}`).join("\n") || null,
        is_late: isLate,
      },
      { onConflict: "unit_id,week_start" },
    )
    .select("id")
    .single();
  if (error || !row) return fail(msg(error));

  // compromissos → tarefas (sem duplicar: mesmo título + checkin)
  let created = 0;
  if (d.commitments.length) {
    const { data: existing } = await supabase.from("tasks").select("title").eq("checkin_id", row.id);
    const have = new Set((existing ?? []).map((t) => t.title.toLowerCase()));
    const rows = d.commitments
      .filter((c) => !have.has(c.title.toLowerCase()))
      .map((c) => ({ title: c.title, owner_id: s.profile.id, unit_id: d.unit_id, checkin_id: row.id, due_date: c.due_date ?? null, created_by: s.profile.id, description: `Compromisso assumido no check-in da semana de ${ws}.` }));
    if (rows.length) {
      const { error: te } = await supabase.from("tasks").insert(rows);
      if (!te) created = rows.length;
    }
  }
  revalidatePath("/unidades");
  revalidatePath("/tarefas");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, data: { id: row.id, tasks: created }, message: isLate ? "Check-in registrado (fora do prazo recomendado)." : "Check-in registrado." };
}

export async function saveUnitAnnualRevenue(unitId: string, year: number, actual: number | null, budget: number | null): Promise<ActionResult> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("unit_annual_revenue").upsert({ unit_id: unitId, year, revenue_actual: actual, revenue_budget: budget }, { onConflict: "unit_id,year" });
  if (error) return fail(msg(error));
  revalidatePath("/rpe-2030");
  revalidatePath("/admin/metas");
  return { ok: true };
}

export async function currentWeekStart() {
  return weekStart(todaySP());
}
