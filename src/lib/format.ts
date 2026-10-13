import { TZ } from "./constants";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlFull = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function fmtBRL(v: number | null | undefined, full = false) {
  if (v == null || Number.isNaN(v)) return "Não informado";
  return full ? brlFull.format(v) : brl.format(v);
}

/** R$ 1,2 mi / R$ 850 mil */
export function fmtBRLShort(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${num.format(v / 1_000_000)} mi`;
  if (abs >= 1_000) return `R$ ${num.format(v / 1_000)} mil`;
  return brl.format(v);
}

export function fmtNum(v: number | null | undefined, digits = 1) {
  if (v == null || Number.isNaN(v)) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(v);
}

export function fmtPct(v: number | null | undefined, digits = 1) {
  if (v == null || Number.isNaN(v)) return "Não informado";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(v)}%`;
}

export function fmtKpi(v: number | null | undefined, unit: "currency" | "percent" | "number" | "score") {
  if (v == null) return "Não informado";
  if (unit === "currency") return fmtBRL(v);
  if (unit === "percent") return fmtPct(v);
  return fmtNum(v, unit === "score" ? 1 : 0);
}

/** 'YYYY-MM-DD' → 'ter, 14 out' */
export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short" }) {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(iso + "T12:00:00-03:00") : new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts }).format(d);
}

export function fmtDateLong(iso: string | null | undefined) {
  return fmtDate(iso, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function plural(n: number, s: string, p: string) {
  return `${n} ${n === 1 ? s : p}`;
}
