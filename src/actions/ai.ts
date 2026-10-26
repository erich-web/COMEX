"use server";

import { requireAdmin, requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { fail } from "./_helpers";
import { fmtDate } from "@/lib/format";
import { hasLLM } from "@/lib/llm";
import { aiCall } from "@/lib/ai-call";

/**
 * Camada de IA modular. Usa a API da Anthropic quando ANTHROPIC_API_KEY está configurada.
 * Regras: nunca inventar participantes, decisões ou prazos; sempre retornar rascunho para revisão humana.
 */

/** Sugere ata (resumo + conteúdo) a partir de anotações/transcrição — rascunho para revisão. */
export async function draftMinutesFromNotes(meetingId: string, notes: string): Promise<ActionResult<{ summary: string; content: string }>> {
  const s = await requireAdmin();
  if (notes.trim().length < 40) return fail("Cole anotações mais completas.");
  const supabase = await createClient();
  const [{ data: m }, { data: participants }, { data: items }] = await Promise.all([
    supabase.from("meetings").select("series_date,title").eq("id", meetingId).single(),
    supabase.from("meeting_participants").select("profile:profiles(short_name,full_name)").eq("meeting_id", meetingId),
    supabase.from("agenda_items").select("title").eq("meeting_id", meetingId).in("status", ["scheduled", "discussed"]).order("sort_order"),
  ]);
  const system = `Você redige atas do Comitê Executivo (COMEX) do Grupo RPE, grupo brasileiro de gastronomia, hospitalidade e eventos. Escreva em português do Brasil, tom direto e executivo.
REGRAS INEGOCIÁVEIS: use apenas informações presentes nas anotações. Não invente participantes, decisões, números, responsáveis ou prazos. Quando algo não estiver claro, escreva "[a confirmar]".
Formato de saída: primeira linha "RESUMO: <2-3 frases>"; depois o corpo com as seções PARTICIPANTES, PAUTAS DISCUTIDAS (numeradas, com síntese), DECISÕES (numeradas, com responsável e prazo quando citados), ENCAMINHAMENTOS (tarefas, responsável, prazo).`;
  const user = `Reunião: ${m?.title ?? "COMEX"} de ${m ? fmtDate(m.series_date, { day: "2-digit", month: "long", year: "numeric" }) : ""}.
Participantes cadastrados: ${(participants ?? []).map((p) => p.profile?.short_name ?? p.profile?.full_name).filter(Boolean).join(", ") || "não informados"}.
Pautas agendadas: ${(items ?? []).map((i) => i.title).join("; ") || "não informadas"}.

ANOTAÇÕES/TRANSCRIÇÃO:
${notes.slice(0, 60000)}`;
  try {
    const r = await aiCall({ client: supabase, kind: "minutes_draft", actorId: s.profile.id, meta: { meeting_id: meetingId } }, system, user, 4000);
    const text = r.text;
    const m1 = text.match(/^RESUMO:\s*([^\n]+(?:\n(?!\n)[^\n]+)*)\n\n?/);
    const summary = m1?.[1]?.trim() ?? "";
    const content = m1 ? text.slice(m1[0].length).trim() : text.trim();
    return { ok: true, data: { summary, content } };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha na IA.");
  }
}

/** Sugere categoria para uma pauta (fallback heurístico quando não há chave). */
export async function suggestAgendaCategoryAI(title: string, description: string): Promise<ActionResult<{ category: string }>> {
  const s = await requireMember();
  const { suggestCategory } = await import("@/lib/classify");
  const heuristic = suggestCategory(title, description);
  if (!hasLLM()) return { ok: true, data: { category: heuristic ?? "other" } };
  try {
    const supabase = await createClient();
    const r = await aiCall({ client: supabase, kind: "classify", actorId: s.profile.id }, "Classifique a pauta de um comitê executivo em UMA destas categorias e responda só com a chave: strategic_decision, accountability, business_review, brainstorm, knowledge, marketing_sales, innovation, other.", `Título: ${title}\nDescrição: ${description}`, 20);
    const key = r.text.trim().toLowerCase().replace(/[^a-z_]/g, "");
    const valid = ["strategic_decision", "accountability", "business_review", "brainstorm", "knowledge", "marketing_sales", "innovation", "other"];
    return { ok: true, data: { category: valid.includes(key) ? key : (heuristic ?? "other") } };
  } catch {
    return { ok: true, data: { category: heuristic ?? "other" } };
  }
}
