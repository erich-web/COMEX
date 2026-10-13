"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import type { ActionResult, GrowthStatus } from "@/lib/types";
import { fail, fromZod, msg, optionalDate, optionalNumber, optionalText, optionalUuid } from "./_helpers";

const ideaSchema = z.object({
  title: z.string().trim().min(3, "Dê um título.").max(200),
  description: optionalText(4000),
  kind: optionalText(60),
  unit_id: optionalUuid,
  strategic_goal_id: optionalUuid,
});

export async function createGrowthIdea(input: z.input<typeof ideaSchema>): Promise<ActionResult<{ id: string }>> {
  const s = await requireMember();
  const parsed = ideaSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("growth_ideas").insert({ ...parsed.data, author_id: s.profile.id }).select("id").single();
  if (error || !data) return fail(msg(error));
  revalidatePath("/growth");
  return { ok: true, data: { id: data.id }, message: "Ideia registrada no banco de ideias." };
}

export async function setIdeaStatus(id: string, status: GrowthStatus): Promise<ActionResult> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("growth_ideas").update({ status }).eq("id", id);
  if (error) return fail(msg(error));
  revalidatePath("/growth");
  return { ok: true };
}

const expSchema = z.object({
  idea_id: optionalUuid,
  title: z.string().trim().min(3).max(200),
  hypothesis: optionalText(2000),
  objective: optionalText(2000),
  unit_id: optionalUuid,
  owner_id: optionalUuid,
  investment: optionalNumber,
  deadline: optionalDate,
  expected_revenue: optionalNumber,
  success_metrics: optionalText(2000),
  actual_result: optionalText(4000),
  actual_revenue: optionalNumber,
  next_decision: optionalText(2000),
  status: z.enum(["idea", "evaluating", "approved", "executing", "done", "scaled", "discontinued"]).default("approved"),
});

export async function upsertExperiment(id: string | null, input: z.input<typeof expSchema>): Promise<ActionResult<{ id: string }>> {
  const s = await requireMember();
  const parsed = expSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const row = { ...parsed.data, owner_id: parsed.data.owner_id ?? s.profile.id };
  const q = id ? supabase.from("growth_experiments").update(row).eq("id", id).select("id").single() : supabase.from("growth_experiments").insert({ ...row, created_by: s.profile.id }).select("id").single();
  const { data, error } = await q;
  if (error || !data) return fail(msg(error));
  if (parsed.data.idea_id) await supabase.from("growth_ideas").update({ status: parsed.data.status === "idea" ? "evaluating" : parsed.data.status }).eq("id", parsed.data.idea_id);
  revalidatePath("/growth");
  return { ok: true, data: { id: data.id }, message: "Experimento salvo." };
}
