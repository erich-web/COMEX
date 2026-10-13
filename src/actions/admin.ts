"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMember } from "@/lib/auth";
import type { ActionResult, Updates } from "@/lib/types";
import { fail, fromZod, msg, optionalNumber, optionalText } from "./_helpers";

/* ---------------- Usuários / convites ---------------- */
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  full_name: z.string().trim().min(2, "Informe o nome."),
  short_name: optionalText(40),
  role: z.enum(["admin", "executive", "unit_lead", "guest"]).default("executive"),
  unit_slugs: z.array(z.string()).default([]),
});

export async function upsertInvite(input: z.input<typeof inviteSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("invited_users").upsert({ email: d.email, full_name: d.full_name, short_name: d.short_name ?? d.full_name.split(" ")[0], role: d.role }, { onConflict: "email" });
  if (error) return fail(msg(error));
  await supabase.from("invited_user_units").delete().eq("email", d.email);
  if (d.unit_slugs.length) await supabase.from("invited_user_units").insert(d.unit_slugs.map((slug) => ({ email: d.email, unit_slug: slug, is_lead: true })));
  // se já existe perfil, aplica imediatamente
  await supabase.rpc("apply_invite", { p_email: d.email });
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Convite salvo. A pessoa entra com o link mágico enviado para este e-mail." };
}

export async function deleteInvite(email: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("invited_users").delete().eq("email", email);
  if (error) return fail(msg(error));
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

const profilePatch = z.object({
  role: z.enum(["admin", "executive", "unit_lead", "guest"]).optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().trim().min(2).optional(),
  short_name: optionalText(40).optional(),
});

export async function updateProfileAdmin(id: string, input: z.input<typeof profilePatch>): Promise<ActionResult> {
  const s = await requireAdmin();
  const parsed = profilePatch.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  if (id === s.profile.id && (parsed.data.role && parsed.data.role !== "admin" || parsed.data.is_active === false)) return fail("Você não pode remover seu próprio acesso de administrador.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", id);
  if (error) return fail(msg(error));
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Perfil atualizado." };
}

export async function setUnitMembers(unitId: string, members: { profile_id: string; is_lead: boolean; can_edit: boolean }[]): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("business_unit_members").delete().eq("unit_id", unitId);
  if (members.length) {
    const { error } = await supabase.from("business_unit_members").insert(members.map((m) => ({ unit_id: unitId, ...m })));
    if (error) return fail(msg(error));
  }
  revalidatePath("/admin/unidades");
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Responsáveis atualizados." };
}

/* ---------------- Unidades ---------------- */
const unitSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
  pillar: z.string().trim().min(2).max(60).default("RPE Restaurantes"),
  city: optionalText(80),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(100),
  kpi_ids: z.array(z.string().uuid()).default([]),
});

export async function upsertUnit(id: string | null, input: z.input<typeof unitSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { kpi_ids, ...row } = parsed.data;
  const supabase = await createClient();
  const q = id ? supabase.from("business_units").update(row).eq("id", id).select("id").single() : supabase.from("business_units").insert(row).select("id").single();
  const { data, error } = await q;
  if (error || !data) return fail(/unique|duplicate/i.test(error?.message ?? "") ? "Já existe uma unidade com esse nome ou slug." : msg(error));
  await supabase.from("unit_kpis").delete().eq("unit_id", data.id);
  if (kpi_ids.length) await supabase.from("unit_kpis").insert(kpi_ids.map((k) => ({ unit_id: data.id, kpi_id: k })));
  revalidatePath("/admin/unidades");
  return { ok: true, data: { id: data.id }, message: "Unidade salva." };
}

const kpiSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  category: z.enum(["commercial", "operational", "experience", "events"]).default("commercial"),
  unit_type: z.enum(["currency", "percent", "number", "score"]).default("number"),
  higher_is_better: z.boolean().default(true),
  has_budget: z.boolean().default(true),
  has_prior_year: z.boolean().default(true),
  applies_to_all: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(100),
  is_active: z.boolean().default(true),
});

export async function upsertKpiDefinition(id: string | null, input: z.input<typeof kpiSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = kpiSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = id ? await supabase.from("kpi_definitions").update(parsed.data).eq("id", id) : await supabase.from("kpi_definitions").insert(parsed.data);
  if (error) return fail(msg(error));
  revalidatePath("/admin/unidades");
  return { ok: true, message: "Indicador salvo." };
}

/* ---------------- Configurações / calendário ---------------- */
export async function saveSetting(key: string, value: unknown): Promise<ActionResult> {
  const s = await requireAdmin();
  if (!/^[a-z_]+$/.test(key)) return fail("Chave inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key, value: value as never, updated_by: s.profile.id }, { onConflict: "key" });
  if (error) return fail(msg(error));
  revalidatePath("/admin/calendario");
  revalidatePath("/");
  return { ok: true, message: "Configuração salva." };
}

/* ---------------- Provocações ---------------- */
export async function upsertPrompt(id: string | null, text: string, author?: string | null, is_active = true): Promise<ActionResult> {
  await requireAdmin();
  const t = text.trim();
  if (t.length < 8) return fail("Escreva a provocação.");
  const supabase = await createClient();
  const row = { text: t, author: author?.trim() || null, is_active };
  const { error } = id ? await supabase.from("weekly_prompts").update(row).eq("id", id) : await supabase.from("weekly_prompts").insert(row);
  if (error) return fail(msg(error));
  revalidatePath("/admin/provocacoes");
  revalidatePath("/");
  return { ok: true, message: "Provocação salva." };
}

export async function deletePrompt(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_prompts").delete().eq("id", id);
  if (error) return fail(msg(error));
  revalidatePath("/admin/provocacoes");
  return { ok: true };
}

/* ---------------- Metas ---------------- */
const targetSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2040),
  revenue_target: optionalNumber,
  revenue_budget: optionalNumber,
  revenue_actual: optionalNumber,
  scenario_conservative: optionalNumber,
  scenario_base: optionalNumber,
  scenario_optimistic: optionalNumber,
  expansion_contribution: optionalNumber,
  note: optionalText(500),
});

export async function upsertAnnualTarget(input: z.input<typeof targetSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("annual_targets").upsert({ ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "year" });
  if (error) return fail(msg(error));
  if (parsed.data.year === 2030 && parsed.data.revenue_target) {
    await supabase.from("app_settings").upsert({ key: "goal_2030", value: { year: 2030, revenue_target: parsed.data.revenue_target, label: "RPE 2030" } }, { onConflict: "key" });
  }
  revalidatePath("/");
  return { ok: true, message: "Meta salva." };
}

export async function upsertStrategicGoal(id: string | null, name: string, description?: string | null): Promise<ActionResult> {
  await requireAdmin();
  if (name.trim().length < 3) return fail("Nome muito curto.");
  const supabase = await createClient();
  const row = { name: name.trim(), description: description?.trim() || null };
  const { error } = id ? await supabase.from("strategic_goals").update(row).eq("id", id) : await supabase.from("strategic_goals").insert(row);
  if (error) return fail(msg(error));
  return { ok: true };
}

/* ---------------- Perfil próprio / notificações ---------------- */
export async function updateMyProfile(input: { full_name?: string; short_name?: string | null; phone?: string | null }): Promise<ActionResult> {
  const s = await requireMember();
  const supabase = await createClient();
  const patch: Updates<"profiles"> = {};
  if (input.full_name && input.full_name.trim().length >= 2) patch.full_name = input.full_name.trim();
  if ("short_name" in input) patch.short_name = input.short_name?.trim() || null;
  if ("phone" in input) patch.phone = input.phone?.trim() || null;
  const { error } = await supabase.from("profiles").update(patch).eq("id", s.profile.id);
  if (error) return fail(msg(error));
  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true, message: "Perfil salvo." };
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const s = await requireMember();
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("profile_id", s.profile.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return fail(msg(error));
  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true };
}

export async function convertReflection(id: string, to: "growth_idea"): Promise<ActionResult> {
  const s = await requireAdmin();
  const supabase = await createClient();
  const { data: r } = await supabase.from("weekly_reflections").select("*").eq("id", id).single();
  if (!r) return fail("Reflexão não encontrada.");
  if (to === "growth_idea") {
    const { error } = await supabase.from("growth_ideas").insert({ title: r.text.slice(0, 120), description: r.text, author_id: r.profile_id, kind: "Reflexão semanal" });
    if (error) return fail(msg(error));
  }
  await supabase.from("weekly_reflections").update({ converted_to: to }).eq("id", id);
  void s;
  revalidatePath("/admin");
  return { ok: true, message: "Reflexão convertida em ideia." };
}
