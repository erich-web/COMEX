"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { upsertAnnualTarget, upsertStrategicGoal } from "@/actions/admin";
import { saveUnitAnnualRevenue } from "@/actions/performance";
import { Button } from "@/components/ui/button";
import { Card, Hint, Input, Label, Select } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

type Row = { year: number; revenue_target: number | null; revenue_budget: number | null; revenue_actual: number | null; scenario_conservative: number | null; scenario_base: number | null; scenario_optimistic: number | null; expansion_contribution: number | null; note: string | null };
const FIELDS: [keyof Row, string][] = [
  ["revenue_target", "Meta"],
  ["revenue_budget", "Orçado"],
  ["revenue_actual", "Realizado"],
  ["scenario_conservative", "Conservador"],
  ["scenario_base", "Base"],
  ["scenario_optimistic", "Otimista"],
  ["expansion_contribution", "Expansão"],
];

export function TargetsEditor({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [data, setData] = useState<Record<number, Record<string, string>>>(() => Object.fromEntries(rows.map((r) => [r.year, Object.fromEntries(FIELDS.map(([k]) => [k, r[k] == null ? "" : String(r[k])]))])));
  const [pending, start] = useTransition();
  return (
    <Card className="space-y-3">
      <div className="section-label">Metas anuais (R$)</div>
      <Hint className="mt-0">Valores em reais. Deixe em branco o que não souber. Cenários = receita total projetada; “Expansão” = parcela vinda de novos negócios (não somar de novo).</Hint>
      <div className="scroll-x -mx-4 px-4">
        <table className="min-w-[760px] text-xs">
          <thead>
            <tr className="t-label text-left">
              <th className="py-1 pr-2">Ano</th>
              {FIELDS.map(([k, l]) => (
                <th key={k} className="px-1 py-1">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <td className="t-display py-1 pr-2 text-base">{r.year}</td>
                {FIELDS.map(([k]) => (
                  <td key={k} className="px-1 py-1">
                    <Input inputMode="decimal" className="h-9 w-[100px] text-xs" value={data[r.year][k]} onChange={(e) => setData({ ...data, [r.year]: { ...data[r.year], [k]: e.target.value.replace(/[^\d.,-]/g, "") } })} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="primary"
        loading={pending}
        onClick={() =>
          start(async () => {
            for (const r of rows) {
              const d = data[r.year];
              const res = await upsertAnnualTarget({ year: r.year, revenue_target: d.revenue_target, revenue_budget: d.revenue_budget, revenue_actual: d.revenue_actual, scenario_conservative: d.scenario_conservative, scenario_base: d.scenario_base, scenario_optimistic: d.scenario_optimistic, expansion_contribution: d.expansion_contribution });
              if (!res.ok) return toast.error(`${r.year}: ${res.error}`);
            }
            toast("Metas salvas");
            router.refresh();
          })
        }
      >
        Salvar metas
      </Button>
    </Card>
  );
}

export function UnitRevenueEditor({ units, rows, years }: { units: { id: string; name: string }[]; rows: { unit_id: string; year: number; revenue_actual: number | null; revenue_budget: number | null }[]; years: number[] }) {
  const router = useRouter();
  const [year, setYear] = useState(years[1] ?? years[0]);
  const [vals, setVals] = useState<Record<string, { a: string; b: string }>>({});
  const [pending, start] = useTransition();
  const get = (uid: string) => vals[`${uid}-${year}`] ?? { a: rows.find((r) => r.unit_id === uid && r.year === year)?.revenue_actual?.toString() ?? "", b: rows.find((r) => r.unit_id === uid && r.year === year)?.revenue_budget?.toString() ?? "" };
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="section-label">Receita anual por unidade</div>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 w-28 text-xs">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        {units.map((u) => {
          const v = get(u.id);
          return (
            <div key={u.id} className="grid grid-cols-[1fr_120px_120px] items-center gap-2">
              <span className="text-sm font-medium">{u.name}</span>
              <div>
                <Label className="mb-0.5">Realizado</Label>
                <Input inputMode="decimal" className="h-9 text-xs" value={v.a} onChange={(e) => setVals({ ...vals, [`${u.id}-${year}`]: { ...v, a: e.target.value } })} />
              </div>
              <div>
                <Label className="mb-0.5">Orçado</Label>
                <Input inputMode="decimal" className="h-9 text-xs" value={v.b} onChange={(e) => setVals({ ...vals, [`${u.id}-${year}`]: { ...v, b: e.target.value } })} />
              </div>
            </div>
          );
        })}
      </div>
      <Button
        variant="primary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));
            for (const u of units) {
              const key = `${u.id}-${year}`;
              if (!vals[key]) continue;
              const r = await saveUnitAnnualRevenue(u.id, year, num(vals[key].a), num(vals[key].b));
              if (!r.ok) return toast.error(r.error);
            }
            toast("Receitas salvas");
            router.refresh();
          })
        }
      >
        Salvar {year}
      </Button>
    </Card>
  );
}

export function GoalsEditor({ goals }: { goals: { id: string; name: string; description: string | null }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card className="space-y-3">
      <div className="section-label">Objetivos estratégicos</div>
      <ul className="divide-y divide-line border border-line">
        {goals.map((g) => (
          <li key={g.id} className="px-3 py-2 text-sm">
            <span className="font-medium">{g.name}</span>
            {g.description ? <span className="text-mute"> — {g.description}</span> : null}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo objetivo" />
        <Button
          variant="outline"
          loading={pending}
          disabled={name.trim().length < 3}
          onClick={() =>
            start(async () => {
              const r = await upsertStrategicGoal(null, name);
              if (r.ok) {
                setName("");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          <Plus /> Adicionar
        </Button>
      </div>
    </Card>
  );
}
