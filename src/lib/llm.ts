import "server-only";

/**
 * Chamada mínima à API da Anthropic. Só funciona no servidor e exige ANTHROPIC_API_KEY.
 * Nunca envie a chave ao cliente. Modelo configurável por ANTHROPIC_MODEL.
 */
/** Lê a chave tolerando espaços e aspas coladas no painel da Vercel. */
function readKey(): string {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

export const hasLLM = () => readKey().length > 0;

/** Descrição segura da chave carregada (nunca expõe o segredo): prefixo e tamanho. */
export function describeKey(): string {
  const k = readKey();
  if (!k) return "nenhuma chave carregada";
  return `chave carregada começa com "${k.slice(0, 7)}", ${k.length} caracteres`;
}

export async function callModel(system: string, user: string, maxTokens = 2000): Promise<string> {
  const key = readKey();
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor (Vercel → Environment Variables) para habilitar o agente.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      const detail = await res.text().catch(() => "");
      const reason = /revoked|disabled/i.test(detail) ? "A chave foi revogada ou desativada no console da Anthropic." : "A API da Anthropic não reconheceu a chave.";
      throw new Error(`Chave da Anthropic inválida (401). ${reason} No servidor, ${describeKey()}. Gere uma chave nova em console.anthropic.com → API Keys, cole em ANTHROPIC_API_KEY na Vercel e faça Redeploy depois de salvar — a Vercel só usa o valor novo num deploy feito após a alteração.`);
    }
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
