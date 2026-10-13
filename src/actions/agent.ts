"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMember } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { fail, msg } from "./_helpers";
import { callModel, extractJSON, hasLLM } from "@/lib/llm";
import { fmtDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/constants";
import { todaySP } from "@/lib/dates";

/**
 * Agente COMEX — lê atas, decisões, compromissos e pautas e devolve análises:
 * problemas recorrentes, decisões em aberto, ideias de crescimento e perguntas críticas.
 * Regras: usa só dados aos quais o usuário tem acesso (RLS); nunca inventa números; cita as reuniões de origem.
 */

const SYSTEM_BASE = `Você é o Agente COMEX, analista executivo do Comitê Executivo do Grupo RPE (gastronomia, hospitalidade e eventos no Brasil; unidades: Mercearia Amauri, Nami, Mercearia Campos, Bam Bam Café, Mamma Gorda, Eventos). Ambição: R$ 200 milhões de receita anual em 2030.
Seu papel: provocar pensamento crítico orientado a crescimento de negócio, criatividade e descentralização. Prefira oportunidades de receita, cross-selling entre unidades, decisões travadas e problemas que voltam sem solução.
REGRAS: use apenas o material fornecido; nunca invente números, pessoas, datas ou decisões; quando faltar informação, diga que falta. Escreva em português do Brasil, direto e executivo.`;

async function buildCorpus(opts: { meetings?: number; weeksOfAgenda?: number } = {}) {
  const supabase = await createClient();
  const today = todaySP();
  const since = new Date(Date.now() - (opts.weeksOfAgenda ?? 16) * 7 * 86400_000).toISOString();
  const [{ data: meetings }, { data: decisions }, { data: tasks }, { data: items }, { data: checkins }] = await Promise.all([
    supabase.from("meetings").select("id,series_date,title,minutes:meeting_minutes(title,summary,content,status)").in("status", ["closed"]).order("series_date", { ascending: false }).limit(opts.meetings ?? 24),
    supabase.from("meeting_decisions").select("title,description,due_date,meeting:meetings(series_date),owner:profiles!meeting_decisions_owner_id_fkey(short_name),unit:business_units(name),task:tasks(status,due_date)").order("created_at", { ascending: false }).limit(150),
    supabase.from("tasks").select("title,status,due_date,owner:profiles!tasks_owner_id_fkey(short_name),unit:business_units(name),legacy_owner_text").is("deleted_at", null).not("status", "in", '("done","cancelled")').order("due_date", { ascending: true, nullsFirst: false }).limit(150),
    supabase.from("agenda_items").select("id,title,key_question,description,category,status,created_at,unit:business_units(name),author:profiles!agenda_items_submitted_by_fkey(short_name),meeting:meetings(series_date)").is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(120),
    supabase.from("weekly_checkins").select("week_start,sales_summary,problems,solutions,sales_initiatives,needs_from_comex,unit:business_units(name)").order("week_start", { ascending: false }).limit(30),
  ]);

  const lines: string[] = [];
  lines.push(`DATA DE HOJE: ${today}`);
  lines.push(`\n## ATAS (${meetings?.length ?? 0}, mais recente primeiro)`);
  for (const m of meetings ?? []) {
    const mm = m.minutes;
    const body = (mm?.summary ? `${mm.summary}\n` : "") + (mm?.content ?? "");
    lines.push(`\n### ${fmtDate(m.series_date, { day: "2-digit", month: "short", year: "numeric" })} — ${mm?.title || m.title} [id:${m.id}]\n${body.slice(0, 2500) || "(sem texto de ata)"}`);
  }
  lines.push(`\n## DECISÕES REGISTRADAS (${decisions?.length ?? 0})`);
  for (const d of decisions ?? []) {
    const t = d.task?.[0];
    lines.push(`- ${d.meeting?.series_date ?? ""} · ${d.title}${d.owner?.short_name ? ` · resp.: ${d.owner.short_name}` : ""}${d.unit?.name ? ` · ${d.unit.name}` : ""}${d.due_date ? ` · prazo ${d.due_date}` : ""} · execução: ${t ? t.status : "sem tarefa"}`);
  }
  lines.push(`\n## COMPROMISSOS EM ABERTO (${tasks?.length ?? 0})`);
  for (const t of tasks ?? []) {
    lines.push(`- ${t.title} · ${t.owner?.short_name ?? t.legacy_owner_text ?? "sem dono"}${t.unit?.name ? ` · ${t.unit.name}` : ""} · ${t.status}${t.due_date ? ` · prazo ${t.due_date}${t.due_date < today ? " (ATRASADO)" : ""}` : ""}`);
  }
  lines.push(`\n## PAUTAS RECENTES (${items?.length ?? 0})`);
  for (const i of items ?? []) {
    lines.push(`- ${i.created_at.slice(0, 10)} · ${i.title} · ${CATEGORY_LABELS[i.category]} · ${i.unit?.name ?? "Grupo"} · por ${i.author?.short_name ?? "?"} · ${i.status}${i.key_question ? ` · pergunta: ${i.key_question}` : ""}${i.description ? ` · ${i.description.slice(0, 300)}` : ""}`);
  }
  if (checkins?.length) {
    lines.push(`\n## CHECK-INS SEMANAIS DAS UNIDADES (${checkins.length})`);
    for (const c of checkins) {
      const probs = Array.isArray(c.problems) ? (c.problems as { title?: string }[]).map((p) => p.title).filter(Boolean).join("; ") : "";
      lines.push(`- ${c.week_start} · ${c.unit?.name ?? ""} · vendas: ${c.sales_summary ?? "-"} · problemas: ${probs || "-"} · soluções: ${c.solutions ?? "-"} · comercial: ${c.sales_initiatives ?? "-"} · precisa do COMEX: ${c.needs_from_comex ?? "-"}`);
    }
  }
  return { text: lines.join("\n").slice(0, 150_000), meetings: meetings ?? [] };
}

const insightSchema = z.object({
  kind: z.enum(["recurring_problem", "growth_idea", "critical_question", "suggestion", "pending_decision"]),
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().max(1500).default(""),
  suggestion: z.string().trim().max(1200).optional().nullable(),
  unit: z.string().trim().max(80).optional().nullable(),
  evidence: z.array(z.object({ date: z.string().optional().nullable(), title: z.string().optional().nullable(), meeting_id: z.string().optional().nullable() })).max(12).default([]),
  score: z.coerce.number().int().min(0).max(100).default(50),
});

/** Gera uma nova rodada de análises (admin). Substitui as análises abertas da rodada anterior. */
export async function runAgentAnalysis(): Promise<ActionResult<{ count: number }>> {
  const s = await requireAdmin();
  if (!hasLLM()) return fail("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor para habilitar o agente.");
  const supabase = await createClient();
  const corpus = await buildCorpus();
  const { data: units } = await supabase.from("business_units").select("id,name").eq("is_active", true);

  const system = `${SYSTEM_BASE}
Produza entre 5 e 9 análises em JSON (array), cada uma com:
{"kind": "recurring_problem" | "pending_decision" | "growth_idea" | "critical_question" | "suggestion",
 "title": frase curta e específica,
 "body": 2-4 frases com os fatos (datas, quantas vezes apareceu, quem é o dono, o que está travado),
 "suggestion": proposta concreta de decisão/ação para a próxima terça (responsável sugerido entre os nomes citados, prazo sugerido),
 "unit": nome exato da unidade entre ${(units ?? []).map((u) => u.name).join(", ")} ou null,
 "evidence": [{"date":"AAAA-MM-DD","title":"título da ata/pauta","meeting_id":"id quando for ata"}],
 "score": 0-100 (impacto em receita/urgência)}
Inclua pelo menos: 1 problema recorrente (tema que aparece em 2+ atas sem decisão fechada), 1 decisão em aberto com compromisso atrasado, 2 ideias de crescimento (cruzando unidades, cross-selling, novos negócios), 1 pergunta crítica (padrão do COMEX: reativo vs. criador, concentração de pautas, temas que ninguém traz). Responda SOMENTE com o JSON.`;

  let text: string;
  try {
    text = await callModel(system, corpus.text, 6000);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha na IA.");
  }
  const raw = extractJSON<unknown[]>(text);
  if (!Array.isArray(raw)) return fail("O agente não devolveu um formato válido. Tente de novo.");
  const parsed = raw.map((r) => insightSchema.safeParse(r)).filter((r) => r.success).map((r) => r.data!);
  if (!parsed.length) return fail("Nenhuma análise válida foi gerada.");

  const runId = crypto.randomUUID();
  const unitByName = new Map((units ?? []).map((u) => [u.name.toLowerCase(), u.id]));
  const validMeetingIds = new Set(corpus.meetings.map((m) => m.id));
  const rows = parsed.map((p) => ({
    kind: p.kind,
    title: p.title,
    body: p.body,
    suggestion: p.suggestion ?? null,
    unit_id: p.unit ? (unitByName.get(p.unit.toLowerCase()) ?? null) : null,
    evidence: p.evidence.map((e) => ({ date: e.date ?? null, title: e.title ?? null, meeting_id: e.meeting_id && validMeetingIds.has(e.meeting_id) ? e.meeting_id : null })),
    score: p.score,
    run_id: runId,
    generated_by: s.profile.id,
  }));

  // mantém o que já virou pauta ou foi descartado; renova as abertas
  await supabase.from("agent_insights").delete().eq("status", "open");
  const { error } = await supabase.from("agent_insights").insert(rows);
  if (error) return fail(msg(error));
  revalidatePath("/agente");
  revalidatePath("/");
  return { ok: true, data: { count: rows.length }, message: `${rows.length} análises geradas.` };
}

/** Pergunta livre ao agente — responde só com o que o usuário pode ver. */
export async function askAgent(question: string): Promise<ActionResult<{ answer: string }>> {
  const s = await requireMember();
  const q = question.trim();
  if (q.length < 4) return fail("Escreva uma pergunta.");
  if (!hasLLM()) return fail("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor para habilitar o agente.");
  const corpus = await buildCorpus({ meetings: 20, weeksOfAgenda: 24 });
  const system = `${SYSTEM_BASE}
Responda à pergunta do executivo em até 180 palavras, em texto corrido ou lista curta. Cite as datas das atas/pautas que sustentam cada afirmação (ex.: "ata de 29/09"). Se a resposta não estiver no material, diga claramente que não há registro.`;
  try {
    const answer = await callModel(system, `${corpus.text}\n\n## PERGUNTA DE ${s.profile.short_name ?? s.profile.full_name}\n${q}`, 1200);
    const supabase = await createClient();
    await supabase.from("agent_questions").insert({ profile_id: s.profile.id, question: q, answer });
    return { ok: true, data: { answer: answer.trim() } };
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
  const s = await requireMember();
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
  void s;
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
  await requireAdmin();
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
  if (hasLLM()) {
    const system = `${SYSTEM_BASE}
Você organiza a agenda da terça. Receba blocos (com duração) e pautas pendentes. Devolva JSON {"items":[{"id","block_id"|null,"minutes","order","reason"}],"note":"resumo em 2 frases"}.
Regras: priorize decisões travadas, crescimento/receita e pautas com pergunta-chave clara; respeite a duração de cada bloco (a soma dos minutos por bloco não pode exceder a duração); pautas que não couberem recebem block_id null e reason "adiar". Minutos múltiplos de 5. Responda só com o JSON.`;
    const user = `REUNIÃO ${meeting?.series_date} · ${meeting?.duration_minutes} min\nBLOCOS:\n${blocks.map((b) => `- ${b.id} · ${b.title} (${b.kind}) · ${b.duration_minutes} min`).join("\n")}\n\nPAUTAS:\n${items.map((i) => `- ${i.id} · ${i.title} · ${CATEGORY_LABELS[i.category]} · ${i.unit?.name ?? "Grupo"} · por ${i.author?.short_name ?? "?"} · pede ${i.suggested_minutes ?? 10} min${i.requires_decision ? " · exige decisão" : ""}${i.key_question ? ` · pergunta: ${i.key_question}` : ""}`).join("\n")}`;
    try {
      const text = await callModel(system, user, 3000);
      const r = schema.safeParse(extractJSON(text));
      if (r.success) plan = r.data;
    } catch {
      plan = null;
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
      note: "Distribuição heurística por temática (IA indisponível).",
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
