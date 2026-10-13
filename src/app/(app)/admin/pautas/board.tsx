"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, Gavel, MessageSquare, Sparkles, Send, Copy, X, Paperclip } from "lucide-react";
import { organizeAgendaItem } from "@/actions/agenda";
import { suggestAgendaForMeeting } from "@/actions/agent";
import { setMeetingStatus } from "@/actions/meetings";
import { computeSchedule, suggestMinutes, type BlockInput } from "@/lib/agenda";
import { clockMinutesSP } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { AGENDA_STATUS_LABELS, CATEGORY_LABELS, CATEGORY_BLOCK, URGENCY_LABELS } from "@/lib/constants";
import type { AgendaCategory, AgendaStatus, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BoardItem = {
  id: string;
  title: string;
  description: string;
  key_question: string | null;
  category: AgendaCategory;
  urgency: Urgency;
  status: AgendaStatus;
  unit: string | null;
  unit_id: string | null;
  author: string;
  author_id: string;
  presenter_id: string | null;
  requires_decision: boolean;
  suggested_minutes: number | null;
  allotted_minutes: number | null;
  block_id: string | null;
  meeting_id: string | null;
  sort_order: number;
  priority: number;
  admin_notes: string | null;
  return_reason: string | null;
  expected_outcome: string | null;
  problem: string | null;
  proposed_solution: string | null;
  created_at: string;
  comments: number;
  attachments: { id: string; name: string }[];
  duplicates: string[];
};

type Meeting = { id: string; series_date: string; status: string; startClock: string; duration: number };
const COLUMNS: { key: string; label: string; statuses: AgendaStatus[] }[] = [
  { key: "inbox", label: "Recebidas — arraste para a agenda", statuses: ["received", "in_review", "approved"] },
  { key: "returned", label: "Devolvidas", statuses: ["returned"] },
  { key: "postponed", label: "Adiadas", statuses: ["postponed"] },
];

export function OrganizeBoard({ meeting, blocks, items: initial, profiles, units }: { meeting: Meeting; blocks: BlockInput[]; items: BoardItem[]; profiles: { id: string; name: string }[]; units: { id: string; name: string }[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<BoardItem | null>(null);
  const [filter, setFilter] = useState({ author: "", unit: "", category: "" });
  const [pending, start] = useTransition();
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const startMin = useMemo(() => {
    const [h, m] = meeting.startClock.split(":").map(Number);
    return h * 60 + m;
  }, [meeting.startClock]);
  const scheduled = items.filter((i) => i.meeting_id === meeting.id && i.block_id);
  const schedule = computeSchedule(startMin, meeting.duration, blocks, scheduled.map((i) => ({ id: i.id, block_id: i.block_id, allotted_minutes: i.allotted_minutes, suggested_minutes: i.suggested_minutes, sort_order: i.sort_order })));
  const overBlocks = schedule.blocks.filter((b) => b.overBy > 0);

  const visible = (list: BoardItem[]) => list.filter((i) => (!filter.author || i.author_id === filter.author) && (!filter.unit || i.unit_id === filter.unit) && (!filter.category || i.category === filter.category));

  function patchLocal(id: string, p: Partial<BoardItem>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
    setOpen((o) => (o && o.id === id ? { ...o, ...p } : o));
  }

  async function apply(id: string, p: Parameters<typeof organizeAgendaItem>[1], local: Partial<BoardItem>) {
    patchLocal(id, local);
    const r = await organizeAgendaItem(id, p);
    if (!r.ok) {
      toast.error(r.error);
      router.refresh();
    }
  }

  function assignToBlock(item: BoardItem, blockId: string | null) {
    const minutes = item.allotted_minutes ?? suggestMinutes(item);
    const order = blockId ? Math.max(0, ...items.filter((i) => i.block_id === blockId).map((i) => i.sort_order)) + 10 : 0;
    start(() =>
      apply(
        item.id,
        { block_id: blockId, meeting_id: blockId ? meeting.id : null, allotted_minutes: blockId ? minutes : item.allotted_minutes, sort_order: order, status: blockId ? "scheduled" : "approved" },
        { block_id: blockId, meeting_id: blockId ? meeting.id : null, allotted_minutes: blockId ? minutes : item.allotted_minutes, sort_order: order, status: blockId ? "scheduled" : "approved" },
      ),
    );
  }

  function move(item: BoardItem, dir: -1 | 1) {
    const siblings = items.filter((i) => i.block_id === item.block_id && i.meeting_id === meeting.id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((i) => i.id === item.id);
    const other = siblings[idx + dir];
    if (!other) return;
    start(async () => {
      patchLocal(item.id, { sort_order: other.sort_order });
      patchLocal(other.id, { sort_order: item.sort_order });
      await organizeAgendaItem(item.id, { sort_order: other.sort_order });
      await organizeAgendaItem(other.id, { sort_order: item.sort_order });
    });
  }

  const kindLabel = (k: string) => (k === "deliberation" ? "Deliberações" : k === "growth" ? "Growth" : k === "knowledge" ? "Conhecimento" : k === "business_review" ? "Business Review" : k === "accountability" ? "Accountability" : k);

  return (
    <div className="space-y-4">
      {/* Barra de controle do tempo */}
      <div className={cn("rounded-[14px] border p-3", schedule.overLimit > 0 || overBlocks.length ? "border-alert bg-alert-soft" : "border-line bg-surface")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="text-xl font-bold tabular">{meeting.startClock}–{schedule.endClock}</span>
            <span className="ml-2 text-xs text-mute">{schedule.totalMinutes} min em blocos · {scheduled.length} pautas agendadas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await suggestAgendaForMeeting(meeting.id);
                  if (r.ok) {
                    toast(r.message ?? "Agenda sugerida", { description: r.data?.note });
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <Sparkles /> Sugestão do agente
            </Button>
            {meeting.status === "preparing" ? (
              <Button variant="green" size="sm" onClick={() => setConfirmPublish(true)}>
                <Send /> Publicar agenda
              </Button>
            ) : (
              <Button asChild variant="primary" size="sm">
                <Link href={`/apresentar/${meeting.id}`}>Modo reunião</Link>
              </Button>
            )}
          </div>
        </div>
        {(schedule.overLimit > 0 || overBlocks.length > 0) && (
          <div className="mt-2 flex items-start gap-2 text-xs font-semibold text-alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              {schedule.overLimit > 0 ? <div>Agenda ultrapassa o limite da reunião em {schedule.overLimit} min — ajuste os blocos em “Blocos, participantes e ata”.</div> : null}
              {overBlocks.map((b) => (
                <div key={b.id}>
                  {b.title}: {b.allottedTotal} min atribuídos para {b.duration_minutes} min disponíveis (+{b.overBy}).
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-2">
        <Select value={filter.author} onChange={(e) => setFilter({ ...filter, author: e.target.value })} aria-label="Responsável">
          <option value="">Todos</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={filter.unit} onChange={(e) => setFilter({ ...filter, unit: e.target.value })} aria-label="Unidade">
          <option value="">Unidades</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })} aria-label="Categoria">
          <option value="">Categorias</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Colunas de triagem */}
        <div className="space-y-4">
          {COLUMNS.map((c) => {
            const list = visible(items.filter((i) => c.statuses.includes(i.status) && !i.block_id));
            return (
              <section key={c.key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="section-label">{c.label}</div>
                  <span className="t-display text-base text-mute">{list.length}</span>
                </div>
                {list.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-line-2 px-3 py-3 text-xs text-mute">Vazio</div>
                ) : (
                  <div className="space-y-1.5">
                    {list.map((it) => (
                      <ItemCard key={it.id} item={it} onOpen={() => setOpen(it)} draggable onDragStart={() => setDragId(it.id)} onDragEnd={() => setDragId(null)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Agenda por bloco */}
        <div className="space-y-2">
          <div className="section-label">Agenda de {meeting.series_date.split("-").reverse().slice(0, 2).join("/")}</div>
          {schedule.blocks.map((b) => {
            const list = visible(items.filter((i) => i.block_id === b.id && i.meeting_id === meeting.id)).sort((x, y) => x.sort_order - y.sort_order);
            return (
              <div
                key={b.id}
                className={cn("overflow-hidden rounded-[14px] border bg-surface transition-colors", b.overBy > 0 ? "border-alert" : dragId ? "border-dashed border-primary" : "border-line")}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const it = items.find((i) => i.id === dragId);
                  if (it) assignToBlock(it, b.id);
                  setDragId(null);
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-line bg-bg px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      <span className="tabular text-mute">{b.startClock}</span> {b.title}
                    </div>
                    <div className="text-[10px]  text-mute">{kindLabel(b.kind)}</div>
                  </div>
                  <div className={cn("shrink-0 text-xs font-bold tabular", b.overBy > 0 ? "text-alert" : "text-ink-2")}>
                    {b.allottedTotal}/{b.duration_minutes} min
                  </div>
                </div>
                <div className="space-y-1.5 p-2">
                  {list.length === 0 ? <div className="px-1 py-2 text-xs text-mute">Arraste pautas para cá ou abra a pauta e escolha o bloco.</div> : null}
                  {list.map((it, idx) => (
                    <ItemCard key={it.id} item={it} compact onOpen={() => setOpen(it)} draggable onDragStart={() => setDragId(it.id)} onDragEnd={() => setDragId(null)}>
                      <div className="flex items-center gap-0.5">
                        <button className="p-1 text-mute hover:text-ink disabled:opacity-30" disabled={idx === 0} onClick={(e) => (e.stopPropagation(), move(it, -1))} aria-label="Subir">
                          <ArrowUp className="size-4" />
                        </button>
                        <button className="p-1 text-mute hover:text-ink disabled:opacity-30" disabled={idx === list.length - 1} onClick={(e) => (e.stopPropagation(), move(it, 1))} aria-label="Descer">
                          <ArrowDown className="size-4" />
                        </button>
                        <button className="p-1 text-mute hover:text-alert" onClick={(e) => (e.stopPropagation(), assignToBlock(it, null))} aria-label="Remover do bloco">
                          <X className="size-4" />
                        </button>
                      </div>
                    </ItemCard>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalhe / organização */}
      {open ? <ItemSheet item={open} blocks={schedule.blocks} profiles={profiles} onClose={() => setOpen(null)} onApply={(p, local) => start(() => apply(open.id, p, local))} onBlock={(bid) => assignToBlock(open, bid)} /> : null}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publicar agenda?"
        description={`Os executivos passam a ver pautas, ordem, horários e apresentadores da reunião de ${meeting.series_date.split("-").reverse().join("/")}. Você ainda pode ajustar depois.${schedule.overLimit > 0 ? " Atenção: a agenda ultrapassa o horário de encerramento." : ""}`}
        confirmLabel="Publicar"
        onConfirm={async () => {
          const r = await setMeetingStatus(meeting.id, "published");
          if (r.ok) {
            toast(r.message ?? "Publicada");
            router.refresh();
          } else toast.error(r.error);
        }}
      />
    </div>
  );
}

function ItemCard({ item, compact, onOpen, children, ...drag }: { item: BoardItem; compact?: boolean; onOpen: () => void; children?: React.ReactNode; draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  return (
    <div {...drag} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()} className={cn("cursor-pointer rounded-[10px] border border-line bg-surface px-2.5 py-2 transition-colors hover:border-primary", item.status === "returned" && "border-l-[3px] border-l-alert", item.priority >= 2 && "border-l-[3px] border-l-primary")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug">
            {item.requires_decision ? <Gavel className="mr-1 inline size-3.5 text-green-dark" /> : null}
            {item.title}
          </div>
          {!compact && item.key_question ? <div className="mt-0.5 line-clamp-2 text-[12px] text-ink-2">{item.key_question}</div> : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-mute">
            <span>{item.author}</span>
            {item.unit ? <span>· {item.unit}</span> : null}
            <span>· {CATEGORY_LABELS[item.category]}</span>
            {item.urgency === "critical" || item.urgency === "high" ? <Badge variant="alertSoft">{URGENCY_LABELS[item.urgency]}</Badge> : null}
            {item.comments ? (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="size-3" /> {item.comments}
              </span>
            ) : null}
            {item.attachments.length ? (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="size-3" /> {item.attachments.length}
              </span>
            ) : null}
            {item.duplicates.length ? (
              <span className="inline-flex items-center gap-0.5 text-amber" title={item.duplicates.join("\n")}>
                <Copy className="size-3" /> possível duplicidade
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] font-bold tabular text-ink-2">{item.allotted_minutes ?? item.suggested_minutes ?? suggestMinutes(item)}′</span>
          {!compact ? <Badge variant="soft">{AGENDA_STATUS_LABELS[item.status]}</Badge> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

function ItemSheet({ item, blocks, profiles, onClose, onApply, onBlock }: { item: BoardItem; blocks: { id: string; title: string; kind: string; startClock: string }[]; profiles: { id: string; name: string }[]; onClose: () => void; onApply: (p: Parameters<typeof organizeAgendaItem>[1], local: Partial<BoardItem>) => void; onBlock: (b: string | null) => void }) {
  const [minutes, setMinutes] = useState<string>(String(item.allotted_minutes ?? item.suggested_minutes ?? suggestMinutes(item)));
  const [notes, setNotes] = useState(item.admin_notes ?? "");
  const [reason, setReason] = useState(item.return_reason ?? "");
  const [showReturn, setShowReturn] = useState(false);
  const recommended = CATEGORY_BLOCK[item.category];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={item.title} description={`${item.author}${item.unit ? ` · ${item.unit}` : ""} · ${AGENDA_STATUS_LABELS[item.status]}`}>
      <div className="space-y-4">
        {item.key_question ? <Row label="Pergunta-chave" v={item.key_question} /> : null}
        {item.description ? <Row label="Contexto" v={item.description} /> : null}
        {item.attachments.length ? (
          <div>
            <div className="text-[12px] font-semibold text-mute">Anexos</div>
            <ul className="mt-1 space-y-1">
              {item.attachments.map((a) => (
                <li key={a.id}>
                  <a href={`/anexos/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline">
                    <Paperclip className="size-3.5" /> {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {item.expected_outcome ? <Row label="Resultado esperado" v={item.expected_outcome} /> : null}
        {item.problem ? <Row label="Problema" v={item.problem} /> : null}
        {item.proposed_solution ? <Row label="Solução proposta" v={item.proposed_solution} /> : null}
        {item.duplicates.length ? (
          <div className="rounded-[10px] border border-amber/40 bg-amber-soft p-2 text-xs">
            <div className="font-bold text-amber">Semelhante a</div>
            <ul className="mt-1 list-disc pl-4">
              {item.duplicates.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Link href={`/pautas/${item.id}`} className="inline-block text-[12px] font-semibold text-primary underline">
          Abrir pauta completa
        </Link>

        <div className="border-t border-line pt-4">
          <div className="section-label mb-2">Organização</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={item.category} onChange={(e) => onApply({ category: e.target.value as AgendaCategory }, { category: e.target.value as AgendaCategory })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={String(item.priority)} onChange={(e) => onApply({ priority: Number(e.target.value) }, { priority: Number(e.target.value) })}>
                <option value="0">Normal</option>
                <option value="1">Importante</option>
                <option value="2">Alta</option>
                <option value="3">Crítica</option>
              </Select>
            </div>
            <div>
              <Label>Tempo (min)</Label>
              <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} onBlur={() => Number(minutes) > 0 && onApply({ allotted_minutes: Number(minutes) }, { allotted_minutes: Number(minutes) })} />
            </div>
            <div>
              <Label>Apresentador</Label>
              <Select value={item.presenter_id ?? ""} onChange={(e) => onApply({ presenter_id: e.target.value || null }, { presenter_id: e.target.value || null })}>
                <option value="">Autor ({item.author})</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Bloco na reunião</Label>
              <Select value={item.block_id ?? ""} onChange={(e) => onBlock(e.target.value || null)}>
                <option value="">— fora da agenda —</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.startClock} {b.title}
                    {b.kind === recommended ? " (recomendado)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[#2563eb]" checked={item.requires_decision} onChange={(e) => onApply({ requires_decision: e.target.checked }, { requires_decision: e.target.checked })} /> Exige decisão
            </label>
          </div>
          <div className="mt-3">
            <Label>Notas internas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (item.admin_notes ?? "") && onApply({ admin_notes: notes }, { admin_notes: notes })} rows={2} />
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="section-label mb-2">Status</div>
          <div className="grid grid-cols-2 gap-2">
            {item.status !== "approved" && item.status !== "scheduled" ? (
              <Button variant="green" size="sm" onClick={() => onApply({ status: "approved" }, { status: "approved" })}>
                Aprovar
              </Button>
            ) : null}
            {item.status === "received" ? (
              <Button variant="outline" size="sm" onClick={() => onApply({ status: "in_review" }, { status: "in_review" })}>
                Em análise
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => onApply({ status: "postponed", block_id: null }, { status: "postponed", block_id: null, meeting_id: null })}>
              Adiar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowReturn((v) => !v)}>
              Devolver / esclarecer
            </Button>
            <Button variant="ghost" size="sm" className="text-alert" onClick={() => onApply({ status: "archived", block_id: null }, { status: "archived", block_id: null })}>
              Arquivar
            </Button>
          </div>
          {showReturn ? (
            <div className="mt-3 space-y-2 border-l-2 border-alert pl-3">
              <Label>O que precisa ser complementado?</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ex.: incluir números de venda e proposta de solução." />
              <Button variant="danger" size="sm" disabled={reason.trim().length < 3} onClick={() => onApply({ status: "returned", return_reason: reason, block_id: null }, { status: "returned", return_reason: reason, block_id: null, meeting_id: null })}>
                Devolver ao autor
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-mute">{label}</div>
      <div className="whitespace-pre-wrap text-sm">{v}</div>
    </div>
  );
}
