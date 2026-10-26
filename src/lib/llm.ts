import "server-only";

/**
 * Chamada mínima à API da Anthropic. Só funciona no servidor e exige ANTHROPIC_API_KEY.
 * Nunca envie a chave ao cliente. Modelo configurável por ANTHROPIC_MODEL.
 *
 * Se o modelo configurado for recusado (404/400 "not found"), tenta os modelos da lista
 * FALLBACK_MODELS em ordem — assim uma aposentadoria de modelo não derruba o agente.
 */

/** Modelo padrão e alternativas, do mais capaz ao mais barato. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";
const FALLBACK_MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-sonnet-4-5"];

/** Lê a chave tolerando espaços e aspas coladas no painel da Vercel. */
function readKey(): string {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

export const hasLLM = () => readKey().length > 0;

export function configuredModel(): string {
  return (process.env.ANTHROPIC_MODEL ?? "").trim() || DEFAULT_MODEL;
}

/** Descrição segura da chave carregada (nunca expõe o segredo): prefixo e tamanho. */
export function describeKey(): string {
  const k = readKey();
  if (!k) return "nenhuma chave carregada";
  return `chave carregada começa com "${k.slice(0, 7)}", ${k.length} caracteres`;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export type CallResult = { text: string; model: string; inputTokens: number; outputTokens: number };

function modelRejected(status: number, detail: string) {
  return (status === 404 || status === 400) && /model|not_found|not found/i.test(detail);
}

async function request(model: string, system: string, content: string | ContentBlock[], maxTokens: number, key: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  return res;
}

/** Chamada completa: devolve texto + modelo usado + tokens. Aceita texto ou blocos (PDF/imagem). */
export async function callModelFull(system: string, user: string | ContentBlock[], maxTokens = 2000): Promise<CallResult> {
  const key = readKey();
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada. Defina a variável no servidor (Vercel → Environment Variables) para habilitar o agente.");
  const primary = configuredModel();
  const candidates = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  let lastError: Error | null = null;
  for (const model of candidates) {
    const res = await request(model, system, user, maxTokens, key);
    if (res.ok) {
      const data = (await res.json()) as { content: { type: string; text?: string }[]; model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
      return {
        text: data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"),
        model: data.model ?? model,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      };
    }
    const detail = await res.text().catch(() => "");
    if (res.status === 401) {
      const reason = /revoked|disabled/i.test(detail) ? "A chave foi revogada ou desativada no console da Anthropic." : "A API da Anthropic não reconheceu a chave.";
      throw new Error(`Chave da Anthropic inválida (401). ${reason} No servidor, ${describeKey()}. Gere uma chave nova em console.anthropic.com → API Keys, cole em ANTHROPIC_API_KEY na Vercel e faça Redeploy depois de salvar.`);
    }
    if (res.status === 429) throw new Error("Limite de uso da API da Anthropic atingido (429). Tente de novo em instantes ou verifique os créditos da conta.");
    if (res.status === 402 || /credit|billing/i.test(detail)) throw new Error("A conta da Anthropic está sem créditos (billing). Adicione créditos em console.anthropic.com → Plans & Billing.");
    if (modelRejected(res.status, detail)) {
      lastError = new Error(`Modelo "${model}" recusado pela API (${res.status}).`);
      continue; // tenta o próximo modelo
    }
    if (res.status === 400) throw new Error(`A API da Anthropic recusou a chamada (400): ${detail.slice(0, 300)}`);
    throw new Error(`IA indisponível (${res.status}). ${detail.slice(0, 200)}`);
  }
  throw lastError ?? new Error("Nenhum modelo disponível. Verifique ANTHROPIC_MODEL ou deixe-a em branco.");
}

export async function callModel(system: string, user: string | ContentBlock[], maxTokens = 2000): Promise<string> {
  return (await callModelFull(system, user, maxTokens)).text;
}

/** Extrai o primeiro JSON (objeto ou array) de uma resposta de texto. */
export function extractJSON<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const starts = [candidate.indexOf("["), candidate.indexOf("{")].filter((i) => i >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Chamada que espera JSON; devolve null se a resposta não for JSON válido. */
export async function callModelJSON<T>(system: string, user: string | ContentBlock[], maxTokens = 3000): Promise<{ json: T | null; raw: CallResult }> {
  const raw = await callModelFull(system, user, maxTokens);
  return { json: extractJSON<T>(raw.text), raw };
}
