"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gavel, Plus, Trash2, Sparkles, Upload, Link2, FileText, Loader2, ExternalLink, Wand2 } from "lucide-react";
import { createDecision, deleteDecision, saveMinutes } from "@/actions/meetings";
import { draftMinutesFromNotes } from "@/actions/ai";
import { applyMinutesProposal, importMinutesFile, importMinutesFromUrl, structureMinutes, type MinutesProposal } from "@/actions/minutes";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, Card, Hint, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

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

type EditorInitial = { title: string; summary: string; content: string; source_notes: string; drive_url: string; status: "draft" | "approved"; file_name: string | null; has_file: boolean; structured_at: string | null };
type Person = { id: string; name: string };
type Unit = { id: string; name: string };

export function MinutesEditor({ meetingId, userId, initial, profiles, units }: { meetingId: string; userId: string; initial: EditorInitial; profiles: Person[]; units: Unit[] }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const [ai, startAi] = useTransition();
  const [importing, setImporting] = useState<"file" | "link" | null>(null);
  const [link, setLink] = useState(initial.drive_url);
  const [proposal, setProposal] = useState<MinutesProposal | null>(null);
  const [structuring, setStructuring] = useState(false);

  function save(approve: boolean) {
    start(async () => {
      const r = await saveMinutes({ meeting_id: meetingId, title: f.title, summary: f.summary, content: f.content, source_notes: f.source_notes, drive_url: f.drive_url, approve });
      if (r.ok) {
        toast(r.message ?? "Salvo");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function uploadFile(file: File) {
    if (file.size > 25 * 1024 * 1024) return toast.error("Arquivo acima de 25 MB.");
    setImporting("file");
    try {
      const supabase = createClient();
      const key = `${userId}/minutes/${meetingId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("comex").upload(key, file, { upsert: false, contentType: file.type || undefined });
      if (error) return toast.error("Falha ao enviar o arquivo", error.message);
      const r = await importMinutesFile(meetingId, { path: key, name: file.name });
      if (r.ok && r.data) {
        setF((x) => ({ ...x, content: r.data!.text, file_name: file.name, has_file: true }));
        toast(r.message ?? "Ata importada");
        router.refresh();
      } else toast.error("Não foi possível importar", r.ok ? "" : r.error);
    } finally {
      setImporting(null);
    }
  }

  async function importLink() {
    if (!/^https?:\/\//i.test(link.trim())) return toast.error("Cole um link válido.");
    setImporting("link");
    try {
      const r = await importMinutesFromUrl(meetingId, link.trim());
      if (r.ok && r.data) {
        setF((x) => ({ ...x, content: r.data!.text, drive_url: link.trim() }));
        toast(r.message ?? "Texto importado");
        router.refresh();
      } else toast.error("Não foi possível importar pelo link", r.ok ? "" : r.error);
    } finally {
      setImporting(null);
    }
  }

  async function structure() {
    setStructuring(true);
    try {
      // garante que o texto atual está salvo antes de estruturar
      if (f.content.trim() !== initial.content.trim()) {
        const r = await saveMinutes({ meeting_id: meetingId, title: f.title, summary: f.summary, content: f.content, source_notes: f.source_notes, drive_url: f.drive_url, approve: initial.status === "approved" });
        if (!r.ok) return toast.error(r.error);
      }
      const r = await structureMinutes(meetingId);
      if (r.ok && r.data) setProposal(r.data);
      else toast.error("A IA não conseguiu estruturar", r.ok ? "" : r.error);
    } finally {
      setStructuring(false);
    }
  }

  const hasText = f.content.trim().length > 80;

  return (
    <>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="section-label">Importar a ata</div>
            <p className="mt-1 text-[13px] text-ink-2">Envie o PDF ou Word da ata (o arquivo do Wesley) ou cole o link compartilhado. O texto entra na ata, fica pesquisável e vira matéria-prima do agente.</p>
          </div>
          {f.has_file ? (
            <a href={`/anexos/ata/${meetingId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-surface-2">
              <FileText className="size-4" /> {f.file_name ?? "Abrir arquivo"} <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={cn("flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-2 text-[13px] font-semibold text-ink-2 hover:border-primary hover:text-primary", importing && "pointer-events-none opacity-60")}>
            {importing === "file" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {importing === "file" ? "Lendo o arquivo…" : "Enviar PDF ou Word da ata"}
            <input type="file" className="sr-only" accept=".pdf,.doc,.docx,.txt,.md" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFile(file); e.target.value = ""; }} />
          </label>
          <div className="flex gap-2">
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link do OneDrive ou Drive" inputMode="url" />
            <Button variant="outline" size="md" loading={importing === "link"} onClick={importLink} aria-label="Importar pelo link">
              <Link2 /> Importar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" disabled={!hasText} loading={structuring} onClick={structure}>
            <Wand2 /> Estruturar com IA: resumo, decisões e compromissos
          </Button>
          {initial.structured_at ? <span className="text-[12px] text-mute">Estruturada em {fmtDate(initial.structured_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}
        </div>
      </Card>

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
            <Textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} rows={3} placeholder="Três ou quatro frases com o essencial — é o que vai no e-mail da véspera e na abertura da reunião." />
          </div>
          <div className="sm:col-span-2">
            <Label>Link do documento (Drive/OneDrive)</Label>
            <Input value={f.drive_url} onChange={(e) => setF({ ...f, drive_url: e.target.value })} placeholder="https://…" inputMode="url" />
          </div>
        </div>
        <details className="rounded-[10px] border border-line">
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-bold text-ink-2">Anotações ou transcrição (geração assistida)</summary>
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
            <Hint>O resultado é sempre um rascunho para revisão.</Hint>
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

      <ProposalSheet meetingId={meetingId} proposal={proposal} profiles={profiles} units={units} onClose={() => setProposal(null)} onApplied={(summary) => { if (summary) setF((x) => ({ ...x, summary })); setProposal(null); router.refresh(); }} />
    </>
  );
}

type Row = { on: boolean; title: string; owner_id: string; owner_text: string; unit_id: string; due_date: string; detail?: string };

function ProposalSheet({ meetingId, proposal, profiles, units, onClose, onApplied }: { meetingId: string; proposal: MinutesProposal | null; profiles: Person[]; units: Unit[]; onClose: () => void; onApplied: (summary: string | null) => void }) {
  const [dec, setDec] = useState<Row[]>([]);
  const [act, setAct] = useState<Row[]>([]);
  const [summary, setSummary] = useState("");
  const [useSummary, setUseSummary] = useState(true);
  const [pending, start] = useTransition();
  const [loadedFor, setLoadedFor] = useState<MinutesProposal | null>(null);

  if (proposal && proposal !== loadedFor) {
    setLoadedFor(proposal);
    setDec(proposal.decisions.map((d) => ({ on: true, title: d.title, owner_id: d.owner_id ?? "", owner_text: d.owner ?? "", unit_id: d.unit_id ?? "", due_date: d.due_date ?? "", detail: d.detail ?? "" })));
    setAct(proposal.actions.map((a) => ({ on: true, title: a.title, owner_id: a.owner_id ?? "", owner_text: a.owner ?? "", unit_id: a.unit_id ?? "", due_date: a.due_date ?? "" })));
    setSummary(proposal.summary);
    setUseSummary(!!proposal.summary);
  }

  const nDec = dec.filter((d) => d.on).length, nAct = act.filter((a) => a.on).length;
  return (
    <Sheet open={!!proposal} onOpenChange={(o) => !o && onClose()} title="O que a IA encontrou na ata" description="Revise, ajuste responsáveis e prazos e registre só o que estiver correto. Nada é gravado sem a sua confirmação." side="right" className="md:max-w-[640px]">
      {proposal ? (
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input type="checkbox" className="size-4 accent-[#2563eb]" checked={useSummary} onChange={(e) => setUseSummary(e.target.checked)} /> Usar este resumo executivo
            </label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="mt-2 text-[13px]" />
          </div>
          {proposal.highlights.length ? (
            <div>
              <div className="section-label mb-1">Destaques</div>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-2">{proposal.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          ) : null}
          <div>
            <div className="section-label mb-2">Decisões · {nDec} selecionadas</div>
            {dec.length ? <ul className="space-y-2">{dec.map((r, i) => <RowEditor key={i} r={r} i={i} list={dec} set={setDec} profiles={profiles} units={units} />)}</ul> : <p className="text-sm text-mute">Nenhuma decisão identificada.</p>}
            <Hint>Decisão com responsável cadastrado gera uma tarefa automaticamente.</Hint>
          </div>
          <div>
            <div className="section-label mb-2">Compromissos (tabela de atividades) · {nAct} selecionados</div>
            {act.length ? <ul className="space-y-2">{act.map((r, i) => <RowEditor key={i} r={r} i={i} list={act} set={setAct} profiles={profiles} units={units} />)}</ul> : <p className="text-sm text-mute">Nenhum compromisso identificado.</p>}
          </div>
          {proposal.open_questions.length ? (
            <div>
              <div className="section-label mb-1">Ficou em aberto</div>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-2">{proposal.open_questions.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          ) : null}
          <Button
            variant="green"
            size="lg"
            block
            loading={pending}
            disabled={!nDec && !nAct && !useSummary}
            onClick={() =>
              start(async () => {
                const r = await applyMinutesProposal(meetingId, {
                  summary: useSummary ? summary : null,
                  decisions: dec.filter((d) => d.on).map((d) => ({ title: d.title, detail: d.detail || null, owner_id: d.owner_id || null, unit_id: d.unit_id || null, due_date: d.due_date || null, create_task: true })),
                  actions: act.filter((a) => a.on).map((a) => ({ title: a.title, owner_id: a.owner_id || null, owner_text: a.owner_text || null, unit_id: a.unit_id || null, due_date: a.due_date || null })),
                });
                if (r.ok) {
                  toast(r.message ?? "Registrado");
                  onApplied(useSummary ? summary : null);
                } else toast.error(r.error);
              })
            }
          >
            Registrar {nDec ? `${nDec} decisão(ões)` : ""}{nDec && nAct ? " e " : ""}{nAct ? `${nAct} compromisso(s)` : ""}{!nDec && !nAct ? "resumo" : ""}
          </Button>
          <p className="text-[11px] text-mute">Modelo: {proposal.model}</p>
        </div>
      ) : null}
    </Sheet>
  );
}

function RowEditor({ r, i, list, set, profiles, units }: { r: Row; i: number; list: Row[]; set: (l: Row[]) => void; profiles: Person[]; units: Unit[] }) {
  return (
    <li className={cn("space-y-2 rounded-[10px] border p-3", r.on ? "border-line bg-surface" : "border-line bg-bg opacity-60")}>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 size-4 accent-[#2563eb]" checked={r.on} onChange={(e) => set(list.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} />
        <Input value={r.title} onChange={(e) => set(list.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className="h-9 text-[13px]" />
      </label>
      <div className="grid grid-cols-3 gap-2 pl-6">
        <Select value={r.owner_id} onChange={(e) => set(list.map((x, k) => (k === i ? { ...x, owner_id: e.target.value } : x)))} className="h-9 text-[12px]" aria-label="Responsável">
          <option value="">{r.owner_text ? `${r.owner_text} (não cadastrado)` : "Responsável"}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={r.due_date} onChange={(e) => set(list.map((x, k) => (k === i ? { ...x, due_date: e.target.value } : x)))} className="h-9 text-[12px]" aria-label="Prazo" />
        <Select value={r.unit_id} onChange={(e) => set(list.map((x, k) => (k === i ? { ...x, unit_id: e.target.value } : x)))} className="h-9 text-[12px]" aria-label="Unidade">
          <option value="">Grupo</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>
      {r.detail ? <p className="pl-6 text-[12px] text-mute">{r.detail}</p> : null}
    </li>
  );
}
