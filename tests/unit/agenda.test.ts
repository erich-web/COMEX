import { describe, expect, it } from "vitest";
import { computeSchedule, similarity, suggestMinutes } from "@/lib/agenda";

const blocks = [
  { id: "b1", title: "Abertura", kind: "opening", duration_minutes: 5, sort_order: 1 },
  { id: "b2", title: "Deliberações", kind: "deliberation", duration_minutes: 35, sort_order: 2 },
  { id: "b3", title: "Encerramento", kind: "closing", duration_minutes: 15, sort_order: 3 },
];

describe("computeSchedule", () => {
  it("calcula horários a partir da duração de cada bloco (9h)", () => {
    const s = computeSchedule(9 * 60, 180, blocks, []);
    expect(s.blocks.map((b) => b.startClock)).toEqual(["09:00", "09:05", "09:40"]);
    expect(s.endClock).toBe("09:55");
    expect(s.overLimit).toBe(0);
  });
  it("soma 10+10+15 = 35 min no bloco e não acusa excesso", () => {
    const items = [
      { id: "i1", block_id: "b2", allotted_minutes: 10, sort_order: 1 },
      { id: "i2", block_id: "b2", allotted_minutes: 10, sort_order: 2 },
      { id: "i3", block_id: "b2", allotted_minutes: 15, sort_order: 3 },
    ];
    const s = computeSchedule(540, 180, blocks, items);
    expect(s.blocks[1].allottedTotal).toBe(35);
    expect(s.blocks[1].overBy).toBe(0);
  });
  it("acusa excesso de 10 min quando 45 min são atribuídos a 35 disponíveis", () => {
    const items = [
      { id: "i1", block_id: "b2", allotted_minutes: 30, sort_order: 1 },
      { id: "i2", block_id: "b2", allotted_minutes: 15, sort_order: 2 },
    ];
    const s = computeSchedule(540, 180, blocks, items);
    expect(s.blocks[1].overBy).toBe(10);
  });
  it("alerta quando os blocos ultrapassam as 12h", () => {
    const long = [...blocks, { id: "b4", title: "Extra", kind: "custom", duration_minutes: 130, sort_order: 4 }];
    const s = computeSchedule(540, 180, long, []);
    expect(s.overLimit).toBe(5);
    expect(s.endClock).toBe("12:05");
  });
  it("usa o tempo sugerido quando não há tempo atribuído", () => {
    const s = computeSchedule(540, 180, blocks, [{ id: "i", block_id: "b2", allotted_minutes: null, suggested_minutes: 20, sort_order: 1 }]);
    expect(s.blocks[1].allottedTotal).toBe(20);
  });
});

describe("suggestMinutes / similarity", () => {
  it("sugere mais tempo para decisões críticas", () => {
    expect(suggestMinutes({ category: "strategic_decision", urgency: "critical", requires_decision: true })).toBe(25);
    expect(suggestMinutes({ category: "accountability", urgency: "low" })).toBe(5);
    expect(suggestMinutes({ suggested_minutes: 200, category: "other", urgency: "low" })).toBe(60);
  });
  it("detecta títulos semelhantes", () => {
    expect(similarity("Estratégia comercial da Mercearia Amauri", "Estrategia comercial Mercearia Amauri 2026")).toBeGreaterThan(0.5);
    expect(similarity("Novo fornecedor de embalagens", "Aniversário de 3 anos")).toBe(0);
  });
});
