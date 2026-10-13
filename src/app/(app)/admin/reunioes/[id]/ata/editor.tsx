"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gavel, Plus, Trash2, Sparkles } from "lucide-react";
import { createDecision, deleteDecision, saveMinutes } from "@/actions/meetings";
import { draftMinutesFromNotes } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { Badge, Card, Hint, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/format";

type D = { id: string; title: string; description: string | null; owner: string | null; due_date: string | null; task: { id: string; status: string } | null };

export function DecisionsPanel({ meetingId, decisions, items, profiles, units }: { meetingId: string; decisions: D[]; items: { id: string; title: string }[]; profiles: { id: string; name: string }[]; units: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ title: "", description: "", owner_id: "", unit_id: "", agenda_item_id: "", due_date: "", create_task: true });
  return (
    <Card className="space-y-3">
      <div className="section-label">Decisões e responsáveis</div>
      {decisions.length ? (
        <ul className="divide-y divide-line border border-line">
          {decisions.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-3 py-2.5">
              <Gavel className="mt-0.5 size-4 shrink-0 text-green-dark" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{d.title}</div>
                <div className="text-[11px] text-mute">
                  {d.owner ?? "sem responsável"}
                  {d.due_date ? ` · até ${fmtDate(d.due_date)}` : ""}
                </div>
              </div>
              {d.task ? (
                <Link href={`/tarefas/${d.task.id}`}>
                  <Badge variant={d.task.status === "done" ? "green" : "soft"}>{d.task.status === "done" ? "Executada" : "Tarefa"}</Badge>
                </Link>
              ) : (
                <Badge variant="outline">Sem tarefa</Badge>
              )}
              <button className="p-1 text-mute hover:text-alert" aria-label="Excluir decisão" onClick={() => start(async () => { const r = await deleteDecision(d.id, meetingId); r.ok ? router.refresh() : toast.error(r.error); })}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">Nenhuma decisão registrada.</p>
      )}
      <div className="border-t border-line pt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Label>Nova decisão</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="O que foi decidido" />
          </div>
          <div className="col-span-2">
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} placeholder="Detalhes (opcional)" />
          </div>
          <Select value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })} aria-label="Responsável">
            <option value="">Responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} aria-label="Prazo" />
          <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} aria-label="Unidade">
            <option value="">Unidade (Grupo)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select value={f.agenda_item_id} onChange={(e) => setF({ ...f, agenda_item_id: e.target.value })} aria-label="Pauta">
            <option value="">Pauta relacionada</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </Select>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[#2563eb]" checked={f.create_task} onChange={(e) => setF({ ...f, create_task: e.target.checked })} /> Gerar tarefa para o responsável
          </label>
        </div>
        <Button
          variant="green"
          size="sm"
          className="mt-2"
          loading={pending}
          disabled={f.title.trim().length < 3}
          onClick={() =>
            start(async () => {
              const r = await createDecision({ meeting_id: meetingId, ...f, owner_id: f.owner_id || null, unit_id: f.unit_id || null, agenda_item_id: f.agenda_item_id || null, due_date: f.due_date || null });
              if (r.ok) {
                toast(r.message ?? "Registrada");
                setF({ title: "", description: "", owner_id: "", unit_id: "", agenda_item_id: "", due_date: "", create_task: true });
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          <Plus /> Registrar decisão
        </Button>
      </div>
    </Card>
  );
}

export function MinutesEditor({ meetingId, initial }: { meetingId: string; initial: { title: string; summary: string; content: string; source_notes: string; drive_url: string; status: "draft" | "approved" } }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const [ai, startAi] = useTransition();

  function save(approve: boolean) {
    start(async () => {
      const r = await saveMinutes({ meeting_id: meetingId, ...f, approve });
      if (r.ok) {
        toast(r.message ?? "Salvo");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="section-label">Ata</div>
        <Badge variant={initial.status === "approved" ? "green" : "amber"}>{initial.status === "approved" ? "Aprovada" : "Rascunho"}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Título</Label>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Resumo executivo</Label>
          <Textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} rows={2} placeholder="Duas ou três frases com o essencial." />
        </div>
        <div className="sm:col-span-2">
          <Label>Link do documento (Drive)</Label>
          <Input value={f.drive_url} onChange={(e) => setF({ ...f, drive_url: e.target.value })} placeholder="https://drive.google.com/…" inputMode="url" />
        </div>
      </div>
      <details className="border border-line">
        <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold  text-ink-2">Anotações ou transcrição (geração assistida)</summary>
        <div className="space-y-2 px-3 pb-3">
          <Textarea value={f.source_notes} onChange={(e) => setF({ ...f, source_notes: e.target.value })} rows={6} placeholder="Cole aqui suas anotações ou a transcrição da reunião." />
          <Button
            variant="outline"
            size="sm"
            loading={ai}
            disabled={f.source_notes.trim().length < 40}
            onClick={() =>
              startAi(async () => {
                const r = await draftMinutesFromNotes(meetingId, f.source_notes);
                if (r.ok && r.data) {
                  setF({ ...f, content: r.data.content, summary: r.data.summary || f.summary });
                  toast("Rascunho sugerido", { description: "Revise antes de aprovar — a IA não inventa participantes, decisões ou prazos." });
                } else toast.error(r.ok ? "Sem resposta" : r.error);
              })
            }
          >
            <Sparkles /> Sugerir ata a partir das anotações
          </Button>
          <Hint>Requer ANTHROPIC_API_KEY configurada no servidor. O resultado é sempre um rascunho para revisão.</Hint>
        </div>
      </details>
      <div>
        <Label>Conteúdo da ata</Label>
        <Textarea value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} rows={18} className="font-mono text-[13px]" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" loading={pending} onClick={() => save(false)}>
          Salvar rascunho
        </Button>
        <Button variant="green" loading={pending} onClick={() => save(true)}>
          Aprovar e publicar ata
        </Button>
      </div>
    </Card>
  );
}
