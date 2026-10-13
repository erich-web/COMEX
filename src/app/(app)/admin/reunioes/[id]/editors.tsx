"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2, AlertTriangle } from "lucide-react";
import { rescheduleMeeting, saveMeetingBlocks, setMeetingStatus, setParticipants, updateMeeting } from "@/actions/meetings";
import { Button } from "@/components/ui/button";
import { Card, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { BLOCK_KIND_LABELS } from "@/lib/constants";
import { minutesToClock } from "@/lib/dates";
import type { BlockKind, MeetingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type M = { id: string; title: string; series_date: string; time: string; duration_minutes: number; status: MeetingStatus; prompt_id: string | null; review_unit_ids: string[]; notes: string };

export function MeetingSettings({ meeting, prompts, units, profiles, participants }: { meeting: M; prompts: { id: string; text: string }[]; units: { id: string; name: string }[]; profiles: { id: string; name: string }[]; participants: string[] }) {
  const router = useRouter();
  const [f, setF] = useState({ ...meeting, prompt_id: meeting.prompt_id ?? "" });
  const [parts, setParts] = useState(participants);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "cancel" | "close">(null);
  const dateChanged = f.series_date !== meeting.series_date || f.time !== meeting.time;

  function save() {
    start(async () => {
      if (dateChanged) {
        const r = await rescheduleMeeting(meeting.id, f.series_date, f.time);
        if (!r.ok) return toast.error(r.error);
      }
      const r = await updateMeeting(meeting.id, { title: f.title, duration_minutes: f.duration_minutes, prompt_id: f.prompt_id || null, review_unit_ids: f.review_unit_ids, notes: f.notes });
      if (!r.ok) return toast.error(r.error);
      const p = await setParticipants(meeting.id, parts);
      if (!p.ok) return toast.error(p.error);
      toast("Reunião salva");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <div className="section-label">Reunião</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Título</Label>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div>
          <Label>Data (reagendar esta ocorrência)</Label>
          <Input type="date" value={f.series_date} onChange={(e) => setF({ ...f, series_date: e.target.value })} />
        </div>
        <div>
          <Label>Horário</Label>
          <Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </div>
        <div>
          <Label>Duração (min)</Label>
          <Input type="number" inputMode="numeric" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Provocação da semana</Label>
          <Select value={f.prompt_id} onChange={(e) => setF({ ...f, prompt_id: e.target.value })}>
            <option value="">Rodízio automático</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.text}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Business Review em profundidade (até 2 unidades)</Label>
          <div className="flex flex-wrap gap-1.5">
            {units.map((u) => {
              const on = f.review_unit_ids.includes(u.id);
              return (
                <button key={u.id} type="button" onClick={() => setF({ ...f, review_unit_ids: on ? f.review_unit_ids.filter((x) => x !== u.id) : f.review_unit_ids.length < 4 ? [...f.review_unit_ids, u.id] : f.review_unit_ids })} className={cn("border px-2.5 py-1.5 text-[12px] font-bold", on ? "border-primary bg-primary text-white" : "border-line")}>
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <Label>Participantes</Label>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map((p) => {
              const on = parts.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => setParts(on ? parts.filter((x) => x !== p.id) : [...parts, p.id])} className={cn("border px-2.5 py-1.5 text-[12px] font-bold", on ? "border-primary bg-primary text-white" : "border-line")}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <Label>Orientações / materiais preparatórios</Label>
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} placeholder="Links de documentos, leituras prévias, convidado…" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" loading={pending} onClick={save}>
          Salvar reunião
        </Button>
        {meeting.status === "preparing" ? (
          <Button variant="green" onClick={() => start(async () => { const r = await setMeetingStatus(meeting.id, "published"); r.ok ? (toast(r.message ?? "Publicada"), router.refresh()) : toast.error(r.error); })}>
            Publicar agenda
          </Button>
        ) : null}
        {meeting.status === "published" ? (
          <Button variant="outline" onClick={() => start(async () => { const r = await setMeetingStatus(meeting.id, "preparing"); r.ok ? router.refresh() : toast.error(r.error); })}>
            Voltar para preparação
          </Button>
        ) : null}
        {meeting.status !== "closed" ? (
          <Button variant="outline" onClick={() => setConfirm("close")}>
            Encerrar reunião
          </Button>
        ) : null}
        {meeting.status !== "cancelled" && meeting.status !== "closed" ? (
          <Button variant="ghost" className="text-alert" onClick={() => setConfirm("cancel")}>
            Cancelar ocorrência
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "cancel" ? "Cancelar esta reunião?" : "Encerrar reunião?"}
        description={confirm === "cancel" ? "A recorrência semanal continua; só esta ocorrência é cancelada. Pautas agendadas voltam para 'aprovadas'." : "As pautas agendadas serão marcadas como discutidas. Você ainda pode editar a ata depois."}
        confirmLabel={confirm === "cancel" ? "Cancelar reunião" : "Encerrar"}
        danger={confirm === "cancel"}
        onConfirm={async () => {
          const r = await setMeetingStatus(meeting.id, confirm === "cancel" ? "cancelled" : "closed");
          if (r.ok) {
            toast("Atualizado");
            router.refresh();
          } else toast.error(r.error);
        }}
      />
    </Card>
  );
}

type B = { id?: string; kind: BlockKind; title: string; duration_minutes: number; sort_order: number; notes: string };

export function BlocksEditor({ meetingId, startClock, duration, initial }: { meetingId: string; startClock: string; duration: number; initial: B[] }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<B[]>(initial);
  const [pending, start] = useTransition();
  const startMin = useMemo(() => {
    const [h, m] = startClock.split(":").map(Number);
    return h * 60 + m;
  }, [startClock]);
  const total = blocks.reduce((a, b) => a + (Number(b.duration_minutes) || 0), 0);
  const over = total - duration;
  const starts = blocks.reduce<number[]>((acc, b, i) => [...acc, i === 0 ? startMin : acc[i - 1] + (Number(blocks[i - 1].duration_minutes) || 0)], []);

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const c = [...blocks];
    [c[i], c[j]] = [c[j], c[i]];
    setBlocks(c.map((b, k) => ({ ...b, sort_order: k + 1 })));
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="section-label">Blocos da agenda</div>
        <div className={cn("text-xs font-bold tabular", over > 0 ? "text-alert" : "text-ink-2")}>
          {total}/{duration} min · termina {minutesToClock(startMin + total)}
        </div>
      </div>
      {over > 0 ? (
        <div className="flex items-center gap-2 border border-alert/40 bg-alert/10 px-3 py-2 text-xs font-semibold text-alert">
          <AlertTriangle className="size-4" /> Os blocos ultrapassam a duração da reunião em {over} min.
        </div>
      ) : null}
      <div className="space-y-2">
        {blocks.map((b, i) => {
          const start = starts[i];
          return (
            <div key={b.id ?? i} className="grid grid-cols-[52px_1fr_auto] items-center gap-2 border border-line p-2">
              <div className="t-display text-base tabular text-mute">{minutesToClock(start)}</div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input value={b.title} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className="h-10" />
                <Input type="number" inputMode="numeric" value={b.duration_minutes} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, duration_minutes: Number(e.target.value) } : x)))} className="h-10 w-20" aria-label="Minutos" />
                <Select value={b.kind} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, kind: e.target.value as BlockKind } : x)))} className="col-span-2 h-9 text-xs">
                  {Object.entries(BLOCK_KIND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-0.5">
                <button className="p-1 text-mute hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">
                  <ArrowUp className="size-4" />
                </button>
                <button className="p-1 text-mute hover:text-ink disabled:opacity-30" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label="Descer">
                  <ArrowDown className="size-4" />
                </button>
                <button className="p-1 text-mute hover:text-alert" onClick={() => setBlocks(blocks.filter((_, k) => k !== i))} aria-label="Remover">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setBlocks([...blocks, { kind: "custom", title: "Novo bloco", duration_minutes: 15, sort_order: blocks.length + 1, notes: "" }])}>
          <Plus /> Bloco
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBlocks(blocks.map((b) => (b.kind === "knowledge" ? { ...b, kind: "brainstorm", title: b.title.replace(/Conhecimento.*/i, "Brainstorm estratégico") } : b.kind === "brainstorm" ? { ...b, kind: "knowledge", title: "Conhecimento, brainstorm ou convidado" } : b)))}>
          Alternar conhecimento ↔ brainstorm
        </Button>
        <span className="flex-1" />
        <Button
          variant="primary"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveMeetingBlocks(meetingId, blocks.map((b, i) => ({ ...b, sort_order: i + 1 })));
              if (r.ok) {
                toast(r.message ?? "Salvo");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          Salvar blocos
        </Button>
      </div>
    </Card>
  );
}
