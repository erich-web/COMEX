/** Cálculos do módulo RPE 2030 — puros e testáveis. */

export type YearRow = { year: number; revenue_target: number | null; revenue_budget: number | null; revenue_actual: number | null; scenario_conservative: number | null; scenario_base: number | null; scenario_optimistic: number | null; expansion_contribution: number | null };

export function cagr(start: number, end: number, years: number) {
  if (start <= 0 || end <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

/** Projeção a partir do último realizado, com um CAGR dado. */
export function project(base: number, rate: number, years: number) {
  return base * Math.pow(1 + rate, years);
}

export function analyze(rows: YearRow[], goalYear: number, goal: number, currentYear: number) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const withActual = sorted.filter((r) => r.revenue_actual != null && r.revenue_actual > 0);
  const last = withActual.at(-1) ?? null;
  const first = withActual[0] ?? null;
  const yearsLeft = last ? goalYear - last.year : goalYear - currentYear;
  const realizedCagr = first && last && last.year > first.year ? cagr(first.revenue_actual!, last.revenue_actual!, last.year - first.year) : null;
  const requiredCagr = last ? cagr(last.revenue_actual!, goal, yearsLeft) : null;
  const projected2030 = last && realizedCagr != null ? project(last.revenue_actual!, realizedCagr, yearsLeft) : null;
  const gap = last ? goal - last.revenue_actual! : goal;
  const prev = last ? sorted.find((r) => r.year === last.year - 1) : null;
  const yoy = last && prev?.revenue_actual ? (last.revenue_actual! - prev.revenue_actual) / prev.revenue_actual : null;
  const progress = last ? Math.min(100, (last.revenue_actual! / goal) * 100) : 0;
  return { last, yearsLeft, realizedCagr, requiredCagr, projected2030, gap, yoy, progress };
}
