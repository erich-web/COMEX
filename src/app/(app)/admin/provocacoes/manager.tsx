"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { deletePrompt, upsertPrompt } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, Input, Label, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type P = { id: string; text: string; author: string | null; is_active: boolean };

export function PromptsManager({ prompts }: { prompts: P[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="section-label">Nova provocação</div>
        <div>
          <Label>Pergunta ou frase</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Que problema estamos aceitando como normal e deveríamos resolver?" />
        </div>
        <div className="flex gap-2">
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Autor (opcional)" />
          <Button
            variant="green"
            loading={pending}
            disabled={text.trim().length < 8}
            onClick={() =>
              start(async () => {
                const r = await upsertPrompt(null, text, author);
                if (r.ok) {
                  setText("");
                  setAuthor("");
                  toast(r.message ?? "Salva");
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            <Plus /> Adicionar
          </Button>
        </div>
      </Card>
      <div className="divide-y divide-surface-2 overflow-hidden rounded-[14px] border border-line bg-surface">
        {prompts.map((p) => (
          <div key={p.id} className={cn("flex items-start gap-3 px-3 py-2.5", !p.is_active && "opacity-50")}>
            <p className="min-w-0 flex-1  text-sm italic">
              “{p.text}”{p.author ? <span className="ml-1 font-sans text-[11px] not-italic text-mute">— {p.author}</span> : null}
            </p>
            <button className="text-[10px] font-bold  text-ink-2" onClick={() => start(async () => { const r = await upsertPrompt(p.id, p.text, p.author, !p.is_active); r.ok ? router.refresh() : toast.error(r.error); })}>
              {p.is_active ? "Desativar" : "Ativar"}
            </button>
            <button className="p-1 text-mute hover:text-alert" aria-label="Excluir" onClick={() => start(async () => { const r = await deletePrompt(p.id); r.ok ? router.refresh() : toast.error(r.error); })}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
