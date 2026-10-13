import "server-only";

/**
 * Chamada mínima à API da Anthropic. Só funciona no servidor e exige ANTHROPIC_API_KEY.
 * Nunca envie a chave ao cliente. Modelo configurável por ANTHROPIC_MODEL.
 */
export const hasLLM = () => !!process.env.ANTHROPIC_API_KEY;

export async function callModel(system: string, user: string, maxTokens = 2000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor (Vercel → Environment Variables) para habilitar o agente.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Chave da Anthropic inválida (401). Confira ANTHROPIC_API_KEY na Vercel — deve começar com sk-ant-, sem espaços ou aspas — e faça um redeploy.");
    if (res.status === 429) throw new Error("Limite de uso da API da Anthropic atingido (429). Tente de novo em instantes ou verifique os créditos da conta.");
    if (res.status === 404 || res.status === 400) throw new Error(`A API da Anthropic recusou a chamada (${res.status}). Verifique ANTHROPIC_MODEL ou deixe-a em branco.`);
    throw new Error(`IA indisponível (${res.status}).`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
}

/** Extrai o primeiro JSON (objeto ou array) de uma resposta de texto. */
export function extractJSON<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = Math.min(...[candidate.indexOf("["), candidate.indexOf("{")].filter((i) => i >= 0));
  if (!Number.isFinite(start)) return null;
  const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
