"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGrowthIdea } from "@/actions/growth";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { GROWTH_KINDS } from "@/lib/constants";

export function IdeaForm({ units, goals, defaultUnit }: { units: { id: string; name: string }[]; goals: { id: string; name: string }[]; defaultUnit: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({ title: "", description: "", kind: "", unit_id: defaultUnit, strategic_goal_id: "" });
  return (
    <Card className="space-y-4">
      <div>
        <Label>Ideia *</Label>
        <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Sábado de feijoada com venda ativa na porta" aria-invalid={!!errors.title} autoFocus />
        <FieldError>{errors.title?.[0]}</FieldError>
      </div>
      <div>
        <Label>Como funciona e por que vende mais</Label>
        <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="">—</option>
            {GROWTH_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Unidade</Label>
          <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })}>
            <option value="">Grupo</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Objetivo estratégico</Label>
          <Select value={f.strategic_goal_id} onChange={(e) => setF({ ...f, strategic_goal_id: e.target.value })}>
            <option value="">—</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button
        variant="green"
        size="lg"
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await createGrowthIdea({ ...f, unit_id: f.unit_id || null, strategic_goal_id: f.strategic_goal_id || null, kind: f.kind || null });
            if (r.ok) {
              toast(r.message ?? "Registrada");
              router.push("/growth");
            } else {
              setErrors(r.fieldErrors ?? {});
              toast.error(r.error);
            }
          })
        }
      >
        Registrar ideia
      </Button>
    </Card>
  );
}
