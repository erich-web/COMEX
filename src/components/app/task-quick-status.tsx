"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { setTaskStatus } from "@/actions/tasks";
import { Sheet } from "@/components/ui/sheet";
import { Textarea, Label } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { key: TaskStatus; hint: string; cls: string }[] = [
  { key: "not_started", hint: "Ainda não comecei.", cls: "border-line-2" },
  { key: "in_progress", hint: "Estou trabalhando nisso.", cls: "border-primary text-primary-ink" },
  { key: "waiting", hint: "Depende de alguém de fora.", cls: "border-amber text-amber" },
  { key: "blocked", hint: "Travou — preciso de decisão ou apoio.", cls: "border-alert text-alert" },
];

/** Troca de status em um toque, direto da lista (sem abrir a tarefa). */
export function TaskQuickStatus({ taskId, status, title }: { taskId: string; status: TaskStatus; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function set(s: TaskStatus) {
    start(async () => {
      const r = await setTaskStatus(taskId, s, note);
      if (r.ok) {
        toast(s === "done" ? "Compromisso concluído ✓" : `Status: ${TASK_STATUS_LABELS[s]}`, { description: title });
        setOpen(false);
        setNote("");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 shrink-0 items-center gap-1 rounded-[8px] border border-line px-2 text-[12px] font-semibold text-ink-2 hover:border-primary hover:text-primary" aria-label="Mudar status">
        Status <ChevronDown className="size-3.5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Atualizar status" description={title}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.map((o) => (
              <button key={o.key} type="button" disabled={pending} onClick={() => set(o.key)} className={cn("rounded-[12px] border-[1.5px] bg-surface p-3 text-left transition-colors hover:bg-surface-2", o.cls, status === o.key && "bg-primary-soft/60 ring-2 ring-primary/30")}>
                <div className="text-[14px] font-bold">{TASK_STATUS_LABELS[o.key]}</div>
                <div className="mt-0.5 text-[12px] text-mute">{o.hint}</div>
                {status === o.key ? <div className="mt-1 text-[11px] font-semibold text-primary">status atual</div> : null}
              </button>
            ))}
          </div>
          <div>
            <Label>Comentário (opcional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-h-[56px]" placeholder="O que mudou, o que falta, o que precisa…" />
          </div>
          <Button variant="green" size="lg" block loading={pending} onClick={() => set("done")}>
            <CheckCircle2 /> Marcar como concluída
          </Button>
          <p className="text-[11px] text-mute">Para anexar evidência da entrega, abra o compromisso e use “Concluir tarefa”.</p>
        </div>
      </Sheet>
    </>
  );
}
