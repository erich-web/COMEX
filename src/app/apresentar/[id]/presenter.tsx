"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Gavel, Play, Pause, RotateCcw, X, Plus, Link2, Maximize2 } from "lucide-react";
import { createDecision, setMeetingStatus } from "@/actions/meetings";
import type { Schedule } from "@/lib/agenda";
import { Input, Label, Select } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { fmtBRL, fmtBRLShort, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; description: string; key_question: string | null; category: string; block_id: string | null; minutes: number; presenter: string; presenter_id: string | null; unit: string | null; unit_id: string | null; requires_decision: boolean; expected_outcome: string | null; proposed_solution: string | null; links: { label?: string; url: string }[] };
type Decision = { id: string; title: string; owner: string | null; due_date: string | null };
type Slide = { kind: "block"; blockId: string } | { kind: "item"; item: Item; blockId: string };

export function Presenter(props: {
  meeting: { id: string; title: string; series_date: string; status: string; startClock: string; endClock: string; prompt: string | null };
  goal: number;
  schedule: Schedule;
  items: Item[];
  decisions: Decision[];
  accountability: { name: string; late: number; open: number; lateItems: string[] }[];
  recentlyDone: { id: string; title: string; owner: string }[];
  reviewUnits: { id: string; name: string; revenue: number | null; budget: number | null; prev: number | null; prior: number | null; week: string | null }[];
  profiles: { id: string; name: string }[];
  units: { id: string; name: string }[];
}) {
  const { meeting, schedule, items } = props;
  const router = useRouter();
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    for (const b of schedule.blocks) {
      out.push({ kind: "block", blockId: b.id });
      for (const id of b.itemIds) {
        const it = items.find((i) => i.id === id);
        if (it) out.push({ kind: "item", item: it, blockId: b.id });
      }
    }
    return out;
  }, [schedule, items]);
  const [idx, setIdx] = useState(0);
  const [showDecision, setShowDecision] = useState(false);
  const slide = slides[idx];
  const block = schedule.blocks.find((b) => b.id === slide?.blockId);
  const next = slides[idx + 1];

  // relógio + cronômetro
  const [now, setNow] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const tick = useRef<number | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!running) return;
    tick.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running]);
  const go = useCallback(
    (d: number) => {
      setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d)));
      setElapsed(0);
      setRunning(true);
    },
    [slides.length],
  );
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key === "d") setShowDecision(true);
      if (e.key === "f") document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);

  const budgetSec = (slide?.kind === "item" ? slide.item.minutes : block?.duration_minutes ?? 0) * 60;
  const over = budgetSec > 0 && elapsed > budgetSec;
  const clock = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now);
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const [decisions, setDecisions] = useState(props.decisions);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (meeting.status === "published") setMeetingStatus(meeting.id, "in_progress");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!slide || !block) {
    return (
      <Shell clock={clock} goal={props.goal} meeting={meeting}>
        <div className="flex flex-1 items-center justify-center p-10 text-center">
          <div>
            <div className="t-display text-4xl">Agenda vazia</div>
            <p className="mt-2 text-white/60">Organize as pautas e publique a agenda antes de apresentar.</p>
            <Link href={`/admin/pautas?reuniao=${meeting.id}`} className="mt-6 inline-block bg-green px-6 py-3 text-[12px] font-bold  text-ink">
              Organizar pautas
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell clock={clock} goal={props.goal} meeting={meeting}>
      <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_380px]">
        {/* Palco */}
        <section className="flex min-h-0 flex-col px-6 py-6 lg:px-12 lg:py-10">
          <div className="flex items-center justify-between gap-4">
            <div className="section-label">
              {block.startClock}–{block.endClock} · {block.title}
            </div>
            <div className={cn("flex items-center gap-3 border px-3 py-1.5 tabular", over ? "border-[#f06a55] text-[#f06a55]" : "border-line text-white/80")}>
              <span className="t-display text-2xl">{mmss(elapsed)}</span>
              <span className="text-xs text-white/50">/ {mmss(budgetSec)}</span>
              <button onClick={() => setRunning((r) => !r)} className="p-1 hover:text-green" aria-label={running ? "Pausar" : "Retomar"}>
                {running ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button onClick={() => setElapsed(0)} className="p-1 hover:text-green" aria-label="Zerar">
                <RotateCcw className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 flex-1 fade-up" key={idx}>
            {slide.kind === "block" ? <BlockSlide block={block} blockItems={items.filter((i) => i.block_id === block.id)} meeting={meeting} goal={props.goal} accountability={props.accountability} recentlyDone={props.recentlyDone} reviewUnits={props.reviewUnits} /> : <ItemSlide item={slide.item} />}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-4">
            <button onClick={() => go(-1)} disabled={idx === 0} className="flex items-center gap-2 text-[11px] font-bold  text-white/60 hover:text-white disabled:opacity-30">
              <ChevronLeft className="size-5" /> Anterior
            </button>
            <div className="min-w-0 flex-1 truncate text-center text-xs text-white/50">
              {next ? (
                <>
                  <span className="t-label text-white/40">A seguir: </span>
                  {next.kind === "item" ? next.item.title : schedule.blocks.find((b) => b.id === next.blockId)?.title}
                </>
              ) : (
                "Fim da agenda"
              )}
            </div>
            <button onClick={() => go(1)} disabled={idx === slides.length - 1} className="flex items-center gap-2 bg-green px-4 py-2.5 text-[11px] font-bold  text-ink hover:bg-green-dark disabled:opacity-30">
              Avançar <ChevronRight className="size-5" />
            </button>
          </div>
        </section>

        {/* Painel lateral: decisões */}
        <aside className="flex min-h-0 flex-col border-t border-line bg-ink lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="section-label">Decisões da reunião · {decisions.length}</div>
            <button onClick={() => setShowDecision(true)} className="flex items-center gap-1 bg-green px-3 py-1.5 text-[10px] font-bold  text-ink">
              <Plus className="size-3.5" /> Decisão
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {decisions.length === 0 ? (
              <p className="text-xs text-white/50">Nenhuma decisão registrada ainda. Pressione “D” para registrar.</p>
            ) : (
              <ul className="space-y-2">
                {decisions.map((d) => (
                  <li key={d.id} className="border-l-2 border-green pl-3">
                    <div className="text-sm">{d.title}</div>
                    <div className="text-[11px] text-white/50">
                      {d.owner ?? "sem responsável"}
                      {d.due_date ? ` · até ${fmtDate(d.due_date)}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-line px-4 py-3">
            <div className="scroll-x flex gap-1">
              {slides.map((s, i) => (
                <button key={i} onClick={() => (setIdx(i), setElapsed(0))} className={cn("h-1.5 shrink-0", s.kind === "block" ? "w-4" : "w-2", i === idx ? "bg-green" : i < idx ? "bg-surface/40" : "bg-surface/15")} aria-label={`Slide ${i + 1}`} />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px]  text-white/40">
              <span>
                {idx + 1}/{slides.length}
              </span>
              <span>← → navegar · D decisão · F tela cheia</span>
            </div>
          </div>
        </aside>
      </div>

      {showDecision ? (
        <DecisionDialog
          meetingId={meeting.id}
          item={slide.kind === "item" ? slide.item : null}
          profiles={props.profiles}
          units={props.units}
          onClose={() => setShowDecision(false)}
          onCreated={(d) => {
            setDecisions((xs) => [...xs, d]);
            setShowDecision(false);
            router.refresh();
          }}
          pending={pending}
          start={start}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children, clock, goal, meeting }: { children: React.ReactNode; clock: string; goal: number; meeting: { id: string; title: string; series_date: string } }) {
  return (
    <div className="flex min-h-dvh flex-col bg-primary text-white">
      <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-3 lg:px-12">
        <div className="flex items-center gap-4">
          <span className=" text-xl font-semibold tracking-[-0.03em]">RPE</span>
          <span className="t-label text-white/50">
            COMEX · {fmtDate(meeting.series_date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="t-display text-lg">
          RPE 2030 — <span className="text-green">{fmtBRLShort(goal)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="t-display text-2xl tabular">{clock}</span>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="hidden p-1 text-white/50 hover:text-white lg:block" aria-label="Tela cheia">
            <Maximize2 className="size-4" />
          </button>
          <Link href={`/admin/reunioes/${meeting.id}/ata`} className="p-1 text-white/50 hover:text-white" aria-label="Sair do modo reunião">
            <X className="size-5" />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}

function BlockSlide({ block, blockItems: items, ...p }: { block: Schedule["blocks"][number]; blockItems: Item[]; meeting: { prompt: string | null }; goal: number; accountability: { name: string; late: number; open: number; lateItems: string[] }[]; recentlyDone: { id: string; title: string; owner: string }[]; reviewUnits: { id: string; name: string; revenue: number | null; budget: number | null; prev: number | null; prior: number | null; week: string | null }[] }) {
  if (block.kind === "opening") {
    return (
      <div className="flex h-full flex-col justify-center">
        <div className="section-label">Compromisso permanente</div>
        <h1 className="t-display mt-4 text-6xl lg:text-8xl">
          RPE 2030
          <br />
          <span className="text-green">{fmtBRLShort(p.goal)}</span>
        </h1>
        {p.meeting.prompt ? <p className="mt-8 max-w-[36ch]  text-2xl italic text-white/80 lg:text-3xl">“{p.meeting.prompt}”</p> : null}
      </div>
    );
  }
  if (block.kind === "accountability") {
    return (
      <div className="grid h-full gap-8 lg:grid-cols-2">
        <div>
          <h2 className="t-display text-4xl lg:text-5xl">Compromissos pendentes</h2>
          <ul className="mt-5 space-y-3">
            {p.accountability.slice(0, 8).map((a) => (
              <li key={a.name} className="border-b border-line pb-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold">{a.name}</span>
                  <span className="tabular text-sm text-white/60">
                    {a.late > 0 ? <span className="mr-3 font-bold text-[#f06a55]">{a.late} atrasada{a.late > 1 ? "s" : ""}</span> : null}
                    {a.open} aberta{a.open > 1 ? "s" : ""}
                  </span>
                </div>
                {a.lateItems.length ? <div className="mt-1 text-sm text-white/50">{a.lateItems.join(" · ")}</div> : null}
              </li>
            ))}
            {p.accountability.length === 0 ? <li className="text-white/50">Nenhum compromisso em aberto.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="t-display text-4xl text-green lg:text-5xl">Entregue desde o último COMEX</h2>
          <ul className="mt-5 space-y-2 text-lg">
            {p.recentlyDone.slice(0, 10).map((t) => (
              <li key={t.id} className="flex gap-3">
                <span className="text-green">✓</span>
                <span>
                  {t.title} <span className="text-sm text-white/50">— {t.owner}</span>
                </span>
              </li>
            ))}
            {p.recentlyDone.length === 0 ? <li className="text-white/50">Nenhuma entrega registrada.</li> : null}
          </ul>
        </div>
      </div>
    );
  }
  if (block.kind === "business_review") {
    return (
      <div className="flex h-full flex-col">
        <h2 className="t-display text-4xl lg:text-5xl">Business Review</h2>
        <div className="mt-6 grid flex-1 gap-4 lg:grid-cols-2">
          {p.reviewUnits.length === 0 ? <p className="text-white/50">Defina as unidades em revisão nas configurações da reunião.</p> : null}
          {p.reviewUnits.map((u) => {
            const vsB = u.revenue != null && u.budget ? ((u.revenue - u.budget) / u.budget) * 100 : null;
            const vsP = u.revenue != null && u.prev ? ((u.revenue - u.prev) / u.prev) * 100 : null;
            const vsY = u.revenue != null && u.prior ? ((u.revenue - u.prior) / u.prior) * 100 : null;
            const D = ({ l, v }: { l: string; v: number | null }) => (
              <div>
                <div className="t-label text-white/40">{l}</div>
                <div className={cn("t-display text-3xl tabular", v == null ? "text-white/40" : v >= 0 ? "text-green" : "text-[#f06a55]")}>{v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}</div>
              </div>
            );
            return (
              <div key={u.id} className="border border-line bg-ink p-6">
                <div className="t-display text-3xl">{u.name}</div>
                <div className="text-xs text-white/50">{u.week ? `Semana de ${fmtDate(u.week, { day: "2-digit", month: "short" })}` : "Sem dados informados"}</div>
                <div className="t-display mt-4 text-5xl tabular">{u.revenue != null ? fmtBRL(u.revenue) : "Não informado"}</div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <D l="vs orçado" v={vsB} />
                  <D l="vs semana ant." v={vsP} />
                  <D l="vs ano ant." v={vsY} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-center">
      <h2 className="t-display text-5xl lg:text-7xl">{block.title}</h2>
      <div className="mt-6 text-xl text-white/60">
        {block.duration_minutes} minutos · {items.length} pauta{items.length === 1 ? "" : "s"}
      </div>
      {items.length ? (
        <ol className="mt-8 space-y-3">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-baseline gap-4 text-2xl">
              <span className="t-display text-3xl text-green">{i + 1}</span>
              <span>
                {it.requires_decision ? <Gavel className="mr-2 inline size-5 text-green" /> : null}
                {it.title}
                <span className="ml-3 text-base text-white/50">
                  {it.presenter} · {it.minutes}′
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function ItemSlide({ item }: { item: Item }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
        <span className="border border-line px-2 py-1 text-[12px] font-bold">{item.category}</span>
        {item.unit ? <span>{item.unit}</span> : null}
        <span>· apresenta {item.presenter}</span>
        <span>· {item.minutes} min</span>
        {item.requires_decision ? (
          <span className="flex items-center gap-1 text-green">
            <Gavel className="size-4" /> exige decisão
          </span>
        ) : null}
      </div>
      <h2 className="t-display mt-4 text-4xl lg:text-6xl">{item.title}</h2>
      {item.key_question ? (
        <div className="mt-6 border-l-4 border-green pl-5">
          <div className="t-label text-green">O que precisamos responder</div>
          <p className="mt-1 text-2xl font-semibold leading-snug lg:text-3xl">{item.key_question}</p>
        </div>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        {item.description ? <p className="whitespace-pre-wrap text-xl leading-relaxed text-white/85">{item.description}</p> : <div />}
        <div className="space-y-4">
          {item.expected_outcome && !item.key_question ? (
            <div className="border-l-2 border-green pl-4">
              <div className="t-label text-green">Resultado esperado</div>
              <div className="mt-1 text-lg">{item.expected_outcome}</div>
            </div>
          ) : null}
          {item.proposed_solution ? (
            <div className="border-l-2 border-line pl-4">
              <div className="t-label text-white/40">Proposta</div>
              <div className="mt-1 text-lg">{item.proposed_solution}</div>
            </div>
          ) : null}
          {item.links.length ? (
            <div>
              <div className="t-label text-white/40">Materiais</div>
              <ul className="mt-1 space-y-1">
                {item.links.map((l, i) => (
                  <li key={i}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green underline">
                      <Link2 className="size-4" /> {l.label || l.url.replace(/^https?:\/\//, "").slice(0, 50)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DecisionDialog({ meetingId, item, profiles, units, onClose, onCreated, pending, start }: { meetingId: string; item: Item | null; profiles: { id: string; name: string }[]; units: { id: string; name: string }[]; onClose: () => void; onCreated: (d: Decision) => void; pending: boolean; start: (fn: () => Promise<void>) => void }) {
  const [f, setF] = useState({ title: item ? `${item.title}: ` : "", owner_id: item?.presenter_id ?? "", unit_id: item?.unit_id ?? "", due_date: "", create_task: true });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 lg:items-center" onClick={onClose}>
      <div className="w-full max-w-lg border border-line bg-ink p-5 text-white fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="t-display text-2xl">Registrar decisão</div>
          <button onClick={onClose} aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        {item ? <div className="mt-1 text-xs text-white/50">Pauta: {item.title}</div> : null}
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-white/60">Decisão *</Label>
            <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="border-line bg-primary text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/60">Responsável</Label>
              <Select value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })} className="border-line bg-primary text-white">
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-white/60">Prazo</Label>
              <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} className="border-line bg-primary text-white" />
            </div>
            <div className="col-span-2">
              <Label className="text-white/60">Unidade</Label>
              <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} className="border-line bg-primary text-white">
                <option value="">Grupo</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[#2563eb]" checked={f.create_task} onChange={(e) => setF({ ...f, create_task: e.target.checked })} /> Gerar tarefa para o responsável
          </label>
          <button
            disabled={pending || f.title.trim().length < 3}
            className="w-full bg-green py-3 text-[12px] font-bold  text-ink disabled:opacity-50"
            onClick={() =>
              start(async () => {
                const r = await createDecision({ meeting_id: meetingId, title: f.title, owner_id: f.owner_id || null, unit_id: f.unit_id || null, due_date: f.due_date || null, agenda_item_id: item?.id ?? null, create_task: f.create_task });
                if (r.ok) {
                  toast(r.message ?? "Decisão registrada");
                  onCreated({ id: r.data!.id, title: f.title, owner: profiles.find((p) => p.id === f.owner_id)?.name ?? null, due_date: f.due_date || null });
                } else toast.error(r.error);
              })
            }
          >
            {pending ? "Salvando…" : "Registrar decisão"}
          </button>
        </div>
      </div>
    </div>
  );
}
