"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtBRLShort } from "@/lib/format";

type Row = { year: string; realizado: number | null; orcado: number | null; meta: number | null; conservador: number | null; base: number | null; otimista: number | null };

export function StrategyChart({ data, goal }: { data: Row[]; goal: number }) {
  const labels: Record<string, string> = { realizado: "Realizado", orcado: "Orçado", meta: "Meta", conservador: "Conservador", base: "Base", otimista: "Otimista" };
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(15,15,15,0.08)" />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#7c7b76" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#7c7b76" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => fmtBRLShort(v).replace("R$ ", "")} />
          <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #0f0f0f", fontSize: 12 }} formatter={(v, n) => [v == null || v === "" ? "Não informado" : fmtBRLShort(Number(v)), labels[String(n)] ?? String(n)]} />
          <ReferenceLine y={goal} stroke="#00b73d" strokeDasharray="4 4" label={{ value: "Meta 2030", position: "insideTopRight", fontSize: 10, fill: "#009932" }} />
          <Bar dataKey="realizado" fill="#0f0f0f" barSize={18} />
          <Bar dataKey="orcado" fill="rgba(15,15,15,0.25)" barSize={18} />
          <Line type="monotone" dataKey="conservador" stroke="#b9b7af" dot={false} strokeWidth={1.5} connectNulls />
          <Line type="monotone" dataKey="base" stroke="#00b73d" dot={false} strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="otimista" stroke="#009932" strokeDasharray="3 3" dot={false} strokeWidth={1.5} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
