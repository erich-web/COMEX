import { describe, expect, it } from "vitest";
import { weekStart, addDays, isOverdue, minutesToClock, clockMinutesSP, isoWeek } from "@/lib/dates";
import { analyze, cagr } from "@/lib/strategy";
import { suggestCategory } from "@/lib/classify";

describe("dates", () => {
  it("weekStart retorna segunda-feira", () => {
    expect(weekStart("2026-10-13")).toBe("2026-10-12"); // terça → segunda
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // domingo
  });
  it("addDays e atraso", () => {
    expect(addDays("2026-10-13", 7)).toBe("2026-10-20");
    expect(isOverdue("2026-10-12", "in_progress", "2026-10-13")).toBe(true);
    expect(isOverdue("2026-10-12", "done", "2026-10-13")).toBe(false);
    expect(isOverdue(null, "in_progress", "2026-10-13")).toBe(false);
  });
  it("relógio em São Paulo (terça 9h = 12:00Z)", () => {
    expect(minutesToClock(540)).toBe("09:00");
    expect(clockMinutesSP("2026-10-13T12:00:00Z")).toBe(540);
  });
  it("semana ISO estável", () => {
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2026-10-13")).toBe(42);
  });
});

describe("estratégia RPE 2030", () => {
  const rows = [
    { year: 2024, revenue_target: null, revenue_budget: null, revenue_actual: 50_000_000, scenario_conservative: null, scenario_base: null, scenario_optimistic: null, expansion_contribution: null },
    { year: 2025, revenue_target: null, revenue_budget: null, revenue_actual: 60_000_000, scenario_conservative: null, scenario_base: null, scenario_optimistic: null, expansion_contribution: null },
  ];
  it("calcula CAGR realizado, necessário e gap", () => {
    const a = analyze(rows, 2030, 200_000_000, 2026);
    expect(a.last?.year).toBe(2025);
    expect(a.realizedCagr).toBeCloseTo(0.2, 5);
    expect(a.requiredCagr).toBeCloseTo(cagr(60_000_000, 200_000_000, 5)!, 10);
    expect(a.gap).toBe(140_000_000);
    expect(a.yoy).toBeCloseTo(0.2, 5);
    expect(a.progress).toBe(30);
  });
  it("não inventa dados quando não há realizado", () => {
    const a = analyze([], 2030, 200_000_000, 2026);
    expect(a.last).toBeNull();
    expect(a.realizedCagr).toBeNull();
    expect(a.projected2030).toBeNull();
    expect(a.gap).toBe(200_000_000);
  });
});

describe("classificação heurística", () => {
  it("sugere categorias plausíveis", () => {
    expect(suggestCategory("Campanha de vendas do delivery", "")).toBe("marketing_sales");
    expect(suggestCategory("Aprovar investimento em fornecedor", "decisão sobre contrato")).toBe("strategic_decision");
    expect(suggestCategory("", "")).toBeNull();
  });
});
