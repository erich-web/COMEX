"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { updateMyAgendaItem, withdrawMyAgendaItem, addAgendaComment } from "@/actions/agenda";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import type { Tables } from "@/lib/types";

type Item = Tables<"agenda_items">;

export function AgendaItemEditor({ item, units, goals }: { item: Item; units: { id: string; name: string }[]; goals: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: item.title,
    description: item.description,
    unit_id: item.unit_id ?? "",
    expected_outcome: item.expected_outcome ?? "",
    category: item.category,
    problem: item.problem ?? "",
    proposed_solution: item.proposed_solution ?? "",
    expected_impact: item.expected_impact ?? "",
    urgency: item.urgency,
    suggested_minutes: item.suggested_minutes ?? ("" as number | ""),
    people_involved: item.people_involved ?? "",
    strategic_goal_id: item.strategic_goal_id ?? "",
    requires_decision: item.requires_decision,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    start(async () => {
      const r = await updateMyAgendaItem(item.id, {
        ...form,
        unit_id: form.unit_id || null,
        strategic_goal_id: form.strategic_goal_id || null,
        suggested_minutes: form.suggested_minutes === "" ? null : Number(form.suggested_minutes),
        links: (item.links as { label?: string; url: string }[]) ?? [],
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast(r.message ?? "Salvo");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <div className="t-label">Você ainda pode editar esta pauta</div>
      <div>
        <Label>Título</Label>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} />
        <FieldError>{errors.title?.[0]}</FieldError>
      </div>
      <div>
        <Label>Contexto</Label>
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} aria-invalid={!!errors.description} />
        <FieldError>{errors.description?.[0]}</FieldError>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Unidade</Label>
          <Select value={form.unit_id} onChange={(e) => set("unit_id", e.target.value)}>
            <option value="">Grupo / transversal</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Urgência</Label>
          <Select value={form.urgency} onChange={(e) => set("urgency", e.target.value)}>
            {Object.entries(URGENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Tempo sugerido (min)</Label>
          <Input type="number" inputMode="numeric" value={form.suggested_minutes} onChange={(e) => set("suggested_minutes", e.target.value ? Number(e.target.value) : "")} />
        </div>
      </div>
      <div>
        <Label>Resultado esperado</Label>
        <Input value={form.expected_outcome} onChange={(e) => set("expected_outcome", e.target.value)} />
      </div>
      <div>
        <Label>Problema identificado</Label>
        <Textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={2} />
      </div>
      <div>
        <Label>Solução proposta</Label>
        <Textarea value={form.proposed_solution} onChange={(e) => set("proposed_solution", e.target.value)} rows={2} />
      </div>
      <div>
        <Label>Impacto esperado</Label>
        <Input value={form.expected_impact} onChange={(e) => set("expected_impact", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Objetivo estratégico</Label>
          <Select value={form.strategic_goal_id} onChange={(e) => set("strategic_goal_id", e.target.value)}>
            <option value="">—</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Pessoas envolvidas</Label>
          <Input value={form.people_involved} onChange={(e) => set("people_involved", e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="size-4 accent-[#00b73d]" checked={form.requires_decision} onChange={(e) => set("requires_decision", e.target.checked)} /> Exige decisão do COMEX
      </label>
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="ghost" size="sm" className="text-alert" onClick={() => setConfirm(true)}>
          Retirar pauta
        </Button>
        <Button variant="primary" loading={pending} onClick={save}>
          Salvar alterações
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Retirar pauta?"
        description="Ela sai da fila de organização do COMEX. Você pode enviá-la de novo depois."
        confirmLabel="Retirar"
        danger
        onConfirm={async () => {
          const r = await withdrawMyAgendaItem(item.id);
          if (r.ok) {
            toast(r.message ?? "Pauta retirada");
            router.push("/pautas");
          } else toast.error(r.error);
        }}
      />
    </Card>
  );
}

export function AgendaComments({ itemId, comments }: { itemId: string; comments: { id: string; body: string; created_at: string; author: string }[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card>
      <div className="t-label mb-2">Comentários e esclarecimentos</div>
      {comments.length ? (
        <ul className="mb-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="border-l-2 border-green pl-3">
              <p className="text-sm">{c.body}</p>
              <p className="mt-0.5 text-[11px] text-mute">
                {c.author} · {fmtDateTime(c.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-mute">Nenhum comentário ainda.</p>
      )}
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva um comentário…" onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} />
        <Button variant="primary" size="icon" aria-label="Enviar" loading={pending} onClick={send}>
          <Send />
        </Button>
      </div>
    </Card>
  );
  function send() {
    if (!text.trim()) return;
    start(async () => {
      const r = await addAgendaComment(itemId, text);
      if (r.ok) {
        setText("");
        router.refresh();
      } else toast.error(r.error);
    });
  }
}
