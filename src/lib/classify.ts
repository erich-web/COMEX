import type { AgendaCategory } from "./types";

/**
 * Classificação heurística de pautas (sem IA): sugere categoria pelo texto.
 * A arquitetura permite trocar por um modelo de linguagem (ver src/lib/ai.ts) sem alterar o formulário.
 */
const RULES: { cat: AgendaCategory; words: string[] }[] = [
  { cat: "marketing_sales", words: ["venda", "vendas", "campanha", "marketing", "promo", "cliente", "crm", "ticket", "comercial", "delivery", "instagram", "tripadvisor", "google", "fidel", "parceria"] },
  { cat: "business_review", words: ["resultado", "fechamento", "orçamento", "orcamento", "cmv", "cmo", "margem", "receita", "faturamento", "indicador", "kpi", "desempenho", "performance", "prime cost"] },
  { cat: "innovation", words: ["novo negócio", "novo negocio", "inovação", "inovacao", "app", "aplicativo", "startup", "expansão", "expansao", "nova unidade", "projeto de", "sorvete", "catering", "franquia"] },
  { cat: "knowledge", words: ["treinamento", "capacitação", "capacitacao", "aprendizado", "palestra", "convidado", "benchmark", "livro", "curso", "workshop"] },
  { cat: "brainstorm", words: ["ideia", "ideias", "brainstorm", "como podemos", "alternativa", "solução", "solucao", "desafio"] },
  { cat: "accountability", words: ["prestação de contas", "prestacao de contas", "status", "andamento", "entrega", "pendência", "pendencia", "compromisso", "follow"] },
  { cat: "strategic_decision", words: ["aprovar", "aprovação", "aprovacao", "decisão", "decisao", "decidir", "definir", "investimento", "contrato", "fornecedor", "estratégia", "estrategia", "política", "politica", "deliberar"] },
];

export function suggestCategory(title: string, description: string): AgendaCategory | null {
  const text = `${title} ${description}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (text.trim().length < 6) return null;
  let best: { cat: AgendaCategory; score: number } | null = null;
  for (const r of RULES) {
    const score = r.words.reduce((acc, w) => acc + (text.includes(w.normalize("NFD").replace(/[̀-ͯ]/g, "")) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { cat: r.cat, score };
  }
  return best?.cat ?? null;
}
