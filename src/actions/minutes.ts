"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";
import { fail, msg } from "./_helpers";
import { extractTextFromFile, fetchFromLink, normalizeMinutesText } from "@/lib/minutes-import";
import { aiJSON } from "@/lib/ai-call";
import { hasLLM } from "@/lib/llm";
import { SYSTEM_BASE } from "@/lib/agent-core";
import { fmtDate } from "@/lib/format";

/**
 * Atas: importação do arquivo (PDF/Word) enviado pelo Wesley, extração do texto,
 * estruturação por IA (resumo, decisões e compromissos) e registro das decisões/tarefas.
 */

function revalidateMinutes(meetingId: string) {
  revalidatePath(`/admin/reunioes/${meetingId}/ata`);
  revalidatePath(`/atas/${meetingId}`);
  revalidatePath("/atas");
  revalidatePath("/admin/ia");
  revalidatePath(`/apresentar/${meetingId}`);
}

async function saveText(meetingId: string, actorId: string, text: string, extra: { file_path?: string; file_name?: string; drive_url?: string }) {
  const supabase = await createClient();
  const { data: m } = await supabase.from("meetings").select("series_date,title,minutes:meeting_minutes(id,title,drive_url)").eq("id", meetingId).maybeSingle();
  if (!m) throw new Error("Reunião não encontrada.");
  const row: Database["public"]["Tables"]["meeting_minutes"]["Insert"] = {
    meeting_id: meetingId,
    title: m.minutes?.title || `COMEX — ${fmtDate(m.series_date, { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    content: text,
    source_notes: `Importado do arquivo${extra.file_name ? ` ${extra.file_name}` : ""} em ${new Date().toISOString().slice(0, 10)}`,
    created_by: actorId,
    ...(extra.file_path ? { file_path: extra.file_path, file_name: extra.file_name ?? null } : {}),
    ...(extra.drive_url ? { drive_url: extra.drive_url } : {}),
  };
  const { error } = await supabase.from("meeting_minutes").upsert(row, { onConflict: "meeting_id" });
  if (error) throw new Error(msg(error));
}

/** O arquivo já foi enviado ao Storage pelo navegador (pasta do próprio usuário); aqui extraímos o texto e gravamos a ata. */
export async function importMinutesFile(meetingId: string, file: { path: string; name: string }): Promise<ActionResult<{ chars: number; text: string; kind: string }>> {
  const s = await requireAdmin();
  if (!file.path.startsWith(`${s.profile.id}/`)) return fail("Arquivo inválido.");
  const supabase = await createClient();
  const { data: blob, error } = await supabase.storage.from("comex").download(file.path);
  if (error || !blob) return fail(`Não foi possível ler o arquivo enviado: ${error?.message ?? ""}`);
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ex = await extractTextFromFile(bytes, file.name, blob.type);
    const text = normalizeMinutesText(ex.text);
    if (text.length < 80) return fail("O arquivo não tem texto legível (PDF escaneado?). Cole o texto manualmente ou envie um PDF com texto.");
    await saveText(meetingId, s.profile.id, text, { file_path: file.path, file_name: file.name });
    revalidateMinutes(meetingId);
    return { ok: true, data: { chars: text.length, text, kind: ex.kind }, message: `Ata importada (${ex.pages ? `${ex.pages} páginas, ` : ""}${text.length} caracteres). Revise e aprove.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha ao importar.");
  }
}

/** Baixa o arquivo por um link compartilhado (OneDrive "qualquer pessoa com o link" ou Google Drive público). */
export async function importMinutesFromUrl(meetingId: string, url: string): Promise<ActionResult<{ chars: number; text: string }>> {
  const s = await requireAdmin();
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return fail("Informe um link válido.");
  try {
    const f = await fetchFromLink(u);
    const ex = await extractTextFromFile(f.bytes, f.name, f.mime);
    const text = normalizeMinutesText(ex.text);
    if (text.length < 80) return fail("O arquivo baixado não tem texto legível.");
    await saveText(meetingId, s.profile.id, text, { drive_url: u });
    revalidateMinutes(meetingId);
    return { ok: true, data: { chars: text.length, text }, message: `Texto importado do link (${text.length} caracteres).` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha ao importar pelo link.");
  }
}

/* ------------------------------------------------------------------ */
/* Estruturação por IA                                                 */
/* ------------------------------------------------------------------ */

const proposalSchema = z.object({
  summary: z.string().trim().max(1200).default(""),
  highlights: z.array(z.string().trim().max(300)).max(8).default([]),
  decisions: z.array(z.object({ title: z.string().trim().min(5).max(300), owner: z.string().trim().max(80).nullable().optional(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), unit: z.string().trim().max(80).nullable().optional(), detail: z.string().trim().max(600).nullable().optional() })).max(30).default([]),
  actions: z.array(z.object({ title: z.string().trim().min(5).max(300), owner: z.string().trim().max(80).nullable().optional(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), unit: z.string().trim().max(80).nullable().optional() })).max(40).default([]),
  open_questions: z.array(z.string().trim().max(300)).max(8).default([]),
});

type Proposal = z.infer<typeof proposalSchema>;
export type MinutesProposal = Omit<Proposal, "decisions" | "actions"> & {
  decisions: (Proposal["decisions"][number] & { owner_id: string | null; unit_id: string | null })[];
  actions: (Proposal["actions"][number] & { owner_id: string | null; unit_id: string | null })[];
  model: string;
};

function matchName(name: string | null | undefined, profiles: { id: string; full_name: string; short_name: string | null }[]) {
  if (!name) return null;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const n = norm(name).split(/[\s/+,]+/)[0];
  if (!n || n.length < 3) return null;
  const hit = profiles.find((p) => norm(p.short_name ?? "").split(/\s+/)[0] === n || norm(p.full_name).split(/\s+/)[0] === n);
  return hit?.id ?? null;
}

export async function structureMinutes(meetingId: string): Promise<ActionResult<MinutesProposal>> {
  const s = await requireAdmin();
  if (!hasLLM()) return fail("ANTHROPIC_API_KEY não configurada no servidor.");
  const supabase = await createClient();
  const [{ data: m }, { data: profiles }, { data: units }, { data: existing }] = await Promise.all([
    supabase.from("meetings").select("series_date,title,minutes:meeting_minutes(content,summary)").eq("id", meetingId).maybeSingle(),
    supabase.from("profiles").select("id,full_name,short_name").eq("is_active", true),
    supabase.from("business_units").select("id,name").eq("is_active", true),
    supabase.from("meeting_decisions").select("title").eq("meeting_id", meetingId),
  ]);
  if (!m?.minutes?.content?.trim()) return fail("A ata ainda não tem texto. Importe o arquivo ou cole o conteúdo primeiro.");
  const names = (profiles ?? []).map((p) => p.short_name ?? p.full_name.split(" ")[0]).join(", ");
  const unitNames = (units ?? []).map((u) => u.name).join(", ");
  const system = `${SYSTEM_BASE}
Você vai estruturar a ata abaixo. Devolva SOMENTE JSON:
{"summary": "3-4 frases executivas (máx. 90 palavras): o que foi decidido, números relevantes e o que ficou pendente",
 "highlights": ["até 6 fatos ou números importantes, uma frase cada"],
 "decisions": [{"title": "decisão tomada, frase direta", "owner": "primeiro nome entre: ${names} ou null", "due_date": "AAAA-MM-DD ou null", "unit": "uma de: ${unitNames} ou null", "detail": "contexto curto ou null"}],
 "actions": [{"title": "atividade/compromisso da tabela final ou do texto", "owner": "primeiro nome entre: ${names} ou null", "due_date": "AAAA-MM-DD ou null", "unit": "uma de: ${unitNames} ou null"}],
 "open_questions": ["até 5 pontos que ficaram sem decisão e merecem voltar ao COMEX"]}
Regras: só o que está na ata; decisões são o que foi DECIDIDO/APROVADO (não discussões); actions vêm principalmente da tabela de atividades (responsável e prazo). Datas sem ano usam o ano da reunião (${m.series_date.slice(0, 4)}); "próximo COMEX" = 7 dias depois da reunião; prazos vagos viram null. Não repita decisões já registradas: ${(existing ?? []).map((d) => d.title).join(" | ") || "nenhuma"}.`;
  const user = `REUNIÃO: ${m.title} de ${m.series_date}\n\nATA:\n${m.minutes.content.slice(0, 80_000)}`;
  try {
    const { json, raw } = await aiJSON<unknown>({ client: supabase, kind: "minutes_structure", actorId: s.profile.id, meta: { meeting_id: meetingId } }, system, user, 6000);
    const parsed = proposalSchema.safeParse(json);
    if (!parsed.success) return fail("A IA respondeu em formato inesperado. Tente de novo.");
    const unitByName = new Map((units ?? []).map((u) => [u.name.toLowerCase(), u.id]));
    const withIds = {
      ...parsed.data,
      decisions: parsed.data.decisions.map((d) => ({ ...d, owner_id: matchName(d.owner, profiles ?? []), unit_id: d.unit ? (unitByName.get(d.unit.toLowerCase()) ?? null) : null })),
      actions: parsed.data.actions.map((a) => ({ ...a, owner_id: matchName(a.owner, profiles ?? []), unit_id: a.unit ? (unitByName.get(a.unit.toLowerCase()) ?? null) : null })),
      model: raw.model,
    };
    return { ok: true, data: withIds };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha na IA.");
  }
}

const applySchema = z.object({
  summary: z.string().trim().max(1200).optional().nullable(),
  decisions: z.array(z.object({ title: z.string().trim().min(3).max(300), detail: z.string().trim().max(600).nullable().optional(), owner_id: z.string().uuid().nullable().optional(), unit_id: z.string().uuid().nullable().optional(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), create_task: z.boolean().default(true) })).max(30).default([]),
  actions: z.array(z.object({ title: z.string().trim().min(3).max(300), owner_id: z.string().uuid().nullable().optional(), owner_text: z.string().trim().max(80).nullable().optional(), unit_id: z.string().uuid().nullable().optional(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() })).max(40).default([]),
});

/** Registra o que o admin marcou na proposta: decisões (+ tarefa), compromissos e resumo. */
export async function applyMinutesProposal(meetingId: string, input: z.input<typeof applySchema>): Promise<ActionResult<{ decisions: number; tasks: number }>> {
  const s = await requireAdmin();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const supabase = await createClient();
  let decisions = 0, tasks = 0;
  for (const d of parsed.data.decisions) {
    const { error } = await supabase.rpc("create_decision_with_task", {
      p_meeting: meetingId,
      p_title: d.title,
      p_description: d.detail ?? null,
      p_owner: d.owner_id ?? null,
      p_due: d.due_date ?? null,
      p_unit: d.unit_id ?? null,
      p_agenda_item: null,
      p_create_task: d.create_task && !!d.owner_id,
    } as unknown as Database["public"]["Functions"]["create_decision_with_task"]["Args"]);
    if (!error) {
      decisions++;
      if (d.create_task && d.owner_id) tasks++;
    }
  }
  for (const a of parsed.data.actions) {
    const { error } = await supabase.from("tasks").insert({
      title: a.title,
      owner_id: a.owner_id ?? null,
      legacy_owner_text: a.owner_id ? null : (a.owner_text ?? null),
      unit_id: a.unit_id ?? null,
      meeting_id: meetingId,
      due_date: a.due_date ?? null,
      created_by: s.profile.id,
    });
    if (!error) tasks++;
    if (!error && a.owner_id && a.owner_id !== s.profile.id) await supabase.from("notifications").insert({ profile_id: a.owner_id, kind: "task_assigned", title: "Novo compromisso registrado na ata", body: a.title, link: "/tarefas" });
  }
  const patch: Database["public"]["Tables"]["meeting_minutes"]["Update"] = { structured_at: new Date().toISOString() };
  if (parsed.data.summary?.trim()) patch.summary = parsed.data.summary.trim();
  await supabase.from("meeting_minutes").update(patch).eq("meeting_id", meetingId);
  revalidateMinutes(meetingId);
  revalidatePath("/tarefas");
  revalidatePath("/admin/tarefas");
  return { ok: true, data: { decisions, tasks }, message: `${decisions} decisão(ões) e ${tasks} compromisso(s) registrados.` };
}
