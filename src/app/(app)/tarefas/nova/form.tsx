"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

export function NewTaskForm({ me, profiles, units, defaultUnit }: { me: string; profiles: { id: string; name: string }[]; units: { id: string; name: string }[]; defaultUnit: string }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", description: "", owner_id: me, unit_id: defaultUnit, due_date: "", priority: "medium" as "low" | "medium" | "high" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <Card className="space-y-4">
      <div>
        <Label>O que precisa ser feito *</Label>
        <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Apresentar proposta de rateio no COMEX" aria-invalid={!!errors.title} autoFocus />
        <FieldError>{errors.title?.[0]}</FieldError>
      </div>
      <div>
        <Label>Detalhes</Label>
        <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Responsável</Label>
          <Select value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
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
        <div>
          <Label>Prazo</Label>
          <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
        <div>
          <Label>Prioridade</Label>
          <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as typeof f.priority })}>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
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
            const r = await createTask({ ...f, unit_id: f.unit_id || null, due_date: f.due_date || null, owner_id: f.owner_id || null });
            if (r.ok) {
              toast("Tarefa criada");
              router.push(`/tarefas/${r.data!.id}`);
            } else {
              setErrors(r.fieldErrors ?? {});
              toast.error(r.error);
            }
          })
        }
      >
        Criar tarefa
      </Button>
    </Card>
  );
}
