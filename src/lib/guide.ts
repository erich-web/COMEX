/** Orientação inicial do COMEX — usada no formulário de pautas, na página "Como funciona" e na mensagem de divulgação. */

export const GUIDE_RULES: { title: string; text: string }[] = [
  { title: "Uma pauta = uma pergunta.", text: "Toda pauta precisa dizer o que o COMEX deve responder (“Aprovamos X?”, “Seguimos com Y ou paramos?”). Pauta sem pergunta vira informe, e informe não precisa de reunião." },
  { title: "Diga quanto tempo precisa.", text: "5 min é um aviso; 10–15 é uma decisão; 20+ é um tema que merece material prévio. Quem pede 20+ anexa o PDF ou o contexto." },
  { title: "Problema vem com proposta.", text: "Pode não ser a solução final, mas é uma direção. Chegar só com o problema joga o trabalho para a mesa." },
  { title: "Pode mandar várias de uma vez.", text: "O app aceita o lote inteiro num envio. Não guarde pautas para a semana seguinte: se o assunto existe hoje, entra hoje." },
  { title: "Crescimento tem prioridade.", text: "Ideia de receita nova, cross-selling entre unidades, parceria, produto: entra na frente de tema operacional. Operação entra no COMEX quando precisa de decisão ou dinheiro." },
  { title: "Prestação de contas toda semana.", text: "Quem responde por unidade envia uma pauta fixa de 10 min com Vendas, Melhores e piores desempenhos, Problemas e Soluções — sempre nesses quatro blocos." },
  { title: "Revise seus compromissos antes da terça.", text: "A reunião abre com o acompanhamento do que foi assumido. Atualize o status (concluído, em andamento, bloqueado) no app até segunda, 18h." },
  { title: "Fora do prazo entra, mas como extraordinária.", text: "Prazo recomendado: sexta, 17h. Nada é bloqueado depois disso — só fica claro que chegou tarde." },
];

export const ACCOUNTABILITY_FIELDS: { key: "sales" | "people" | "problems" | "solutions"; label: string; placeholder: string; hint: string }[] = [
  { key: "sales", label: "Vendas", placeholder: "Ex.: R$ 182 mil na semana, 6% abaixo da meta e 4% acima do ano passado. Ticket médio R$ 128 (+3%), 1.420 clientes (−8%). Sábado forte, terça e quarta fracas.", hint: "Receita vs. meta e vs. mesma semana do ano anterior; ticket médio e clientes. Em uma linha: acima ou abaixo, e por quê." },
  { key: "people", label: "Melhores e piores desempenhos", placeholder: "Ex.: Melhores: Ana (ticket R$ 162, sugestão de vinho em 70% das mesas), turno do sábado. Piores: equipe do almoço de terça (ticket R$ 94), Carlos (3 reclamações).", hint: "2 que puxaram para cima e 2 que puxaram para baixo (pessoas, turnos ou produtos), com um número cada. Serve para agir rápido, não para expor." },
  { key: "problems", label: "Problemas", placeholder: "Ex.: 1) CMV em 34% (meta 31%) por perda de pescado. 2) Fila na entrada no sábado à noite. 3) Falta de sommelier nas terças.", hint: "Até 3, em ordem de impacto na receita." },
  { key: "solutions", label: "Soluções e o que precisamos do COMEX", placeholder: "Ex.: 1) Nova ficha técnica e compra 3x/semana — Luiz, até 20/10. 2) Reserva com hora marcada no sábado — Ana, até 24/10. Precisamos do COMEX: aprovar R$ 8 mil para treinamento de vinhos.", hint: "O que já está sendo feito para cada problema, com responsável e data. Se precisa de decisão, verba ou apoio, peça aqui." },
];

/** Monta o texto da pauta de prestação de contas no formato padrão. */
export function composeAccountability(v: Record<string, string>) {
  return ACCOUNTABILITY_FIELDS.map((f) => `${f.label.toUpperCase()}\n${(v[f.key] ?? "").trim() || "Não informado"}`).join("\n\n");
}
