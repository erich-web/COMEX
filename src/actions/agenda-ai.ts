"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { fail } from "./_helpers";
import { aiJSON } from "@/lib/ai-call";
import { hasLLM, type ContentBlock } from "@/lib/llm";
import { SYSTEM_BASE } from "@/lib/agent-core";
import { CATEGORY_LABELS, THEME_OPTIONS } from "@/lib/constants";
import { suggestCategory } from "@/lib/classify";
import { extractTextFromFile } from "@/lib/minutes-import";

/**
 * Assistente de pautas: transforma uma lista/texto livre ou um arquivo em pautas prontas
 * para revisão, e completa uma pauta (pergunta-chave, tempo, temática, o que falta).
 */

const draftSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(200),
        key_question: z.string().trim().max(600).default(""),
        description: z.string().trim().max(2000).default(""),
        category: z.enum(["strategic_decision", "accountability", "business_review", "brainstorm", "knowledge", "marketing_sales", "innovation", "other"]).default("other"),
        suggested_minutes: z.coerce.number().int().min(5).max(30).default(10),
        unit: z.string().trim().max(80).nullable().optional(),
        missing: z.array(z.string().trim().max(160)).max(4).default([]),
      }),
    )
    .min(1)
    .max(15),
  note: z.string().trim().max(400).optional().default(""),
});
export type DraftedItem = z.infer<typeof draftSchema>["items"][number] & { unit_id: string | null };

function systemFor(units: { name: string }[]) {
  return `${SYSTEM_BASE}
Você transforma o material enviado por um executivo em PAUTAS do COMEX. Cada pauta precisa de:
- title: curto e específico (máx. 90 caracteres);
- key_question: a pergunta que o COMEX precisa responder ("Aprovamos X?", "Seguimos com Y ou paramos?") — se o material não deixa claro, formule a melhor pergunta possível a partir do contexto;
- description: contexto essencial (números, o que já foi tentado), em até 3 frases; vazio se não houver;
- category: uma de ${THEME_OPTIONS.map((c) => `${c} (${CATEGORY_LABELS[c]})`).join(", ")};
- suggested_minutes: 5 (aviso), 10 (decisão simples), 15 (decisão com discussão), 20 ou 30 (tema que exige material);
- unit: nome exato entre ${units.map((u) => u.name).join(", ")} ou null quando for do Grupo;
- missing: até 3 itens do que ainda falta para a pauta estar pronta (ex.: "números de vendas", "proposta de solução", "material em PDF").
Regras: uma pauta por assunto (não junte assuntos diferentes); não invente dados; mantenha o idioma do material (português). Devolva SOMENTE JSON {"items":[...],"note":"1 frase sobre o que você interpretou"}.`;
}

function withUnitIds(items: z.infer<typeof draftSchema>["items"], units: { id: string; name: string }[]): DraftedItem[] {
  const byName = new Map(units.map((u) => [u.name.toLowerCase(), u.id]));
  return items.map((i) => ({ ...i, unit_id: i.unit ? (byName.get(i.unit.toLowerCase()) ?? null) : null }));
}

/** Fallback sem IA: cada linha/numeração vira uma pauta. */
function heuristicDraft(text: string): z.infer<typeof draftSchema>["items"] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)]|[a-z][.)])\s*/i, "").trim())
    .filter((l) => l.length >= 3);
  const items = (lines.length ? lines : [text.trim()]).slice(0, 15).map((l) => {
    const title = l.length > 90 ? `${l.slice(0, 87)}…` : l;
    const isQuestion = /\?\s*$/.test(l);
    return { title: title.replace(/\?$/, ""), key_question: isQuestion ? l : "", description: l.length > 90 ? l : "", category: suggestCategory(l, "") ?? ("other" as const), suggested_minutes: 10, unit: null, missing: isQuestion ? [] : ["pergunta-chave"] };
  });
  return items;
}

export async function draftAgendaFromText(text: string): Promise<ActionResult<{ items: DraftedItem[]; note: string; ai: boolean }>> {
  const s = await requireMember();
  const t = text.trim();
  if (t.length < 3) return fail("Escreva ou cole a lista de assuntos.");
  const supabase = await createClient();
  const { data: units } = await supabase.from("business_units").select("id,name").eq("is_active", true).neq("slug", "grupo-holding");
  const list = units ?? [];
  if (!hasLLM()) return { ok: true, data: { items: withUnitIds(heuristicDraft(t), list), note: "Sem IA configurada: cada linha virou uma pauta. Complete a pergunta-chave de cada uma.", ai: false } };
  try {
    const { json } = await aiJSON<unknown>({ client: supabase, kind: "agenda_draft", actorId: s.profile.id, meta: { source: "text", chars: t.length } }, systemFor(list), `MATERIAL DO EXECUTIVO (${s.profile.short_name ?? s.profile.full_name}):\n${t.slice(0, 20_000)}`, 4000);
    const parsed = draftSchema.safeParse(json);
    if (!parsed.success) return { ok: true, data: { items: withUnitIds(heuristicDraft(t), list), note: "A IA respondeu em formato inesperado; cada linha virou uma pauta.", ai: false } };
    return { ok: true, data: { items: withUnitIds(parsed.data.items, list), note: parsed.data.note, ai: true } };
  } catch (e) {
    return { ok: true, data: { items: withUnitIds(heuristicDraft(t), list), note: `IA indisponível (${e instanceof Error ? e.message : "erro"}); cada linha virou uma pauta.`, ai: false } };
  }
}

/** Arquivo já enviado ao Storage pelo navegador (pasta do próprio usuário). PDF e imagens vão direto para a IA; Word vira texto. */
export async function draftAgendaFromFile(file: { path: string; name: string }): Promise<ActionResult<{ items: DraftedItem[]; note: string; ai: boolean }>> {
  const s = await requireMember();
  if (!file.path.startsWith(`${s.profile.id}/`)) return fail("Arquivo inválido.");
  if (!hasLLM()) return fail("A leitura de arquivos pela IA não está configurada no servidor (ANTHROPIC_API_KEY).");
  const supabase = await createClient();
  const { data: blob, error } = await supabase.storage.from("comex").download(file.path);
  if (error || !blob) return fail(`Não foi possível ler o arquivo: ${error?.message ?? ""}`);
  const { data: units } = await supabase.from("business_units").select("id,name").eq("is_active", true).neq("slug", "grupo-holding");
  const list = units ?? [];
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > 20 * 1024 * 1024) return fail("Arquivo acima de 20 MB.");
  const lower = file.name.toLowerCase();
  const mime = blob.type || "";
  let content: string | ContentBlock[];
  try {
    if (mime.includes("pdf") || lower.endsWith(".pdf")) {
      content = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") } }, { type: "text", text: `Arquivo "${file.name}" enviado por ${s.profile.short_name ?? s.profile.full_name}. Extraia as pautas.` }];
    } else if (/^image\/(png|jpeg|webp|gif)$/.test(mime) || /\.(png|jpe?g|webp|gif)$/.test(lower)) {
      const media = (mime || `image/${lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : lower.endsWith(".gif") ? "gif" : "jpeg"}`) as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
      content = [{ type: "image", source: { type: "base64", media_type: media, data: Buffer.from(bytes).toString("base64") } }, { type: "text", text: `Imagem "${file.name}" (foto de anotações ou print) enviada por ${s.profile.short_name ?? s.profile.full_name}. Extraia as pautas.` }];
    } else {
      const ex = await extractTextFromFile(bytes, file.name, mime);
      if (ex.text.trim().length < 3) return fail("O arquivo não tem texto legível.");
      content = `MATERIAL DO EXECUTIVO (${s.profile.short_name ?? s.profile.full_name}) — arquivo ${file.name}:\n${ex.text.slice(0, 20_000)}`;
    }
    const { json } = await aiJSON<unknown>({ client: supabase, kind: "agenda_draft", actorId: s.profile.id, meta: { source: "file", name: file.name } }, systemFor(list), content, 4000);
    const parsed = draftSchema.safeParse(json);
    if (!parsed.success) return fail("A IA não conseguiu extrair pautas deste arquivo. Tente colar o texto.");
    return { ok: true, data: { items: withUnitIds(parsed.data.items, list), note: parsed.data.note, ai: true } };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
  }
}

const assistSchema = z.object({
  key_question: z.string().trim().max(600).default(""),
  suggested_minutes: z.coerce.number().int().min(5).max(30).default(10),
  category: z.enum(["strategic_decision", "accountability", "business_review", "brainstorm", "knowledge", "marketing_sales", "innovation", "other"]).optional(),
  missing: z.array(z.string().trim().max(160)).max(4).default([]),
  tip: z.string().trim().max(240).optional().default(""),
});
export type AgendaAssist = z.infer<typeof assistSchema>;

/** Completa uma pauta: sugere pergunta-chave, tempo, temática e aponta o que falta. */
export async function assistAgendaItem(input: { title: string; key_question: string; description: string; category: string; suggested_minutes: number | null; has_attachment: boolean }): Promise<ActionResult<AgendaAssist & { ai: boolean }>> {
  const s = await requireMember();
  const title = input.title.trim();
  if (title.length < 3) return fail("Dê um título primeiro.");
  const localMissing: string[] = [];
  if (input.key_question.trim().length < 8) localMissing.push("pergunta-chave");
  if ((input.suggested_minutes ?? 0) >= 20 && !input.has_attachment && input.description.trim().length < 40) localMissing.push("material ou contexto para um tema de 20+ min");
  if (!hasLLM()) return { ok: true, data: { key_question: "", suggested_minutes: input.suggested_minutes ?? 10, category: suggestCategory(title, input.description) ?? undefined, missing: localMissing, tip: "", ai: false } };
  const supabase = await createClient();
  const system = `${SYSTEM_BASE}
Você ajuda um executivo a deixar uma pauta pronta para o COMEX. Devolva SOMENTE JSON:
{"key_question": "a melhor pergunta que o COMEX deve responder sobre esta pauta (direta, fechada quando possível: Aprovamos…? Seguimos…? Qual…?)",
 "suggested_minutes": 5|10|15|20|30,
 "category": uma de ${THEME_OPTIONS.join(", ")},
 "missing": ["até 3 coisas concretas que faltam para a pauta render decisão (números, proposta, responsável, material)"],
 "tip": "1 frase de orientação, no tom de um bom chefe de gabinete"}
Regras: 5 min = aviso; 10–15 = decisão; 20+ = tema com material. Não invente fatos. Se já houver pergunta-chave boa, mantenha-a (pode lapidar).`;
  const user = `TÍTULO: ${title}\nPERGUNTA-CHAVE ATUAL: ${input.key_question || "(vazia)"}\nCONTEXTO: ${input.description || "(vazio)"}\nTEMÁTICA ESCOLHIDA: ${input.category}\nTEMPO ESCOLHIDO: ${input.suggested_minutes ?? "—"} min\nANEXO: ${input.has_attachment ? "sim" : "não"}`;
  try {
    const { json } = await aiJSON<unknown>({ client: supabase, kind: "agenda_assist", actorId: s.profile.id }, system, user, 600);
    const parsed = assistSchema.safeParse(json);
    if (!parsed.success) return { ok: true, data: { key_question: "", suggested_minutes: input.suggested_minutes ?? 10, missing: localMissing, tip: "", ai: false } };
    return { ok: true, data: { ...parsed.data, ai: true } };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha na IA.");
  }
}
