import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/admin";
import { callModelFull, extractJSON, type CallResult, type ContentBlock } from "@/lib/llm";

export type AiKind = "analysis" | "question" | "agenda_plan" | "minutes_structure" | "agenda_draft" | "agenda_assist" | "minutes_draft" | "classify" | "test";

type Ctx = { client: DbClient; kind: AiKind; actorId?: string | null; meta?: Record<string, Json | undefined> };

/** Chamada à IA com registro em ai_runs (sucesso, erro, tokens, duração) — base do diagnóstico em /admin/ia. */
export async function aiCall(ctx: Ctx, system: string, user: string | ContentBlock[], maxTokens = 2000): Promise<CallResult> {
  const t0 = Date.now();
  try {
    const r = await callModelFull(system, user, maxTokens);
    await log(ctx, { model: r.model, ok: true, input_tokens: r.inputTokens, output_tokens: r.outputTokens, duration_ms: Date.now() - t0 });
    return r;
  } catch (e) {
    await log(ctx, { ok: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - t0 });
    throw e;
  }
}

export async function aiJSON<T>(ctx: Ctx, system: string, user: string | ContentBlock[], maxTokens = 3000): Promise<{ json: T | null; raw: CallResult }> {
  const raw = await aiCall(ctx, system, user, maxTokens);
  return { json: extractJSON<T>(raw.text), raw };
}

async function log(ctx: Ctx, row: { model?: string; ok: boolean; error?: string; input_tokens?: number; output_tokens?: number; duration_ms: number }) {
  try {
    await ctx.client.from("ai_runs").insert({
      kind: ctx.kind,
      model: row.model ?? null,
      ok: row.ok,
      error: row.error ?? null,
      input_tokens: row.input_tokens ?? null,
      output_tokens: row.output_tokens ?? null,
      duration_ms: row.duration_ms,
      actor_id: ctx.actorId ?? null,
      meta: (ctx.meta ?? {}) as Json,
    });
  } catch {
    // o log nunca derruba a chamada
  }
}
