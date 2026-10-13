import type { AgendaCategory, AgendaStatus, BlockKind, GrowthStatus, MeetingStatus, TaskPriority, TaskStatus, Urgency } from "./types";

export const APP_NAME = "RPE COMEX";
export const GOAL_LABEL = "RPE 2030 — R$ 200 MILHÕES";
export const TZ = "America/Sao_Paulo";

export const CATEGORY_LABELS: Record<AgendaCategory, string> = {
  marketing_sales: "Crescimento e vendas",
  strategic_decision: "Decisão estratégica",
  brainstorm: "Problema e solução",
  innovation: "Ideia / inovação",
  accountability: "Prestação de contas",
  knowledge: "Conhecimento",
  business_review: "Business Review",
  other: "Outros",
};

/** Temáticas oferecidas no envio de pautas (as demais ficam para uso administrativo). */
export const THEME_OPTIONS: AgendaCategory[] = ["marketing_sales", "strategic_decision", "brainstorm", "innovation", "accountability", "knowledge"];

/** Durações oferecidas no envio de pautas. */
export const DURATION_OPTIONS = [5, 10, 15, 20, 30] as const;

export const INSIGHT_KIND_LABELS: Record<string, string> = {
  recurring_problem: "Problema recorrente",
  growth_idea: "Ideia de crescimento",
  critical_question: "Pergunta crítica",
  suggestion: "Sugestão",
  pending_decision: "Decisão em aberto",
};

/** Bloco recomendado por categoria */
export const CATEGORY_BLOCK: Record<AgendaCategory, BlockKind> = {
  strategic_decision: "deliberation",
  accountability: "accountability",
  business_review: "business_review",
  brainstorm: "knowledge",
  knowledge: "knowledge",
  marketing_sales: "growth",
  innovation: "growth",
  other: "deliberation",
};

export const AGENDA_STATUS_LABELS: Record<AgendaStatus, string> = {
  received: "Recebida",
  in_review: "Em análise",
  returned: "Devolvida",
  approved: "Aprovada",
  scheduled: "Agendada",
  discussed: "Discutida",
  postponed: "Adiada",
  archived: "Arquivada",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  waiting: "Aguardando terceiros",
  blocked: "Bloqueada",
  done: "Concluída",
  cancelled: "Cancelada",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  preparing: "Em preparação",
  published: "Agenda publicada",
  in_progress: "Em andamento",
  closed: "Encerrada",
  cancelled: "Cancelada",
};

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  opening: "Abertura",
  accountability: "Accountability",
  business_review: "Business Review",
  deliberation: "Deliberações",
  knowledge: "Conhecimento",
  brainstorm: "Brainstorm",
  growth: "Growth",
  closing: "Encerramento",
  custom: "Personalizado",
};

export const GROWTH_STATUS_LABELS: Record<GrowthStatus, string> = {
  idea: "Ideia",
  evaluating: "Em avaliação",
  approved: "Aprovada",
  executing: "Em execução",
  done: "Concluída",
  scaled: "Escalada",
  discontinued: "Descontinuada",
};

export const GROWTH_KINDS = [
  "Campanha",
  "Ação promocional",
  "CRM / recorrência",
  "Cross-selling",
  "Evento",
  "Novo produto",
  "Parceria",
  "Inovação",
  "Referência de mercado",
  "Experiência do cliente",
];

export const OPEN_TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "waiting", "blocked"];
