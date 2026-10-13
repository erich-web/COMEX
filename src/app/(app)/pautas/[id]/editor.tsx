"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { updateMyAgendaItem, withdrawMyAgendaItem, addAgendaComment } from "@/actions/agenda";
import { Button } from "@/components/ui/button";
import { Card, Chip, FieldError, Input, Label, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { CATEGORY_LABELS, DURATION_OPTIONS, THEME_OPTIONS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import type { Tables, AgendaCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Item = Tables<"agenda_items">;

export function AgendaItemEditor({ item, units }: { item: Item; units: { id: string; name: string; slug: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: item.title,
    key_question: item.key_question ?? "",
    description: item.description,
    unit_id: item.unit_id ?? "",
    category: item.category as AgendaCategory,
    suggested_minutes: item.suggested_minutes ?? 10,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const themes = THEME_OPTIONS.includes(form.category) ? THEME_OPTIONS : [...THEME_OPTIONS, form.category];

  function save() {
    start(async () => {
      const r = await updateMyAgendaItem(item.id, {
        ...form,
        unit_id: form.unit_id || null,
        links: (item.links as { label?: string; url: string }[]) ?? [],
        requires_decision: form.category === "strategic_decision",
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
      <div className="text-[13px] font-semibold text-mute">Você ainda pode editar esta pauta</div>
      <div>
        <Label>Título</Label>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} />
        <FieldError>{errors.title?.[0]}</FieldError>
      </div>
      <div>
        <Label>Pergunta-chave</Label>
        <Textarea value={form.key_question} onChange={(e) => set("key_question", e.target.value)} rows={2} className="min-h-[64px]" aria-invalid={!!errors.key_question} />
        <FieldError>{errors.key_question?.[0]}</FieldError>
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Duração <span className="font-normal text-mute">(min)</span></div>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((m) => (
            <button key={m} type="button" aria-pressed={form.suggested_minutes === m} onClick={() => set("suggested_minutes", m)} className={cn("h-10 flex-1 rounded-[10px] border text-[14px] font-semibold", form.suggested_minutes === m ? "border-primary bg-primary text-white" : "border-line-2 bg-surface text-ink-2")}>
              {m === 30 ? "30+" : m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Temática</div>
        <div className="flex flex-wrap gap-2">
          {themes.map((c) => (
            <Chip key={c} active={form.category === c} onClick={() => set("category", c)}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Empresa</div>
        <div className="flex flex-wrap gap-2">
          {units.map((u) => (
            <Chip key={u.id} active={form.unit_id === u.id} onClick={() => set("unit_id", u.id)}>
              {u.slug === "grupo-holding" ? "Grupo" : u.name}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <Label>Contexto (opcional)</Label>
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
      </div>
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
      <div className="mb-2 text-[13px] font-semibold text-mute">Comentários e esclarecimentos</div>
      {comments.length ? (
        <ul className="mb-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="border-l-2 border-primary pl-3">
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
