"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { saveKpiEntries } from "@/actions/performance";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { addDays } from "@/lib/dates";
import { fmtKpi } from "@/lib/format";
import Link from "next/link";

type Kpi = { id: string; key: string; name: string; unit_type: "currency" | "percent" | "number" | "score"; has_budget: boolean; has_prior_year: boolean; category: string };
type Entry = { kpi_id: string; value: number | null; budget_value: number | null; prior_year_value: number | null; note?: string | null };

const CAT: Record<string, string> = { commercial: "Comercial", operational: "Operacional e financeiro", experience: "Experiência", events: "Eventos" };

export function KpiForm({ unitId, slug, weekStart, kpis, current, previous }: { unitId: string; slug: string; weekStart: string; kpis: Kpi[]; current: Entry[]; previous: { kpi_id: string; value: number | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, { value: string; budget_value: string; prior_year_value: string }>>(() => {
    const o: Record<string, { value: string; budget_value: string; prior_year_value: string }> = {};
    kpis.forEach((k) => {
      const c = current.find((e) => e.kpi_id === k.id);
      o[k.id] = { value: c?.value?.toString() ?? "", budget_value: c?.budget_value?.toString() ?? "", prior_year_value: c?.prior_year_value?.toString() ?? "" };
    });
    return o;
  });
  const groups = useMemo(() => {
    const g = new Map<string, Kpi[]>();
    kpis.forEach((k) => g.set(k.category, [...(g.get(k.category) ?? []), k]));
    return [...g.entries()];
  }, [kpis]);

  const filledCount = Object.values(values).filter((v) => v.value !== "").length;

  function save() {
    start(async () => {
      const r = await saveKpiEntries({
        unit_id: unitId,
        period: "week",
        period_start: weekStart,
        entries: kpis.map((k) => ({ kpi_id: k.id, value: values[k.id].value, budget_value: values[k.id].budget_value, prior_year_value: values[k.id].prior_year_value })),
      });
      if (r.ok) {
        toast(r.message ?? "Salvo");
        router.push(`/unidades/${slug}`);
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border border-line bg-surface px-2 py-1.5">
        <Link href={`?semana=${addDays(weekStart, -7)}`} className="flex size-9 items-center justify-center hover:bg-black/5" aria-label="Semana anterior">
          <ChevronLeft className="size-5" />
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Semana {weekStart.split("-").reverse().slice(0, 2).join("/")}</span>
        <Link href={`?semana=${addDays(weekStart, 7)}`} className="flex size-9 items-center justify-center hover:bg-black/5" aria-label="Próxima semana">
          <ChevronRight className="size-5" />
        </Link>
      </div>

      {groups.map(([cat, list]) => (
        <section key={cat}>
          <div className="section-label mb-2">{CAT[cat] ?? cat}</div>
          <div className="space-y-2">
            {list.map((k) => {
              const prev = previous.find((p) => p.kpi_id === k.id)?.value;
              const v = values[k.id];
              const unitHint = k.unit_type === "currency" ? "R$" : k.unit_type === "percent" ? "%" : "";
              return (
                <div key={k.id} className="border border-line bg-surface p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label className="mb-0">{k.name}</Label>
                    <span className="text-[10px] text-mute">semana anterior: {prev != null ? fmtKpi(prev, k.unit_type) : "—"}</span>
                  </div>
                  <div className={`mt-2 grid gap-2 ${k.has_budget && k.has_prior_year ? "grid-cols-3" : k.has_budget || k.has_prior_year ? "grid-cols-2" : "grid-cols-1"}`}>
                    <NumInput label={`Realizado ${unitHint}`} value={v.value} onChange={(x) => setValues({ ...values, [k.id]: { ...v, value: x } })} primary />
                    {k.has_budget ? <NumInput label={`Orçado ${unitHint}`} value={v.budget_value} onChange={(x) => setValues({ ...values, [k.id]: { ...v, budget_value: x } })} /> : null}
                    {k.has_prior_year ? <NumInput label={`Ano ant. ${unitHint}`} value={v.prior_year_value} onChange={(x) => setValues({ ...values, [k.id]: { ...v, prior_year_value: x } })} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky z-30 bg-bg pb-3 pt-2" style={{ bottom: "calc(var(--nav-h) + var(--safe-b))" }}>
        <Button variant="green" size="lg" block loading={pending} onClick={save} disabled={filledCount === 0}>
          Salvar {filledCount ? `${filledCount} indicador${filledCount > 1 ? "es" : ""}` : "indicadores"}
        </Button>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, primary }: { label: string; value: string; onChange: (v: string) => void; primary?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-mute">{label}</div>
      <Input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))} placeholder="—" className={primary ? "border-black font-semibold" : ""} />
    </div>
  );
}
