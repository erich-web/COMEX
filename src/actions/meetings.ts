"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMember } from "@/lib/auth";
import type { ActionResult, MeetingStatus, Updates } from "@/lib/types";
import { fail, fromZod, msg, optionalDate, optionalText, optionalUuid } from "./_helpers";
import type { Database } from "@/lib/supabase/database.types";

function revalidateMeeting(id?: string) {
  revalidatePath("/admin/pautas");
  revalidatePath("/proximo-comex");
  revalidatePath("/atas");
  revalidatePath("/");
  if (id) {
    revalidatePath(`/admin/reunioes/${id}`);
    revalidatePath(`/apresentar/${id}`);
    revalidatePath(`/admin/reunioes/${id}/ata`);
    revalidatePath(`/atas/${id}`);
  }
}

/** Garante as próximas N reuniões (idempotente). */
export async function ensureUpcomingMeetings(weeks = 8): Promise<ActionResult<{ created: number }>> {
  await requireMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_upcoming_meetings", { p_weeks: weeks });
  if (error) return fail(msg(error));
  revalidateMeeting();
  return { ok: true, data: { created: (data as number) ?? 0 } };
}

const blockSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["opening", "accountability", "business_review", "deliberation", "knowledge", "brainstorm", "growth", "closing", "custom"]),
  title: z.string().trim().min(2).max(120),
  duration_minutes: z.coerce.number().int().min(1).max(240),
  sort_order: z.coerce.number().int(),
  notes: optionalText(1000),
});

/** Substitui os blocos da reunião (mantém ids existentes para não perder pautas vinculadas). */
export async function saveMeetingBlocks(meetingId: string, blocks: z.input<typeof blockSchema>[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(blockSchema).min(1).safeParse(blocks);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const keep = parsed.data.filter((b) => b.id).map((b) => b.id!) as string[];
  // desvincula pautas de blocos removidos
  const { data: existing } = await supabase.from("meeting_blocks").select("id").eq("meeting_id", meetingId);
  const toDelete = (existing ?? []).map((b) => b.id).filter((id) => !keep.includes(id));
  if (toDelete.length) {
    await supabase.from("agenda_items").update({ block_id: null, status: "approved" }).in("block_id", toDelete);
    await supabase.from("meeting_blocks").delete().in("id", toDelete);
  }
  for (const b of parsed.data) {
    const row = { meeting_id: meetingId, kind: b.kind, title: b.title, duration_minutes: b.duration_minutes, sort_order: b.sort_order, notes: b.notes };
    const { error } = b.id ? await supabase.from("meeting_blocks").update(row).eq("id", b.id) : await supabase.from("meeting_blocks").insert(row);
    if (error) return fail(msg(error));
  }
  revalidateMeeting(meetingId);
  return { ok: true, message: "Blocos salvos." };
}

const meetingPatch = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  series_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration_minutes: z.coerce.number().int().min(15).max(600).optional(),
  prompt_id: optionalUuid.optional(),
  review_unit_ids: z.array(z.string().uuid()).max(4).optional(),
  notes: optionalText(4000).optional(),
});

export async function updateMeeting(id: string, input: z.input<typeof meetingPatch>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = meetingPatch.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update(parsed.data).eq("id", id);
  if (error) return fail(msg(error));
  revalidateMeeting(id);
  return { ok: true, message: "Reunião atualizada." };
}

/** Reagenda uma ocorrência (ex.: feriado) sem alterar a recorrência. */
export async function rescheduleMeeting(id: string, newDate: string, time = "09:00"): Promise<ActionResult> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return fail("Data inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ series_date: newDate, scheduled_at: `${newDate}T${time}:00-03:00` }).eq("id", id);
  if (error) return fail(/unique|duplicate/i.test(error.message) ? "Já existe uma reunião nessa data." : msg(error));
  revalidateMeeting(id);
  return { ok: true, message: "Reunião reagendada." };
}

export async function setMeetingStatus(id: string, status: MeetingStatus): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const patch: Updates<"meetings"> = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  if (status === "in_progress") patch.started_at = new Date().toISOString();
  if (status === "closed") patch.closed_at = new Date().toISOString();
  const { error } = await supabase.from("meetings").update(patch).eq("id", id);
  if (error) return fail(msg(error));

  if (status === "published") {
    // notifica membros ativos
    const { data: members } = await supabase.from("profiles").select("id").eq("is_active", true).in("role", ["admin", "executive", "unit_lead"]);
    const { data: m } = await supabase.from("meetings").select("series_date").eq("id", id).single();
    if (members?.length) {
      await supabase.from("notifications").insert(members.map((p) => ({ profile_id: p.id, kind: "agenda_published", title: "Agenda do COMEX publicada", body: `Pautas, horários e apresentadores da reunião de ${m?.series_date ?? ""} já estão disponíveis.`, link: "/proximo-comex" })));
    }
  }
  if (status === "closed") {
    await supabase.from("agenda_items").update({ status: "discussed", discussed_at: new Date().toISOString() }).eq("meeting_id", id).eq("status", "scheduled");
  }
  if (status === "cancelled") {
    await supabase.from("agenda_items").update({ status: "approved", meeting_id: null, block_id: null }).eq("meeting_id", id).eq("status", "scheduled");
  }
  revalidateMeeting(id);
  return { ok: true, message: status === "published" ? "Agenda publicada." : "Status atualizado." };
}

const decisionSchema = z.object({
  meeting_id: z.string().uuid(),
  title: z.string().trim().min(3, "Descreva a decisão.").max(300),
  description: optionalText(2000),
  owner_id: optionalUuid,
  unit_id: optionalUuid,
  agenda_item_id: optionalUuid,
  due_date: optionalDate,
  create_task: z.boolean().default(true),
});

/** Registra decisão e (opcionalmente) a tarefa correspondente — modo reunião. */
export async function createDecision(input: z.input<typeof decisionSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_decision_with_task", {
    p_meeting: d.meeting_id,
    p_title: d.title,
    p_description: d.description,
    p_owner: d.owner_id,
    p_due: d.due_date,
    p_unit: d.unit_id,
    p_agenda_item: d.agenda_item_id,
    p_create_task: d.create_task,
  } as unknown as Database["public"]["Functions"]["create_decision_with_task"]["Args"]);
  if (error) return fail(msg(error));
  revalidateMeeting(d.meeting_id);
  revalidatePath("/tarefas");
  return { ok: true, data: { id: data as string }, message: d.create_task ? "Decisão registrada e tarefa criada." : "Decisão registrada." };
}

export async function deleteDecision(id: string, meetingId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_decisions").delete().eq("id", id);
  if (error) return fail(msg(error));
  revalidateMeeting(meetingId);
  return { ok: true };
}

const minutesSchema = z.object({
  meeting_id: z.string().uuid(),
  title: optionalText(200),
  summary: optionalText(4000),
  content: z.string().trim().max(60000).default(""),
  source_notes: optionalText(60000),
  drive_url: optionalText(500),
  approve: z.boolean().default(false),
});

export async function saveMinutes(input: z.input<typeof minutesSchema>): Promise<ActionResult> {
  const s = await requireAdmin();
  const parsed = minutesSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const row = {
    meeting_id: d.meeting_id,
    title: d.title,
    summary: d.summary,
    content: d.content,
    source_notes: d.source_notes,
    drive_url: d.drive_url,
    status: d.approve ? ("approved" as const) : ("draft" as const),
    approved_by: d.approve ? s.profile.id : null,
    approved_at: d.approve ? new Date().toISOString() : null,
    created_by: s.profile.id,
  };
  const { error } = await supabase.from("meeting_minutes").upsert(row, { onConflict: "meeting_id" });
  if (error) return fail(msg(error));
  if (d.approve) {
    const { data: members } = await supabase.from("profiles").select("id").eq("is_active", true).in("role", ["admin", "executive", "unit_lead"]).neq("id", s.profile.id);
    if (members?.length) await supabase.from("notifications").insert(members.map((p) => ({ profile_id: p.id, kind: "minutes_approved", title: "Ata do COMEX disponível", body: d.title ?? "Ata aprovada", link: `/atas/${d.meeting_id}` })));
  }
  revalidateMeeting(d.meeting_id);
  return { ok: true, message: d.approve ? "Ata aprovada e publicada." : "Rascunho salvo." };
}

export async function setParticipants(meetingId: string, profileIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("meeting_participants").delete().eq("meeting_id", meetingId);
  if (profileIds.length) {
    const { error } = await supabase.from("meeting_participants").insert(profileIds.map((p) => ({ meeting_id: meetingId, profile_id: p, attended: true })));
    if (error) return fail(msg(error));
  }
  revalidateMeeting(meetingId);
  return { ok: true };
}
