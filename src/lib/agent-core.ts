import "server-only";
import { z } from "zod";
import type { DbClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { aiCall, aiJSON } from "@/lib/ai-call";
import { hasLLM } from "@/lib/llm";
import { fmtDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/constants";
import { todaySP } from "@/lib/dates";

/**
 * Núcleo do Agente COMEX — funciona com o cliente do usuário (RLS) ou com o cliente de serviço (cron).
 * Lê atas, decisões, compromissos, pautas e check-ins e devolve análises orientadas a crescimento.
 * Regras: usa só o material fornecido; nunca inventa números; cita as reuniões de origem.
 */

export const SYSTEM_BASE = `Você é o Agente COMEX, analista executivo do Comitê Executivo do Grupo RPE (gastronomia, hospitalidade e eventos no Brasil; unidades: Mercearia Amauri e Casa Amauri em São Paulo; Nami, Mercearia Campos, Bam Bam Café, Mamma Gorda, Campos Hall/Eventos e Zur Suítes em Campos do Jordão). Ambição: R$ 200 milhões de receita anual em 2030.
Seu papel: provocar pensamento crítico orientado a crescimento de negócio, vendas, criatividade e descentralização. Prefira oportunidades de receita, cross-selling entre unidades, decisões travadas e problemas que voltam sem solução.
As atas seguem o modelo D1 Desempenho (resultados, caixa, custos), D2 Direcionamento (estratégia, investimentos), D3 Desenvolvimento (pessoas, cultura) e D4 Defesa (riscos), com uma tabela final de atividades (responsável e prazo).
REGRAS: use apenas o material fornecido; nunca invente números, pessoas, datas ou decisões; quando faltar informação, diga que falta. Escreva em português do Brasil, direto e executivo.`;

export type Corpus = { text: string; meetings: { id: string; series_date: string }[]; stats: { meetings: number; withText: number; decisions: number; tasks: number; items: number; checkins: number } };

export async function buildCorpus(supabase: DbClient, opts: { meetings?: number; weeksOfAgenda?: number; maxChars?: number } = {}): Promise<Corpus> {
  const today = todaySP();
  const since = new Date(Date.now() - (opts.weeksOfAgenda ?? 16) * 7 * 86400_000).toISOString();
  const [{ data: meetings }, { data: decisions }, { data: tasks }, { data: items }, { data: checkins }] = await Promise.all([
    supabase.from("meetings").select("id,series_date,title,minutes:meeting_minutes(title,summary,content,status)").in("status", ["closed", "in_progress"]).lte("series_date", today).order("series_date", { ascending: false }).limit(opts.meetings ?? 24),
    supabase.from("meeting_decisions").select("title,description,due_date,meeting:meetings(series_date),owner:profiles!meeting_decisions_owner_id_fkey(short_name),unit:business_units(name),task:tasks(status,due_date)").order("created_at", { ascending: false }).limit(150),
    supabase.from("tasks").select("title,status,due_date,owner:profiles!tasks_owner_id_fkey(short_name),unit:business_units(name),legacy_owner_text").is("deleted_at", null).not("status", "in", '("done","cancelled")').order("due_date", { ascending: true, nullsFirst: false }).limit(150),
    supabase.from("agenda_items").select("id,title,key_question,description,category,status,created_at,unit:business_units(name),author:profiles!agenda_items_submitted_by_fkey(short_name),meeting:meetings(series_date)").is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(120),
    supabase.from("weekly_checkins").select("week_start,sales_summary,problems,solutions,sales_initiatives,needs_from_comex,unit:business_units(name)").order("week_start", { ascending: false }).limit(30),
  ]);

  const lines: string[] = [];
  lines.push(`DATA DE HOJE: ${today}`);
  lines.push(`\n## ATAS (${meetings?.length ?? 0}, mais recente primeiro)`);
  let withText = 0;
  (meetings ?? []).forEach((m, k) => {
    const mm = m.minutes;
    const body = (mm?.summary ? `RESUMO: ${mm.summary}\n` : "") + (mm?.content ?? "");
    if (body.trim()) withText++;
    // as 8 atas mais recentes entram quase inteiras; as demais, só o começo (resumo + abertura)
    const limit = k < 6 ? 12_000 : 2_500;
    lines.push(`\n### ${fmtDate(m.series_date, { day: "2-digit", month: "short", year: "numeric" })} — ${mm?.title || m.title} [id:${m.id}]\n${body.slice(0, limit) || "(sem texto de ata registrado)"}`);
  });
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
  return {
    text: lines.join("\n").slice(0, opts.maxChars ?? 160_000),
    meetings: (meetings ?? []).map((m) => ({ id: m.id, series_date: m.series_date })),
    stats: { meetings: meetings?.length ?? 0, withText, decisions: decisions?.length ?? 0, tasks: tasks?.length ?? 0, items: items?.length ?? 0, checkins: checkins?.length ?? 0 },
  };
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

export type GeneratedInsights = { count: number; model: string; stats: Corpus["stats"] };

/** Gera uma nova rodada de análises e substitui as abertas da rodada anterior. */
export async function generateInsights(supabase: DbClient, generatedBy: string | null): Promise<GeneratedInsights> {
  if (!hasLLM()) throw new Error("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor para habilitar o agente.");
  const corpus = await buildCorpus(supabase);
  if (!corpus.stats.withText && !corpus.stats.decisions && !corpus.stats.items) throw new Error("Não há atas, decisões nem pautas registradas para analisar.");
  const { data: units } = await supabase.from("business_units").select("id,name").eq("is_active", true);

  const system = `${SYSTEM_BASE}
Produza entre 6 e 8 análises em JSON (array), cada uma com:
{"kind": "recurring_problem" | "pending_decision" | "growth_idea" | "critical_question" | "suggestion",
 "title": frase curta e específica,
 "body": 2-4 frases com os fatos (datas, quantas vezes apareceu, quem é o dono, o que está travado, números citados nas atas),
 "suggestion": proposta concreta de decisão/ação para a próxima terça (responsável sugerido entre os nomes citados, prazo sugerido),
 "unit": nome exato da unidade entre ${(units ?? []).map((u) => u.name).join(", ")} ou null,
 "evidence": [{"date":"AAAA-MM-DD","title":"título da ata/pauta","meeting_id":"id quando for ata"}],
 "score": 0-100 (impacto em receita/urgência)}
Inclua pelo menos: 2 problemas recorrentes (tema que aparece em 2+ atas sem decisão fechada), 1 decisão em aberto com compromisso atrasado, 2 ideias de crescimento (cruzando unidades, cross-selling, novos negócios, aumento de ticket/ocupação), 1 pergunta crítica (padrão do COMEX: reativo vs. criador, concentração de pautas, temas que ninguém traz). Responda SOMENTE com o JSON.`;

  const { json, raw } = await aiJSON<unknown[]>({ client: supabase, kind: "analysis", actorId: generatedBy, meta: corpus.stats as unknown as Record<string, Json> }, system, corpus.text, 5000);
  if (!Array.isArray(json)) throw new Error("O agente não devolveu um formato válido. Tente de novo.");
  const parsed = json.map((r) => insightSchema.safeParse(r)).filter((r) => r.success).map((r) => r.data!);
  if (!parsed.length) throw new Error("Nenhuma análise válida foi gerada.");

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
    generated_by: generatedBy,
  }));

  // mantém o que já virou pauta ou foi descartado; renova as abertas
  await supabase.from("agent_insights").delete().eq("status", "open");
  const { error } = await supabase.from("agent_insights").insert(rows);
  if (error) throw new Error(error.message);
  return { count: rows.length, model: raw.model, stats: corpus.stats };
}

/** Pergunta livre — responde só com o que o cliente (RLS) enxerga. */
export async function answerQuestion(supabase: DbClient, asker: { id: string; name: string }, question: string): Promise<string> {
  const corpus = await buildCorpus(supabase, { meetings: 20, weeksOfAgenda: 24 });
  const system = `${SYSTEM_BASE}
Responda à pergunta do executivo em até 200 palavras, em texto corrido ou lista curta. Cite as datas das atas/pautas que sustentam cada afirmação (ex.: "ata de 29/09"). Se a resposta não estiver no material, diga claramente que não há registro.`;
  const r = await aiCall({ client: supabase, kind: "question", actorId: asker.id }, system, `${corpus.text}\n\n## PERGUNTA DE ${asker.name}\n${question}`, 1500);
  return r.text.trim();
}

/** Garante um resumo executivo (3–4 frases) da ata; grava em meeting_minutes.summary quando vazio. */
export async function ensureMinutesSummary(supabase: DbClient, meetingId: string, actorId: string | null): Promise<string | null> {
  const { data: mm } = await supabase.from("meeting_minutes").select("id,summary,content,meeting:meetings(series_date)").eq("meeting_id", meetingId).maybeSingle();
  if (!mm) return null;
  if (mm.summary?.trim()) return mm.summary;
  if (!mm.content?.trim() || !hasLLM()) return null;
  const system = `${SYSTEM_BASE}\nResuma a ata em 3 a 4 frases (máximo 90 palavras): o que foi decidido, os números mais relevantes e o que ficou pendente. Sem introdução, sem lista.`;
  try {
    const r = await aiCall({ client: supabase, kind: "minutes_draft", actorId, meta: { meeting_id: meetingId, purpose: "summary" } }, system, `ATA DE ${mm.meeting?.series_date ?? ""}:\n${mm.content.slice(0, 60_000)}`, 400);
    const summary = r.text.trim();
    if (summary) await supabase.from("meeting_minutes").update({ summary }).eq("id", mm.id);
    return summary || null;
  } catch {
    return null;
  }
}
