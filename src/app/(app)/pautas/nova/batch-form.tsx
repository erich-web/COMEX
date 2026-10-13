"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronUp, Copy, Trash2, ArrowUp, ArrowDown, CheckCircle2, AlertCircle, WifiOff, Sparkles } from "lucide-react";
import { submitAgendaBatch, type BatchResult } from "@/actions/agenda";
import type { AgendaItemInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Badge, FieldError, Hint, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";
import { suggestCategory } from "@/lib/classify";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Draft = Omit<AgendaItemInput, "suggested_minutes" | "links"> & { suggested_minutes: number | null; links: { label?: string; url: string }[]; _key: string; _open: boolean };
type Errors = Record<number, Record<string, string[]>>;

const newItem = (unitId: string | null): Draft => ({
  _key: crypto.randomUUID(),
  _open: true,
  title: "",
  description: "",
  unit_id: unitId,
  expected_outcome: "",
  category: "other",
  problem: "",
  proposed_solution: "",
  expected_impact: "",
  urgency: "medium",
  suggested_minutes: null,
  people_involved: "",
  links: [],
  strategic_goal_id: null,
  requires_decision: false,
});

const DRAFT_KEY = (uid: string) => `comex:pautas:draft:${uid}`;

export function AgendaBatchForm({
  units,
  goals,
  defaultUnitId,
  promptText,
  deadlineLabel,
  meetingLabel,
  userId,
}: {
  units: { id: string; name: string }[];
  goals: { id: string; name: string }[];
  defaultUnitId: string | null;
  promptText: string | null;
  deadlineLabel: string;
  meetingLabel: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Draft[]>([]);
  const [reflection, setReflection] = useState("");
  const [batchId, setBatchId] = useState<string>("");
  const [errors, setErrors] = useState<Errors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [offline, setOffline] = useState(false);
  const hydrated = useRef(false);

  // ---- rascunho local (proteção contra perda de dados)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(userId));
      if (raw) {
        const d = JSON.parse(raw) as { items: Draft[]; reflection: string; batchId: string };
        if (d.items?.length) {
          setItems(d.items.map((i) => ({ ...i, _open: false })));
          setReflection(d.reflection ?? "");
          setBatchId(d.batchId || crypto.randomUUID());
          hydrated.current = true;
          return;
        }
      }
    } catch {}
    setItems([newItem(defaultUnitId)]);
    setBatchId(crypto.randomUUID());
    hydrated.current = true;
  }, [userId, defaultUnitId]);

  useEffect(() => {
    if (!hydrated.current || result) return;
    try {
      localStorage.setItem(DRAFT_KEY(userId), JSON.stringify({ items, reflection, batchId }));
    } catch {}
  }, [items, reflection, batchId, userId, result]);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const update = useCallback((idx: number, patch: Partial<Draft>) => {
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
    setErrors((e) => {
      if (!e[idx]) return e;
      const copy = { ...e };
      const fe = { ...copy[idx] };
      Object.keys(patch).forEach((k) => delete fe[k]);
      if (Object.keys(fe).length) copy[idx] = fe;
      else delete copy[idx];
      return copy;
    });
  }, []);

  const add = () => {
    setItems((xs) => [...xs.map((x) => ({ ...x, _open: false })), newItem(defaultUnitId)]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
  };
  const duplicate = (i: number) => setItems((xs) => [...xs.slice(0, i + 1), { ...xs[i], _key: crypto.randomUUID(), title: xs[i].title ? `${xs[i].title} (cópia)` : "", _open: true }, ...xs.slice(i + 1)]);
  const remove = (i: number) => {
    setItems((xs) => xs.filter((_, k) => k !== i));
    setErrors({});
  };
  const move = (i: number, dir: -1 | 1) => {
    setItems((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
    setErrors({});
  };

  const filled = useMemo(() => items.filter((i) => i.title.trim() || i.description.trim()), [items]);
  const count = filled.length;

  function submit() {
    if (pending) return;
    setGlobalError(null);
    if (offline) {
      setGlobalError("Você está sem conexão. Suas pautas ficam salvas neste aparelho — tente enviar quando a internet voltar.");
      return;
    }
    // descarta cards totalmente vazios (exceto se for o único)
    const toSend = items.length > 1 ? items.filter((i) => i.title.trim() || i.description.trim()) : items;
    if (toSend.length !== items.length) setItems(toSend);
    const local = (() => {
      const e: Errors = {};
      toSend.forEach((it, i) => {
        const fe: Record<string, string[]> = {};
        if (it.title.trim().length < 3) fe.title = ["Dê um título com pelo menos 3 caracteres."];
        if (it.description.trim().length < 10) fe.description = ["Descreva o contexto (mínimo 10 caracteres)."];
        if (Object.keys(fe).length) e[i] = fe;
      });
      return e;
    })();
    if (Object.keys(local).length) {
      setErrors(local);
      setItems(toSend.map((x, i) => ({ ...x, _open: local[i] ? true : x._open })));
      setGlobalError(`${Object.keys(local).length === 1 ? "Uma pauta precisa" : `${Object.keys(local).length} pautas precisam`} de correção. As demais estão preservadas.`);
      const first = Number(Object.keys(local)[0]);
      document.getElementById(`pauta-${first}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    startTransition(async () => {
      const payload = toSend.map(({ _key, _open, ...rest }) => ({ ...rest, suggested_minutes: rest.suggested_minutes || null }));
      const r = await submitAgendaBatch({ batchId, items: payload, reflection: reflection || null });
      if (!r.ok) {
        if ("itemErrors" in r && r.itemErrors) {
          setErrors(r.itemErrors);
          setItems(toSend.map((x, i) => ({ ...x, _open: r.itemErrors![i] ? true : x._open })));
        }
        setGlobalError(r.error);
        return;
      }
      try {
        localStorage.removeItem(DRAFT_KEY(userId));
      } catch {}
      setResult(r.data!);
      toast(r.data!.duplicate ? "Este lote já havia sido enviado." : `${r.data!.count} pauta(s) enviada(s)`);
      router.refresh();
    });
  }

  if (result) {
    return (
      <div className="px-4 py-8 md:px-8 fade-up">
        <div className="mx-auto max-w-md border border-green bg-green/10 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-green" />
          <h2 className="t-display mt-4 text-3xl">
            {result.count} {result.count === 1 ? "pauta registrada" : "pautas registradas"}
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            {result.duplicate ? "Este envio já havia sido registrado — nada foi duplicado." : `Suas pautas foram encaminhadas para a organização ${meetingLabel ? `do ${meetingLabel}` : "do próximo COMEX"}.`}
            {result.is_late ? " Elas entraram fora do prazo recomendado e serão tratadas como extraordinárias." : ""}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild variant="primary" size="lg" block>
              <Link href="/pautas">Ver minhas pautas</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              block
              onClick={() => {
                setResult(null);
                setItems([newItem(defaultUnitId)]);
                setReflection("");
                setBatchId(crypto.randomUUID());
                setErrors({});
              }}
            >
              Enviar mais pautas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 md:px-8 md:max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span>Prazo recomendado: {deadlineLabel}.</span>
        <span>Rascunho salvo automaticamente neste aparelho.</span>
        {offline ? (
          <span className="inline-flex items-center gap-1 text-alert">
            <WifiOff className="size-3.5" /> sem conexão
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        {items.map((it, i) => (
          <ItemCard key={it._key} idx={i} item={it} total={items.length} errors={errors[i]} units={units} goals={goals} onChange={(p) => update(i, p)} onDuplicate={() => duplicate(i)} onRemove={() => remove(i)} onMove={(d) => move(i, d)} />
        ))}
      </div>

      <button type="button" onClick={add} className="mt-3 flex w-full items-center justify-center gap-2 border border-dashed border-line-2 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2 hover:border-black hover:text-ink">
        <Plus className="size-4" /> Adicionar outra pauta
      </button>

      {/* Reflexão da semana */}
      <div className="mt-6 border border-line bg-surface p-4">
        <Label htmlFor="reflection">Sua reflexão ou ideia da semana (opcional)</Label>
        {promptText ? <p className="mb-2 font-serif text-sm italic text-ink-2">“{promptText}”</p> : null}
        <Textarea id="reflection" value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="Uma ideia, uma provocação, uma oportunidade que você enxergou…" rows={3} />
        <Hint>Fica registrada e pode virar pauta ou oportunidade comercial.</Hint>
      </div>

      {/* Resumo + envio */}
      <div className="mt-6 border border-line bg-surface p-4">
        <div className="t-label mb-2">Resumo do envio</div>
        {count === 0 ? (
          <p className="text-sm text-mute">Nenhuma pauta preenchida ainda.</p>
        ) : (
          <ol className="space-y-1.5">
            {items.map((it, i) =>
              it.title.trim() || it.description.trim() ? (
                <li key={it._key} className="flex items-start gap-2 text-sm">
                  <span className="t-display w-5 shrink-0 text-base text-mute">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{it.title || <span className="text-mute">(sem título)</span>}</span>
                  <Badge variant="soft">{CATEGORY_LABELS[it.category ?? "other"]}</Badge>
                  {errors[i] ? <AlertCircle className="size-4 shrink-0 text-alert" /> : null}
                </li>
              ) : null,
            )}
          </ol>
        )}
        {globalError ? (
          <div className="mt-3 flex items-start gap-2 border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {globalError}
          </div>
        ) : null}
      </div>

      <div className="sticky z-30 mt-4 bg-bg pb-3 pt-2" style={{ bottom: "calc(var(--nav-h) + var(--safe-b))" }}>
        <Button variant="green" size="lg" block loading={pending} disabled={count === 0} onClick={submit}>
          {count <= 1 ? "Enviar pauta" : `Enviar ${count} pautas`}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ItemCard({
  idx,
  item,
  total,
  errors,
  units,
  goals,
  onChange,
  onDuplicate,
  onRemove,
  onMove,
}: {
  idx: number;
  item: Draft;
  total: number;
  errors?: Record<string, string[]>;
  units: { id: string; name: string }[];
  goals: { id: string; name: string }[];
  onChange: (p: Partial<Draft>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const [more, setMore] = useState(false);
  const hasError = !!errors && Object.keys(errors).length > 0;
  const suggestion = useMemo(() => suggestCategory(item.title ?? "", item.description ?? ""), [item.title, item.description]);
  const showSuggestion = suggestion && suggestion !== item.category && (item.category === "other" || !item.title);
  const needsDetail = ["strategic_decision", "business_review"].includes(item.category ?? "") || item.requires_decision;

  return (
    <div id={`pauta-${idx}`} className={cn("border bg-surface transition-colors", hasError ? "border-alert" : item._open ? "border-black" : "border-line")}>
      <button type="button" onClick={() => onChange({ _open: !item._open })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={cn("t-display text-xl", hasError ? "text-alert" : "text-mute")}>{idx + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.title || <span className="text-mute">Nova pauta</span>}</span>
          <span className="block truncate text-[11px] text-mute">
            {CATEGORY_LABELS[item.category ?? "other"]}
            {item.unit_id ? ` · ${units.find((u) => u.id === item.unit_id)?.name ?? ""}` : ""}
            {hasError ? " · precisa de correção" : ""}
          </span>
        </span>
        {hasError ? <AlertCircle className="size-4 text-alert" /> : null}
        {item._open ? <ChevronUp className="size-5 text-mute" /> : <ChevronDown className="size-5 text-mute" />}
      </button>

      {item._open ? (
        <div className="space-y-4 border-t border-line px-4 pb-4 pt-4 fade-in">
          <div>
            <Label htmlFor={`t-${idx}`}>Título *</Label>
            <Input id={`t-${idx}`} value={item.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Ex.: Estratégia comercial da Mercearia Amauri" aria-invalid={!!errors?.title} maxLength={200} />
            <FieldError>{errors?.title?.[0]}</FieldError>
          </div>
          <div>
            <Label htmlFor={`d-${idx}`}>Descrição ou contexto *</Label>
            <Textarea id={`d-${idx}`} value={item.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="O que está acontecendo, por que isso importa e o que precisamos discutir." aria-invalid={!!errors?.description} rows={4} />
            <FieldError>{errors?.description?.[0]}</FieldError>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`u-${idx}`}>Unidade ou área</Label>
              <Select id={`u-${idx}`} value={item.unit_id ?? ""} onChange={(e) => onChange({ unit_id: e.target.value || null })}>
                <option value="">Grupo / transversal</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`c-${idx}`}>Tipo de pauta</Label>
              <Select id={`c-${idx}`} value={item.category ?? "other"} onChange={(e) => onChange({ category: e.target.value as Draft["category"] })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              {showSuggestion ? (
                <button type="button" onClick={() => onChange({ category: suggestion! })} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-green-dark">
                  <Sparkles className="size-3.5" /> Sugerido: {CATEGORY_LABELS[suggestion!]}
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <Label htmlFor={`o-${idx}`}>Resultado esperado {needsDetail ? "*" : ""}</Label>
            <Input id={`o-${idx}`} value={item.expected_outcome ?? ""} onChange={(e) => onChange({ expected_outcome: e.target.value })} placeholder="Ex.: aprovar orçamento, definir responsável, alinhar direção" />
            {needsDetail && !item.expected_outcome ? <Hint className="text-amber">Deliberações relevantes pedem resultado esperado e informações complementares antes da reunião.</Hint> : null}
          </div>

          <label className="flex items-center gap-3 border border-line px-3 py-2.5">
            <input type="checkbox" className="size-4 accent-[#00b73d]" checked={!!item.requires_decision} onChange={(e) => onChange({ requires_decision: e.target.checked })} />
            <span className="text-sm">Esta pauta exige uma decisão do COMEX</span>
          </label>

          <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2">
            {more ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} Informações complementares
          </button>

          {more ? (
            <div className="space-y-4 border-l-2 border-green pl-3 fade-in">
              <div>
                <Label>Problema identificado</Label>
                <Textarea value={item.problem ?? ""} onChange={(e) => onChange({ problem: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Solução ou recomendação proposta</Label>
                <Textarea value={item.proposed_solution ?? ""} onChange={(e) => onChange({ proposed_solution: e.target.value })} rows={2} placeholder="Problemas vêm acompanhados de propostas." />
              </div>
              <div>
                <Label>Impacto esperado</Label>
                <Input value={item.expected_impact ?? ""} onChange={(e) => onChange({ expected_impact: e.target.value })} placeholder="Receita, margem, experiência, pessoas…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Urgência</Label>
                  <Select value={item.urgency ?? "medium"} onChange={(e) => onChange({ urgency: e.target.value as Draft["urgency"] })}>
                    {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Tempo sugerido (min)</Label>
                  <Input type="number" inputMode="numeric" min={5} max={120} step={5} value={item.suggested_minutes ?? ""} onChange={(e) => onChange({ suggested_minutes: e.target.value ? Number(e.target.value) : null })} placeholder="10" />
                </div>
              </div>
              <div>
                <Label>Objetivo estratégico</Label>
                <Select value={item.strategic_goal_id ?? ""} onChange={(e) => onChange({ strategic_goal_id: e.target.value || null })}>
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
                <Input value={item.people_involved ?? ""} onChange={(e) => onChange({ people_involved: e.target.value })} placeholder="Ex.: Luiz, Deise, fornecedor X" />
              </div>
              <div>
                <Label>Documentos ou links</Label>
                {(item.links ?? []).map((l, li) => (
                  <div key={li} className="mb-2 flex gap-2">
                    <Input value={l.url} onChange={(e) => onChange({ links: (item.links ?? []).map((x, k) => (k === li ? { ...x, url: e.target.value } : x)) })} placeholder="https://" inputMode="url" />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remover link" onClick={() => onChange({ links: (item.links ?? []).filter((_, k) => k !== li) })}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <FieldError>{errors?.links?.[0]}</FieldError>
                <Button type="button" variant="outline" size="sm" onClick={() => onChange({ links: [...(item.links ?? []), { label: "", url: "" }] })}>
                  <Plus /> Adicionar link
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1 border-t border-line pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy /> Duplicar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={idx === 0} aria-label="Mover para cima">
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onMove(1)} disabled={idx === total - 1} aria-label="Mover para baixo">
              <ArrowDown />
            </Button>
            <span className="flex-1" />
            <Button type="button" variant="ghost" size="sm" className="text-alert" onClick={onRemove} disabled={total === 1}>
              <Trash2 /> Excluir
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
