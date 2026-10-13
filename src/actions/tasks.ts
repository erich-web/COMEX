"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember, requireAdmin } from "@/lib/auth";
import type { ActionResult, TaskStatus } from "@/lib/types";
import { fail, fromZod, msg, optionalDate, optionalText, optionalUuid } from "./_helpers";

const statusEnum = z.enum(["not_started", "in_progress", "waiting", "blocked", "done", "cancelled"]);

const taskSchema = z.object({
  title: z.string().trim().min(3, "Título muito curto.").max(300),
  description: optionalText(4000),
  owner_id: optionalUuid,
  unit_id: optionalUuid,
  due_date: optionalDate,
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  meeting_id: optionalUuid,
  agenda_item_id: optionalUuid,
  decision_id: optionalUuid,
  checkin_id: optionalUuid,
  assignees: z.array(z.string().uuid()).optional().default([]),
});

function revalidateTasks(id?: string) {
  revalidatePath("/tarefas");
  revalidatePath("/");
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin");
  if (id) revalidatePath(`/tarefas/${id}`);
}

export async function createTask(input: z.input<typeof taskSchema>): Promise<ActionResult<{ id: string }>> {
  const s = await requireMember();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { assignees, ...rest } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...rest, owner_id: rest.owner_id ?? s.profile.id, created_by: s.profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(msg(error));
  if (assignees.length) await supabase.from("task_assignees").insert(assignees.map((p) => ({ task_id: data.id, profile_id: p })));
  if (rest.owner_id && rest.owner_id !== s.profile.id) {
    await supabase.from("notifications").insert({ profile_id: rest.owner_id, kind: "task_assigned", title: "Nova tarefa atribuída a você", body: rest.title, link: `/tarefas/${data.id}` });
  }
  revalidateTasks(data.id);
  return { ok: true, data: { id: data.id } };
}

export async function updateTask(id: string, input: Partial<z.input<typeof taskSchema>>): Promise<ActionResult> {
  await requireMember();
  const parsed = taskSchema.partial().safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { assignees, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(rest).eq("id", id);
  if (error) return fail(msg(error));
  if (assignees) {
    await supabase.from("task_assignees").delete().eq("task_id", id);
    if (assignees.length) await supabase.from("task_assignees").insert(assignees.map((p) => ({ task_id: id, profile_id: p })));
  }
  revalidateTasks(id);
  return { ok: true, message: "Tarefa atualizada." };
}

/** Atualização rápida de status (1 toque no celular). */
export async function setTaskStatus(id: string, status: TaskStatus, note?: string): Promise<ActionResult> {
  const s = await requireMember();
  const st = statusEnum.safeParse(status);
  if (!st.success) return fail("Status inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status: st.data }).eq("id", id);
  if (error) return fail(msg(error));
  if (note?.trim()) await supabase.from("task_comments").insert({ task_id: id, author_id: s.profile.id, body: note.trim() });
  revalidateTasks(id);
  return { ok: true, message: st.data === "done" ? "Tarefa concluída." : "Status atualizado." };
}

export async function completeTaskWithEvidence(id: string, input: { note?: string; evidence_url?: string; evidence_path?: string }): Promise<ActionResult> {
  const s = await requireMember();
  const supabase = await createClient();
  const url = input.evidence_url?.trim() || null;
  if (url && !/^https?:\/\//i.test(url)) return fail("Informe um link válido (http/https).", { evidence_url: ["Link inválido"] });
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", evidence_url: input.evidence_path ? `storage:${input.evidence_path}` : url, evidence_note: input.note?.trim() || null })
    .eq("id", id);
  if (error) return fail(msg(error));
  if (input.note?.trim()) await supabase.from("task_comments").insert({ task_id: id, author_id: s.profile.id, body: `Concluída: ${input.note.trim()}` });
  revalidateTasks(id);
  return { ok: true, message: "Tarefa concluída com evidência." };
}

export async function addTaskComment(id: string, body: string): Promise<ActionResult> {
  const s = await requireMember();
  const text = body.trim();
  if (text.length < 2) return fail("Escreva um comentário.");
  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({ task_id: id, author_id: s.profile.id, body: text });
  if (error) return fail(msg(error));
  revalidateTasks(id);
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(msg(error));
  revalidateTasks();
  return { ok: true, message: "Tarefa removida." };
}

/** Vincula responsáveis de tarefas importadas aos perfis pelo nome. */
export async function linkLegacyOwners(): Promise<ActionResult<{ linked: number }>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("link_legacy_task_owners");
  if (error) return fail(msg(error));
  revalidateTasks();
  return { ok: true, data: { linked: (data as number) ?? 0 } };
}
