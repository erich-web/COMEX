"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember, requireAdmin } from "@/lib/auth";
import type { ActionResult, AgendaStatus, Updates } from "@/lib/types";
import { fail, fromZod, msg, optionalText, optionalUuid } from "./_helpers";
import { agendaItemSchema } from "@/lib/schemas";
import { suggestMinutes } from "@/lib/agenda";

const batchSchema = z.object({
  batchId: z.string().uuid(),
  items: z.array(agendaItemSchema).min(1, "Adicione pelo menos uma pauta.").max(30),
  reflection: optionalText(2000),
});

export type BatchResult = { submission_id: string; count: number; duplicate: boolean; is_late?: boolean };

/** Envia várias pautas de uma vez (transacional e idempotente por batchId). */
export async function submitAgendaBatch(input: unknown): Promise<ActionResult<BatchResult> & { itemErrors?: Record<number, Record<string, string[]>> }> {
  await requireMember();
  const raw = input as { items?: unknown[] };
  // valida item a item para apontar exatamente qual pauta precisa de correção
  const itemErrors: Record<number, Record<string, string[]>> = {};
  (raw?.items ?? []).forEach((it, i) => {
    const r = agendaItemSchema.safeParse(it);
    if (!r.success) {
      const flat = z.flattenError(r.error);
      itemErrors[i] = Object.fromEntries(Object.entries(flat.fieldErrors).map(([k, v]) => [k, (v ?? []) as string[]]));
    }
  });
  if (Object.keys(itemErrors).length) return { ok: false, error: "Algumas pautas precisam de correção.", itemErrors };

  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_agenda_batch", {
    p_batch_id: parsed.data.batchId,
    p_items: parsed.data.items.map((i) => ({ ...i, suggested_minutes: i.suggested_minutes ?? null })),
    p_reflection: parsed.data.reflection ?? undefined,
  });
  if (error) return fail(msg(error));
  revalidatePath("/pautas");
  revalidatePath("/");
  revalidatePath("/admin/pautas");
  return { ok: true, data: data as unknown as BatchResult };
}

/** Executivo edita a própria pauta enquanto ainda não foi agendada. */
export async function updateMyAgendaItem(id: string, input: unknown): Promise<ActionResult> {
  const s = await requireMember();
  const parsed = agendaItemSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_items")
    .update({ ...parsed.data, suggested_minutes: parsed.data.suggested_minutes ?? null, status: "received" })
    .eq("id", id)
    .eq("submitted_by", s.profile.id);
  if (error) return fail(msg(error));
  revalidatePath(`/pautas/${id}`);
  revalidatePath("/pautas");
  return { ok: true, message: "Pauta atualizada." };
}

export async function withdrawMyAgendaItem(id: string): Promise<ActionResult> {
  const s = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_items").update({ status: "archived", deleted_at: new Date().toISOString() }).eq("id", id).eq("submitted_by", s.profile.id).in("status", ["received", "returned", "in_review"]);
  if (error) return fail(msg(error));
  revalidatePath("/pautas");
  return { ok: true, message: "Pauta retirada." };
}

export async function addAgendaComment(itemId: string, body: string): Promise<ActionResult> {
  const s = await requireMember();
  const text = body.trim();
  if (text.length < 2) return fail("Escreva um comentário.");
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_comments").insert({ item_id: itemId, author_id: s.profile.id, body: text });
  if (error) return fail(msg(error));
  revalidatePath(`/pautas/${itemId}`);
  revalidatePath(`/admin/pautas`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* ADMIN                                                              */
/* ------------------------------------------------------------------ */

const organizeSchema = z.object({
  status: z.enum(["received", "in_review", "returned", "approved", "scheduled", "discussed", "postponed", "archived"]).optional(),
  meeting_id: optionalUuid.optional(),
  block_id: optionalUuid.optional(),
  allotted_minutes: z.coerce.number().int().min(1).max(180).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
  presenter_id: optionalUuid.optional(),
  priority: z.coerce.number().int().min(0).max(3).optional(),
  admin_notes: optionalText(2000).optional(),
  return_reason: optionalText(1000).optional(),
  category: agendaItemSchema.shape.category.optional(),
  requires_decision: z.boolean().optional(),
});

/** Organização de pauta pelo administrador (status, bloco, tempo, apresentador…). */
export async function organizeAgendaItem(id: string, input: z.input<typeof organizeSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = organizeSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const patch: Updates<"agenda_items"> = { ...parsed.data };
  // coerência: ao agendar em um bloco, status vira 'scheduled'; ao remover do bloco, volta a 'approved'
  if ("block_id" in parsed.data) {
    if (parsed.data.block_id) patch.status = patch.status ?? "scheduled";
    else if (!patch.status) patch.status = "approved";
  }
  if (parsed.data.status === "returned") {
    patch.meeting_id = null;
    patch.block_id = null;
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("agenda_items").select("submitted_by,title,status").eq("id", id).single();
  const { error } = await supabase.from("agenda_items").update(patch).eq("id", id);
  if (error) return fail(msg(error));

  // notifica autor em mudanças relevantes
  if (before && parsed.data.status && parsed.data.status !== before.status && ["returned", "approved", "scheduled", "postponed", "archived"].includes(parsed.data.status)) {
    const titles: Record<string, string> = {
      returned: "Pauta devolvida para complementação",
      approved: "Pauta aprovada",
      scheduled: "Pauta agendada para o COMEX",
      postponed: "Pauta adiada",
      archived: "Pauta arquivada",
    };
    await supabase.from("notifications").insert({
      profile_id: before.submitted_by,
      kind: `agenda_${parsed.data.status}`,
      title: titles[parsed.data.status],
      body: parsed.data.return_reason ? `${before.title} — ${parsed.data.return_reason}` : before.title,
      link: `/pautas/${id}`,
    });
  }
  revalidatePath("/admin/pautas");
  revalidatePath("/pautas");
  revalidatePath("/proximo-comex");
  return { ok: true };
}

/** Auto-organização: sugere bloco/tempo para pautas aprovadas sem bloco na reunião alvo. */
export async function autoAssignApproved(meetingId: string): Promise<ActionResult<{ assigned: number }>> {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: blocks }, { data: items }] = await Promise.all([
    supabase.from("meeting_blocks").select("id,kind,sort_order").eq("meeting_id", meetingId).order("sort_order"),
    supabase.from("agenda_items").select("id,category,urgency,requires_decision,suggested_minutes,status,block_id").in("status", ["approved", "received", "in_review"]).is("block_id", null).is("deleted_at", null),
  ]);
  if (!blocks?.length || !items?.length) return { ok: true, data: { assigned: 0 } };
  const { CATEGORY_BLOCK } = await import("@/lib/constants");
  let assigned = 0;
  let order = 100;
  for (const it of items) {
    if (it.status !== "approved") continue;
    const kind = CATEGORY_BLOCK[it.category];
    const block = blocks.find((b) => b.kind === kind) ?? blocks.find((b) => b.kind === "deliberation");
    if (!block) continue;
    const { error } = await supabase
      .from("agenda_items")
      .update({ meeting_id: meetingId, block_id: block.id, status: "scheduled", allotted_minutes: suggestMinutes(it), sort_order: order++ })
      .eq("id", it.id);
    if (!error) assigned++;
  }
  revalidatePath("/admin/pautas");
  return { ok: true, data: { assigned } };
}

export async function bulkSetStatus(ids: string[], status: AgendaStatus): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_items").update({ status }).in("id", ids);
  if (error) return fail(msg(error));
  revalidatePath("/admin/pautas");
  return { ok: true };
}
