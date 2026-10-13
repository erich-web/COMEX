"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtBRLShort } from "@/lib/format";

/** Tendência de receita semanal — realizado x orçado x ano anterior. Valores ausentes ficam como lacunas (nunca inventados). */
export function RevenueChart({ data }: { data: { week: string; realizado: number | null; orcado: number | null; anoAnterior: number | null }[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00b73d" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#00b73d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(15,15,15,0.08)" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#7c7b76" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#7c7b76" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => fmtBRLShort(v).replace("R$ ", "")} />
          <Tooltip
            contentStyle={{ borderRadius: 0, border: "1px solid #0f0f0f", fontSize: 12, background: "#fff" }}
            formatter={(v, name) => [v == null || v === "" ? "Não informado" : fmtBRLShort(Number(v)), name === "realizado" ? "Realizado" : name === "orcado" ? "Orçado" : "Ano anterior"]}
          />
          <Line type="monotone" dataKey="anoAnterior" stroke="#b9b7af" strokeDasharray="3 3" dot={false} connectNulls={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey="orcado" stroke="#0f0f0f" strokeDasharray="4 2" dot={false} connectNulls={false} strokeWidth={1.5} />
          <Area type="monotone" dataKey="realizado" stroke="#00b73d" fill="url(#rev)" strokeWidth={2.5} dot={{ r: 2.5, fill: "#00b73d" }} connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex gap-4 text-[10px] uppercase tracking-[0.1em] text-mute">
        <span className="flex items-center gap-1">
          <i className="inline-block h-0.5 w-4 bg-green" /> Realizado
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-0.5 w-4 border-t border-dashed border-black" /> Orçado
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-0.5 w-4 border-t border-dashed border-line-2" /> Ano anterior
        </span>
      </div>
    </div>
  );
}
