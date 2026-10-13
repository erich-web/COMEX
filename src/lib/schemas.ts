import { z } from "zod";
import { optionalText, optionalUuid } from "@/actions/_helpers";

export const agendaItemSchema = z.object({
  title: z.string().trim().min(3, "Dê um título com pelo menos 3 caracteres.").max(200, "Máximo de 200 caracteres."),
  key_question: z.string().trim().min(8, "Escreva a pergunta que o COMEX precisa responder.").max(600, "Máximo de 600 caracteres."),
  description: z.string().trim().max(4000).optional().default(""),
  unit_id: optionalUuid,
  expected_outcome: optionalText(1000),
  category: z.enum(["strategic_decision", "accountability", "business_review", "brainstorm", "knowledge", "marketing_sales", "innovation", "other"]).default("other"),
  problem: optionalText(2000),
  proposed_solution: optionalText(2000),
  expected_impact: optionalText(1000),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  suggested_minutes: z.coerce.number().int().min(1).max(180).optional().nullable(),
  people_involved: optionalText(300),
  links: z.array(z.object({ label: z.string().trim().max(120).optional().default(""), url: z.string().trim().url("Link inválido") })).max(10).default([]),
  strategic_goal_id: optionalUuid,
  requires_decision: z.boolean().default(false),
});

export type AgendaItemInput = z.input<typeof agendaItemSchema>;
export type AgendaItemValues = z.output<typeof agendaItemSchema>;

