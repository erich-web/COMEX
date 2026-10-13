"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertExperiment } from "@/actions/growth";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { GROWTH_STATUS_LABELS } from "@/lib/constants";
import type { GrowthStatus } from "@/lib/types";

type Values = {
  idea_id: string | null;
  title: string;
  hypothesis: string | null;
  objective: string | null;
  unit_id: string | null;
  owner_id: string | null;
  investment: number | null;
  deadline: string | null;
  expected_revenue: number | null;
  success_metrics: string | null;
  actual_result: string | null;
  actual_revenue: number | null;
  next_decision: string | null;
  status: GrowthStatus;
};

export function ExperimentForm({ id, initial, readOnly, units, profiles, ideas }: { id: string | null; initial: Values; readOnly: boolean; units: { id: string; name: string }[]; profiles: { id: string; name: string }[]; ideas: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({
    ...initial,
    idea_id: initial.idea_id ?? "",
    unit_id: initial.unit_id ?? "",
    owner_id: initial.owner_id ?? "",
    hypothesis: initial.hypothesis ?? "",
    objective: initial.objective ?? "",
    success_metrics: initial.success_metrics ?? "",
    actual_result: initial.actual_result ?? "",
    next_decision: initial.next_decision ?? "",
    deadline: initial.deadline ?? "",
    investment: initial.investment?.toString() ?? "",
    expected_revenue: initial.expected_revenue?.toString() ?? "",
    actual_revenue: initial.actual_revenue?.toString() ?? "",
  });
  const dis = readOnly;
  const area = (k: keyof typeof f, label: string, rows = 2) => (
    <div key={k}>
      <Label>{label}</Label>
      <Textarea value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={rows} disabled={dis} />
    </div>
  );
  return (
    <Card className="space-y-4">
      <div>
        <Label>Título *</Label>
        <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} disabled={dis} aria-invalid={!!errors.title} />
        <FieldError>{errors.title?.[0]}</FieldError>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Ideia de origem</Label>
          <Select value={f.idea_id} onChange={(e) => setF({ ...f, idea_id: e.target.value })} disabled={dis}>
            <option value="">—</option>
            {ideas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Unidade</Label>
          <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} disabled={dis}>
            <option value="">Grupo</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Responsável</Label>
          <Select value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })} disabled={dis}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as GrowthStatus })} disabled={dis}>
            {Object.entries(GROWTH_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Prazo</Label>
          <Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} disabled={dis} />
        </div>
        <div>
          <Label>Investimento previsto (R$)</Label>
          <Input inputMode="decimal" value={f.investment} onChange={(e) => setF({ ...f, investment: e.target.value })} disabled={dis} />
        </div>
        <div>
          <Label>Receita adicional esperada (R$)</Label>
          <Input inputMode="decimal" value={f.expected_revenue} onChange={(e) => setF({ ...f, expected_revenue: e.target.value })} disabled={dis} />
        </div>
      </div>
      {area("hypothesis", "Hipótese")}
      {area("objective", "Objetivo")}
      {area("success_metrics", "Indicadores de sucesso")}
      <div className="border-t border-line pt-4">
        <div className="section-label mb-3">Resultado</div>
        <div className="space-y-4">
          <div>
            <Label>Receita realizada (R$)</Label>
            <Input inputMode="decimal" value={f.actual_revenue} onChange={(e) => setF({ ...f, actual_revenue: e.target.value })} disabled={dis} />
          </div>
          {area("actual_result", "Resultado realizado", 3)}
          {area("next_decision", "Próxima decisão (escalar, ajustar, descontinuar)")}
        </div>
      </div>
      {!dis ? (
        <Button
          variant="green"
          size="lg"
          block
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await upsertExperiment(id, { ...f, idea_id: f.idea_id || null, unit_id: f.unit_id || null, owner_id: f.owner_id || null, deadline: f.deadline || null });
              if (r.ok) {
                toast(r.message ?? "Salvo");
                router.push("/growth");
              } else {
                setErrors(r.fieldErrors ?? {});
                toast.error(r.error);
              }
            })
          }
        >
          Salvar experimento
        </Button>
      ) : null}
    </Card>
  );
}
