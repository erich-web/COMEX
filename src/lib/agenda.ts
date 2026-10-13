import { minutesToClock } from "./dates";

export type BlockInput = { id: string; title: string; kind: string; duration_minutes: number; sort_order: number };
export type ItemInput = { id: string; block_id: string | null; allotted_minutes: number | null; suggested_minutes?: number | null; sort_order: number };

export type ScheduledBlock = BlockInput & {
  startMin: number;
  endMin: number;
  startClock: string;
  endClock: string;
  allottedTotal: number;
  overBy: number; // minutos acima da duração do bloco (0 se cabe)
  itemIds: string[];
};

export type Schedule = {
  blocks: ScheduledBlock[];
  totalMinutes: number;
  endMin: number;
  endClock: string;
  overLimit: number; // minutos além da duração da reunião
  unassigned: string[];
};

/**
 * Calcula horários de cada bloco a partir da hora de início e das durações,
 * soma o tempo atribuído às pautas e sinaliza excessos.
 */
export function computeSchedule(startMin: number, meetingDuration: number, blocks: BlockInput[], items: ItemInput[]): Schedule {
  const ordered = [...blocks].sort((a, b) => a.sort_order - b.sort_order);
  let cursor = startMin;
  const out: ScheduledBlock[] = ordered.map((b) => {
    const bi = items.filter((i) => i.block_id === b.id).sort((x, y) => x.sort_order - y.sort_order);
    const allotted = bi.reduce((acc, i) => acc + (i.allotted_minutes ?? i.suggested_minutes ?? 0), 0);
    const sb: ScheduledBlock = {
      ...b,
      startMin: cursor,
      endMin: cursor + b.duration_minutes,
      startClock: minutesToClock(cursor),
      endClock: minutesToClock(cursor + b.duration_minutes),
      allottedTotal: allotted,
      overBy: Math.max(0, allotted - b.duration_minutes),
      itemIds: bi.map((i) => i.id),
    };
    cursor += b.duration_minutes;
    return sb;
  });
  const total = ordered.reduce((a, b) => a + b.duration_minutes, 0);
  return {
    blocks: out,
    totalMinutes: total,
    endMin: startMin + total,
    endClock: minutesToClock(startMin + total),
    overLimit: Math.max(0, total - meetingDuration),
    unassigned: items.filter((i) => !i.block_id || !ordered.some((b) => b.id === i.block_id)).map((i) => i.id),
  };
}

/** Sugere minutos de discussão a partir de urgência, categoria e sugestão do autor */
export function suggestMinutes(input: { suggested_minutes?: number | null; category: string; urgency: string; requires_decision?: boolean }) {
  if (input.suggested_minutes) return Math.min(60, Math.max(5, input.suggested_minutes));
  const base: Record<string, number> = { strategic_decision: 15, business_review: 20, brainstorm: 20, knowledge: 20, accountability: 5, marketing_sales: 10, innovation: 10, other: 10 };
  let m = base[input.category] ?? 10;
  if (input.urgency === "critical") m += 5;
  if (input.requires_decision) m += 5;
  return m;
}

/** Semelhança simples (Jaccard de tokens) para detectar duplicidades */
export function similarity(a: string, b: string) {
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3),
    );
  const A = tok(a), B = tok(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}
