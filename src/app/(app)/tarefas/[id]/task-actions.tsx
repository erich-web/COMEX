"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send, Pencil, Paperclip } from "lucide-react";
import { addTaskComment, completeTaskWithEvidence, setTaskStatus, updateTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Card, Input, Label, Select, Textarea, Hint } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { STATUS_ICON } from "@/components/app/task-item";
import { cn } from "@/lib/utils";

const QUICK: TaskStatus[] = ["not_started", "in_progress", "waiting", "blocked"];

export function TaskActions({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function set(s: TaskStatus) {
    start(async () => {
      const r = await setTaskStatus(taskId, s);
      if (r.ok) {
        toast(r.message ?? "Atualizado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function complete() {
    setUploading(true);
    try {
      let path: string | undefined;
      if (file) {
        if (file.size > 15 * 1024 * 1024) {
          toast.error("Arquivo acima de 15 MB.");
          return;
        }
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const key = `${user!.id}/tasks/${taskId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from("comex").upload(key, file, { upsert: false });
        if (error) {
          toast.error("Falha ao anexar evidência", error.message);
          return;
        }
        path = key;
      }
      const r = await completeTaskWithEvidence(taskId, { note, evidence_url: url, evidence_path: path });
      if (r.ok) {
        toast(r.message ?? "Concluída");
        setDone(false);
        router.refresh();
      } else toast.error(r.error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="t-label">Atualizar status</div>
      <div className="grid grid-cols-2 gap-2">
        {QUICK.map((s) => {
          const Icon = STATUS_ICON[s];
          const active = status === s;
          return (
            <button key={s} disabled={pending} onClick={() => !active && set(s)} className={cn("flex h-11 items-center gap-2 border px-3 text-[12px] font-bold", active ? "border-primary bg-primary text-white" : "border-line bg-surface hover:border-primary")}>
              <Icon className={cn("size-4", s === "blocked" && !active && "text-alert")} /> {TASK_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
      <Button variant="green" size="lg" block onClick={() => setDone(true)}>
        <CheckCircle2 /> Concluir tarefa
      </Button>
      <Sheet open={done} onOpenChange={setDone} title="Concluir tarefa" description="Registre o que foi entregue. Evidência é opcional, mas ajuda no accountability.">
        <div className="space-y-4">
          <div>
            <Label>O que foi feito</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Resultado, números, próximos passos…" />
          </div>
          <div>
            <Label>Link de evidência</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          </div>
          <div>
            <Label>Anexo (foto, PDF, planilha)</Label>
            <label className="flex h-11 cursor-pointer items-center gap-2 border border-dashed border-line-2 px-3 text-sm text-ink-2">
              <Paperclip className="size-4" /> {file ? file.name : "Escolher arquivo"}
              <input type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls,.csv,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Hint>Até 15 MB. Fica no armazenamento privado do COMEX.</Hint>
          </div>
          <Button variant="green" size="lg" block loading={uploading} onClick={complete}>
            Confirmar conclusão
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

export function TaskComments({ taskId, comments }: { taskId: string; comments: { id: string; body: string; created_at: string; author: string }[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  function send() {
    if (!text.trim()) return;
    start(async () => {
      const r = await addTaskComment(taskId, text);
      if (r.ok) {
        setText("");
        router.refresh();
      } else toast.error(r.error);
    });
  }
  return (
    <Card>
      <div className="t-label mb-2">Comentários</div>
      {comments.length ? (
        <ul className="mb-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="border-l-2 border-line-2 pl-3">
              <p className="text-sm">{c.body}</p>
              <p className="mt-0.5 text-[11px] text-mute">
                {c.author} · {fmtDateTime(c.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-mute">Sem comentários.</p>
      )}
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Atualização rápida…" onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} />
        <Button variant="primary" size="icon" aria-label="Enviar" loading={pending} onClick={send}>
          <Send />
        </Button>
      </div>
    </Card>
  );
}

export function TaskEditSheet({
  task,
  profiles,
  units,
}: {
  task: { id: string; title: string; description: string | null; owner_id: string | null; unit_id: string | null; due_date: string | null; priority: TaskPriority; assignees: string[] };
  profiles: { id: string; name: string }[];
  units: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...task, description: task.description ?? "", owner_id: task.owner_id ?? "", unit_id: task.unit_id ?? "", due_date: task.due_date ?? "" });
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Editar
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Editar tarefa">
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável</Label>
              <Select value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })}>
                <option value="">—</option>
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
                <option value="">—</option>
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
              <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TaskPriority })}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Colaboradores</Label>
            <div className="flex flex-wrap gap-1.5">
              {profiles.map((p) => {
                const on = f.assignees.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => setF({ ...f, assignees: on ? f.assignees.filter((x) => x !== p.id) : [...f.assignees, p.id] })} className={cn("border px-2.5 py-1.5 text-[12px] font-bold", on ? "border-primary bg-primary text-white" : "border-line")}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            block
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await updateTask(task.id, { ...f, owner_id: f.owner_id || null, unit_id: f.unit_id || null, due_date: f.due_date || null });
                if (r.ok) {
                  toast(r.message ?? "Salvo");
                  setOpen(false);
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            Salvar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
