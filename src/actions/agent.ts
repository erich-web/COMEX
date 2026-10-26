"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMember } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { fail, msg } from "./_helpers";
import { hasLLM, extractJSON } from "@/lib/llm";
import { aiCall } from "@/lib/ai-call";
import { CATEGORY_LABELS } from "@/lib/constants";
import { SYSTEM_BASE, answerQuestion, generateInsights } from "@/lib/agent-core";

/**
 * Agente COMEX — lê atas, decisões, compromissos e pautas e devolve análises:
 * problemas recorrentes, decisões em aberto, ideias de crescimento e perguntas críticas.
 * Regras: usa só dados aos quais o usuário tem acesso (RLS); nunca inventa números; cita as reuniões de origem.
 */

/** Gera uma nova rodada de análises (admin). Substitui as análises abertas da rodada anterior. */
export async function runAgentAnalysis(): Promise<ActionResult<{ count: number }>> {
  const s = await requireAdmin();
  if (!hasLLM()) return fail("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor para habilitar o agente.");
  const supabase = await createClient();
  try {
    const r = await generateInsights(supabase, s.profile.id);
    revalidatePath("/agente");
    revalidatePath("/");
    revalidatePath("/admin/ia");
    return { ok: true, data: { count: r.count }, message: `${r.count} análises geradas com base em ${r.stats.withText} atas com texto, ${r.stats.decisions} decisões e ${r.stats.items} pautas.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha na IA.");
  }
}

/** Pergunta livre ao agente — responde só com o que o usuário pode ver. */
export async function askAgent(question: string): Promise<ActionResult<{ answer: string }>> {
  const s = await requireMember();
  const q = question.trim();
  if (q.length < 4) return fail("Escreva uma pergunta.");
  if (!hasLLM()) return fail("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor para habilitar o agente.");
  const supabase = await createClient();
  try {
    const answer = await answerQuestion(supabase, { id: s.profile.id, name: s.profile.short_name ?? s.profile.full_name }, q);
    await supabase.from("agent_questions").insert({ profile_id: s.profile.id, question: q, answer });
    return { ok: true, data: { answer } };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha na IA.");
  }
}

const KIND_TO_CATEGORY: Record<string, string> = {
  recurring_problem: "brainstorm",
  pending_decision: "strategic_decision",
  growth_idea: "marketing_sales",
  critical_question: "strategic_decision",
  suggestion: "strategic_decision",
};

/** Transforma uma análise em pauta do usuário para a próxima terça. */
export async function insightToAgenda(id: string): Promise<ActionResult<{ item_id: string }>> {
  await requireMember();
  const supabase = await createClient();
  const { data: ins } = await supabase.from("agent_insights").select("*").eq("id", id).maybeSingle();
  if (!ins) return fail("Análise não encontrada.");
  if (ins.status === "turned_into_agenda" && ins.agenda_item_id) return { ok: true, data: { item_id: ins.agenda_item_id }, message: "Esta análise já virou pauta." };
  const batchId = crypto.randomUUID();
  const { data, error } = await supabase.rpc("submit_agenda_batch", {
    p_batch_id: batchId,
    p_items: [
      {
        title: ins.title.slice(0, 200),
        key_question: (ins.suggestion ? `Aprovamos: ${ins.suggestion}` : ins.body).slice(0, 600),
        description: `${ins.body}\n\n(Pauta originada pelo Agente COMEX)`,
        unit_id: ins.unit_id,
        category: KIND_TO_CATEGORY[ins.kind] ?? "other",
        suggested_minutes: 15,
        urgency: "medium",
        requires_decision: true,
        links: [],
      },
    ],
  });
  if (error) return fail(msg(error));
  const itemId = ((data as { item_ids?: string[] } | null)?.item_ids ?? [])[0];
  await supabase.from("agent_insights").update({ status: "turned_into_agenda", agenda_item_id: itemId ?? null, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/agente");
  revalidatePath("/pautas");
  revalidatePath("/admin");
  return { ok: true, data: { item_id: itemId }, message: "Pauta criada para a próxima terça." };
}

export async function dismissInsight(id: string): Promise<ActionResult> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("agent_insights").update({ status: "dismissed", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(msg(error));
  revalidatePath("/agente");
  return { ok: true };
}

/** Sugestão de agenda para a reunião: distribui pautas recebidas/aprovadas nos blocos (admin). */
export async function suggestAgendaForMeeting(meetingId: string): Promise<ActionResult<{ assigned: number; note: string }>> {
  const s = await requireAdmin();
  const supabase = await createClient();
  const [{ data: blocks }, { data: items }, { data: meeting }] = await Promise.all([
    supabase.from("meeting_blocks").select("id,kind,title,duration_minutes,sort_order").eq("meeting_id", meetingId).order("sort_order"),
    supabase.from("agenda_items").select("id,title,key_question,category,suggested_minutes,urgency,requires_decision,created_at,unit:business_units(name),author:profiles!agenda_items_submitted_by_fkey(short_name)").in("status", ["received", "in_review", "approved"]).is("block_id", null).is("deleted_at", null).order("created_at"),
    supabase.from("meetings").select("duration_minutes,series_date").eq("id", meetingId).single(),
  ]);
  if (!blocks?.length) return fail("A reunião ainda não tem blocos.");
  if (!items?.length) return { ok: true, data: { assigned: 0, note: "Não há pautas aguardando organização." } };

  const schema = z.object({
    items: z.array(z.object({ id: z.string(), block_id: z.string().nullable(), minutes: z.coerce.number().int().min(5).max(60), order: z.coerce.number().int(), reason: z.string().max(300).optional() })),
    note: z.string().max(600).optional(),
  });
  let plan: z.infer<typeof schema> | null = null;
  let llmError = hasLLM() ? "" : "ANTHROPIC_API_KEY não configurada";
  if (hasLLM()) {
    const system = `${SYSTEM_BASE}
Você organiza a agenda da terça. Receba blocos (com duração) e pautas pendentes. Devolva JSON {"items":[{"id","block_id"|null,"minutes","order","reason"}],"note":"resumo em 2 frases"}.
Regras: priorize decisões travadas, crescimento/receita e pautas com pergunta-chave clara; respeite a duração de cada bloco (a soma dos minutos por bloco não pode exceder a duração); pautas que não couberem recebem block_id null e reason "adiar". Minutos múltiplos de 5. Responda só com o JSON.`;
    const user = `REUNIÃO ${meeting?.series_date} · ${meeting?.duration_minutes} min\nBLOCOS:\n${blocks.map((b) => `- ${b.id} · ${b.title} (${b.kind}) · ${b.duration_minutes} min`).join("\n")}\n\nPAUTAS:\n${items.map((i) => `- ${i.id} · ${i.title} · ${CATEGORY_LABELS[i.category]} · ${i.unit?.name ?? "Grupo"} · por ${i.author?.short_name ?? "?"} · pede ${i.suggested_minutes ?? 10} min${i.requires_decision ? " · exige decisão" : ""}${i.key_question ? ` · pergunta: ${i.key_question}` : ""}`).join("\n")}`;
    try {
      const r = await aiCall({ client: supabase, kind: "agenda_plan", actorId: s.profile.id, meta: { meeting_id: meetingId } }, system, user, 3000);
      const parsed = schema.safeParse(extractJSON(r.text));
      if (parsed.success) plan = parsed.data;
      else llmError = "a IA respondeu em formato inesperado";
    } catch (e) {
      plan = null;
      llmError = e instanceof Error ? e.message : "erro na chamada à IA";
    }
  }
  if (!plan) {
    // fallback heurístico: bloco por categoria, tempo sugerido, respeitando duração
    const { CATEGORY_BLOCK } = await import("@/lib/constants");
    const used = new Map<string, number>();
    plan = {
      items: items.map((i, k) => {
        const kind = CATEGORY_BLOCK[i.category];
        const block = blocks.find((b) => b.kind === kind) ?? blocks.find((b) => b.kind === "deliberation") ?? blocks[0];
        const minutes = Math.min(Math.max(i.suggested_minutes ?? 10, 5), 30);
        const cur = used.get(block.id) ?? 0;
        const fits = cur + minutes <= block.duration_minutes;
        if (fits) used.set(block.id, cur + minutes);
        return { id: i.id, block_id: fits ? block.id : null, minutes, order: k + 1, reason: fits ? "bloco por temática" : "adiar" };
      }),
      note: `Distribuição automática por temática, sem IA — ${llmError}.`,
    };
  }
  const blockIds = new Set(blocks.map((b) => b.id));
  let assigned = 0;
  for (const p of plan.items) {
    if (!p.block_id || !blockIds.has(p.block_id) || !items.some((i) => i.id === p.id)) continue;
    const { error } = await supabase.from("agenda_items").update({ meeting_id: meetingId, block_id: p.block_id, status: "scheduled", allotted_minutes: p.minutes, sort_order: p.order, admin_notes: p.reason ?? null }).eq("id", p.id);
    if (!error) assigned++;
  }
  revalidatePath("/admin");
  revalidatePath("/admin/pautas");
  return { ok: true, data: { assigned, note: plan.note ?? "" }, message: `${assigned} pautas distribuídas.` };
}
