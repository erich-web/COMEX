"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, CheckCircle2, AlertCircle, WifiOff, ChevronDown, ChevronUp, Send, Check, Paperclip, FileText, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitAgendaBatch, type BatchResult } from "@/actions/agenda";
import type { AgendaItemInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Chip, FieldError, Hint, Input, Label, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { CATEGORY_LABELS, DURATION_OPTIONS, THEME_OPTIONS } from "@/lib/constants";
import { suggestCategory } from "@/lib/classify";
import { ACCOUNTABILITY_FIELDS, composeAccountability } from "@/lib/guide";
import { cn } from "@/lib/utils";

type Draft = {
  _key: string;
  _open: boolean;
  title: string;
  key_question: string;
  description: string;
  unit_id: string | null;
  category: AgendaItemInput["category"];
  suggested_minutes: number | null;
  links: { label?: string; url: string }[];
  attachments: { name: string; path: string }[];
  account: Record<string, string>;
};
type Errors = Record<number, Record<string, string[]>>;
type Unit = { id: string; name: string; slug: string };

const GROUP_SLUG = "grupo-holding";

const newItem = (unitId: string | null): Draft => ({
  _key: crypto.randomUUID(),
  _open: true,
  title: "",
  key_question: "",
  description: "",
  unit_id: unitId,
  category: "marketing_sales",
  suggested_minutes: 10,
  links: [],
  attachments: [],
  account: {},
});

const DRAFT_KEY = (uid: string) => `comex:pautas:draft:v2:${uid}`;

export function AgendaBatchForm({
  units,
  defaultUnitId,
  promptText,
  deadlineLabel,
  meetingLabel,
  userId,
}: {
  units: Unit[];
  defaultUnitId: string | null;
  promptText: string | null;
  deadlineLabel: string;
  meetingLabel: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Draft[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [errors, setErrors] = useState<Errors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [offline, setOffline] = useState(false);
  const hydrated = useRef(false);

  // Empresas na ordem do protótipo: Grupo primeiro, depois as unidades.
  const companies = useMemo(() => {
    const group = units.find((u) => u.slug === GROUP_SLUG);
    return [...(group ? [group] : []), ...units.filter((u) => u.slug !== GROUP_SLUG)];
  }, [units]);

  // ---- rascunho local (proteção contra perda de dados)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(userId));
      if (raw) {
        const d = JSON.parse(raw) as { items: Draft[]; batchId: string };
        if (d.items?.length) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(d.items.map((i, k) => ({ ...i, attachments: i.attachments ?? [], account: i.account ?? {}, _open: k === d.items.length - 1 })));
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
      localStorage.setItem(DRAFT_KEY(userId), JSON.stringify({ items, batchId }));
    } catch {}
  }, [items, batchId, userId, result]);

  useEffect(() => {
    const on = () => setOffline(false),
      off = () => setOffline(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setTimeout(() => document.getElementById(`pauta-${items.length}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const remove = (i: number) => {
    setItems((xs) => (xs.length === 1 ? [newItem(defaultUnitId)] : xs.filter((_, k) => k !== i)));
    setErrors({});
  };

  const filled = useMemo(() => items.filter((i) => i.title.trim() || i.key_question.trim() || i.attachments.length || Object.values(i.account).some((v) => v?.trim())), [items]);
  const count = filled.length;
  const totalMinutes = filled.reduce((a, i) => a + (i.suggested_minutes ?? 0), 0);

  function localValidate(list: Draft[]): Errors {
    const e: Errors = {};
    list.forEach((it, i) => {
      const fe: Record<string, string[]> = {};
      if (it.title.trim().length < 3) fe.title = ["Dê um título com pelo menos 3 caracteres."];
      if (it.category === "accountability") {
        if (!(it.account.sales ?? "").trim()) fe.sales = ["Informe as vendas da semana."];
        if (!(it.account.problems ?? "").trim()) fe.problems = ["Liste os problemas (até 3)."];
      } else if (it.key_question.trim().length < 8) fe.key_question = ["Escreva a pergunta que o COMEX precisa responder."];
      if (Object.keys(fe).length) e[i] = fe;
    });
    return e;
  }
  const incomplete = useMemo(() => Object.keys(localValidate(filled)).length, [filled]);

  function submit() {
    if (pending) return;
    setGlobalError(null);
    if (offline) {
      setGlobalError("Você está sem conexão. Suas pautas ficam salvas neste aparelho — tente enviar quando a internet voltar.");
      return;
    }
    const toSend = items.length > 1 ? items.filter((i) => i.title.trim() || i.key_question.trim() || i.attachments.length || Object.values(i.account).some((v) => v?.trim())) : items;
    if (toSend.length !== items.length) setItems(toSend);
    const local = localValidate(toSend);
    if (Object.keys(local).length) {
      setErrors(local);
      setItems(toSend.map((x, i) => ({ ...x, _open: local[i] ? true : x._open })));
      const n = Object.keys(local).length;
      setGlobalError(`${n === 1 ? "Uma pauta precisa" : `${n} pautas precisam`} de ajuste. As demais estão preservadas.`);
      document.getElementById(`pauta-${Number(Object.keys(local)[0])}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    startTransition(async () => {
      const payload = toSend.map(({ _key, _open, account, ...rest }) => ({
        ...rest,
        key_question: rest.category === "accountability" ? "Prestação de contas semanal — vendas, desempenhos, problemas e soluções. O que precisamos do COMEX está no último bloco." : rest.key_question,
        description: rest.category === "accountability" ? composeAccountability(account) + (rest.description ? `\n\nCONTEXTO\n${rest.description}` : "") : rest.description || "",
        problem: rest.category === "accountability" ? account.problems || null : null,
        proposed_solution: rest.category === "accountability" ? account.solutions || null : null,
        links: rest.links.filter((l) => l.url.trim()),
        suggested_minutes: rest.suggested_minutes || null,
        urgency: "medium",
        requires_decision: rest.category === "strategic_decision",
      }));
      const r = await submitAgendaBatch({ batchId, items: payload, reflection: null });
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
      <div className="mx-auto max-w-md px-4 py-10 fade-up">
        <div className="rounded-[14px] border border-green/30 bg-green-soft p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-green" />
          <h2 className="mt-4 text-2xl font-bold">
            {result.count} {result.count === 1 ? "pauta registrada" : "pautas registradas"}
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            {result.duplicate ? "Este envio já havia sido registrado — nada foi duplicado." : `Encaminhadas para a organização ${meetingLabel ? `do ${meetingLabel.replace(/\.$/, "")}` : "do próximo COMEX"}.`}
            {result.is_late ? " Entraram fora do prazo recomendado e serão tratadas como extraordinárias." : ""}
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
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
              setBatchId(crypto.randomUUID());
              setErrors({});
            }}
          >
            Enviar mais pautas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-3 px-4 pt-4 md:px-8">
        {promptText ? <p className="text-[13px] text-mute">Provocação da semana: <span className="font-semibold text-ink-2">{promptText}</span></p> : null}
        {offline ? (
          <p className="inline-flex items-center gap-1 text-[13px] font-medium text-alert">
            <WifiOff className="size-3.5" /> Sem conexão — o rascunho continua salvo aqui.
          </p>
        ) : null}

        {items.map((it, i) => (
          <ItemCard key={it._key} idx={i} item={it} errors={errors[i]} companies={companies} userId={userId} batchId={batchId} onChange={(p) => update(i, p)} onRemove={() => remove(i)} />
        ))}

        <button type="button" onClick={add} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-mute/70 text-[15px] font-semibold text-ink-2 hover:border-primary hover:text-primary">
          <Plus className="size-[18px]" /> Adicionar outra pauta
        </button>

        {globalError ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-alert/30 bg-alert-soft px-3 py-2.5 text-sm text-alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {globalError}
          </div>
        ) : null}
        <p className="text-[12px] text-mute">Prazo recomendado: {deadlineLabel}. Fora do prazo nada é bloqueado — a pauta entra como extraordinária.</p>
      </div>

      <div className="sticky z-30 mt-4 border-t border-line bg-surface px-4 pb-3 pt-3 md:px-8" style={{ bottom: "calc(var(--nav-h) + var(--safe-b))" }}>
        <div className="mb-2 flex justify-between text-[12px] text-mute">
          <span>
            {count === 0 ? "Nenhuma pauta preenchida" : `${count} ${count === 1 ? "pauta" : "pautas"} · ${totalMinutes} min no total`}
          </span>
          {incomplete ? <span className="text-amber">{incomplete === 1 ? "1 precisa de ajuste" : `${incomplete} precisam de ajuste`}</span> : null}
        </div>
        <Button variant="primary" size="lg" block loading={pending} disabled={count === 0} onClick={submit}>
          <Send /> {count <= 1 ? "Enviar pauta" : `Enviar ${count} pautas`}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ItemCard({ idx, item, errors, companies, userId, batchId, onChange, onRemove }: { idx: number; item: Draft; errors?: Record<string, string[]>; companies: Unit[]; userId: string; batchId: string; onChange: (p: Partial<Draft>) => void; onRemove: () => void }) {
  const [more, setMore] = useState(item.attachments.length > 0);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (file.size > 20 * 1024 * 1024) return toast.error("Arquivo acima de 20 MB.");
    if (item.attachments.length >= 5) return toast.error("Máximo de 5 anexos por pauta.");
    setUploading(true);
    try {
      const supabase = createClient();
      const key = `${userId}/agenda/${batchId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("comex").upload(key, file, { upsert: false, contentType: file.type || undefined });
      if (error) return toast.error("Falha ao anexar", error.message);
      onChange({ attachments: [...item.attachments, { name: file.name, path: key }] });
      if (!item.title.trim()) onChange({ title: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200) });
    } finally {
      setUploading(false);
    }
  }
  const hasError = !!errors && Object.keys(errors).length > 0;
  const isAccount = item.category === "accountability";
  const missing = !item.title.trim() ? "Falta o título" : isAccount ? (!(item.account.sales ?? "").trim() ? "Faltam as vendas" : !(item.account.problems ?? "").trim() ? "Faltam os problemas" : null) : item.key_question.trim().length < 8 ? "Falta a pergunta-chave" : null;
  const suggestion = useMemo(() => suggestCategory(item.title, item.key_question), [item.title, item.key_question]);
  const companyName = companies.find((c) => c.id === item.unit_id)?.name ?? "Grupo";

  if (!item._open) {
    const ok = !missing && !hasError;
    return (
      <div id={`pauta-${idx}`} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5">
        <span className={cn("flex size-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold", ok ? "bg-green-soft text-green-dark" : "bg-amber-soft text-amber")}>{ok ? <Check className="size-3.5" strokeWidth={3} /> : "!"}</span>
        <button type="button" onClick={() => onChange({ _open: true })} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[15px] font-semibold">{item.title || <span className="text-mute">Pauta {idx + 1}</span>}</span>
          <span className={cn("block truncate text-[12px]", ok ? "text-mute" : "text-amber")}>{missing ?? (hasError ? "Precisa de ajuste" : `${item.suggested_minutes ?? "—"} min · ${CATEGORY_LABELS[item.category ?? "other"]} · ${companyName}${item.attachments.length ? ` · ${item.attachments.length} anexo${item.attachments.length > 1 ? "s" : ""}` : ""}`)}</span>
        </button>
        <button type="button" onClick={() => onChange({ _open: true })} className="shrink-0 px-1.5 py-1 text-[13px] font-semibold text-mute hover:text-ink">
          Editar
        </button>
      </div>
    );
  }

  return (
    <div id={`pauta-${idx}`} className={cn("space-y-4 rounded-[14px] border-2 bg-surface p-4", hasError ? "border-alert" : "border-primary")}>
      <div className="flex items-center justify-between">
        <div className={cn("text-[12px] font-bold uppercase tracking-[0.06em]", hasError ? "text-alert" : "text-primary")}>Pauta {idx + 1}</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onChange({ _open: false })} className="rounded-md px-2 py-1 text-[13px] font-semibold text-mute hover:text-ink">
            Recolher
          </button>
          <button type="button" onClick={onRemove} aria-label="Remover pauta" className="rounded-md p-1.5 text-mute hover:text-alert">
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor={`t-${idx}`}>Título</Label>
        <Input id={`t-${idx}`} value={item.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Ex.: Aplicativo do Grupo: vale investir agora?" aria-invalid={!!errors?.title} maxLength={200} autoFocus={!item.title} />
        <FieldError>{errors?.title?.[0]}</FieldError>
      </div>

      {isAccount ? (
        <div className="space-y-3 rounded-[12px] border border-primary/30 bg-primary-soft/40 p-3">
          <p className="text-[12px] text-ink-2">Prestação de contas semanal da unidade — sempre nos mesmos quatro blocos, para comparar semana a semana.</p>
          {ACCOUNTABILITY_FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={`a-${f.key}-${idx}`}>{f.label}</Label>
              <Textarea id={`a-${f.key}-${idx}`} value={item.account[f.key] ?? ""} onChange={(e) => onChange({ account: { ...item.account, [f.key]: e.target.value } })} placeholder={f.placeholder} rows={3} className="min-h-[72px] text-[14px]" aria-invalid={!!errors?.[f.key]} />
              <FieldError>{errors?.[f.key]?.[0]}</FieldError>
              {!errors?.[f.key] ? <p className="mt-1 text-[11px] text-mute">{f.hint}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <div>
          <Label htmlFor={`q-${idx}`}>
            Pergunta-chave <span className="font-normal text-mute">— o que o COMEX precisa responder?</span>
          </Label>
          <Textarea id={`q-${idx}`} value={item.key_question} onChange={(e) => onChange({ key_question: e.target.value })} placeholder="Ex.: Aprovamos um piloto de 90 dias começando pela Amauri?" aria-invalid={!!errors?.key_question} rows={2} className="min-h-[64px]" maxLength={600} />
          <FieldError>{errors?.key_question?.[0]}</FieldError>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Duração <span className="font-normal text-mute">(min)</span></div>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={item.suggested_minutes === m}
              onClick={() => onChange({ suggested_minutes: m })}
              className={cn("h-10 flex-1 rounded-[10px] border text-[14px] font-semibold transition-colors", item.suggested_minutes === m ? "border-primary bg-primary text-white" : "border-line-2 bg-surface text-ink-2 hover:border-mute")}
            >
              {m === 30 ? "30+" : m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Temática</div>
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((c) => (
            <Chip
              key={c}
              active={item.category === c}
              onClick={() =>
                onChange({
                  category: c,
                  ...(c === "accountability" ? { suggested_minutes: 10, title: item.title.trim() ? item.title : `Prestação de contas — ${companyName}` } : {}),
                })
              }
            >
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
        {suggestion && suggestion !== item.category && THEME_OPTIONS.includes(suggestion) ? (
          <button type="button" onClick={() => onChange({ category: suggestion })} className="mt-1.5 text-[12px] font-semibold text-primary">
            Sugestão pelo texto: {CATEGORY_LABELS[suggestion]}
          </button>
        ) : null}
      </div>

      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Empresa</div>
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => (
            <Chip key={c.id} active={item.unit_id === c.id} onClick={() => onChange({ unit_id: c.id })}>
              {c.slug === GROUP_SLUG ? "Grupo" : c.name}
            </Chip>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1.5 text-[13px] font-semibold text-mute hover:text-ink">
        {more ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} Contexto, PDF, material ou link (opcional)
      </button>
      {more ? (
        <div className="space-y-3 fade-in">
          <div>
            <Label>Anexar PDF ou imagem</Label>
            {item.attachments.map((a, ai) => (
              <div key={a.path} className="mb-2 flex items-center gap-2 rounded-[10px] border border-line bg-bg px-3 py-2 text-[13px]">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <button type="button" aria-label="Remover anexo" onClick={() => onChange({ attachments: item.attachments.filter((_, k) => k !== ai) })} className="p-1 text-mute hover:text-alert">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <label className={cn("flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-2 text-[13px] font-semibold text-ink-2 hover:border-primary hover:text-primary", uploading && "pointer-events-none opacity-60")}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              {uploading ? "Enviando…" : "Escolher arquivo (PDF, imagem, Word)"}
              <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
            </label>
            <Hint>Quem recebe a pauta em PDF pode anexar o arquivo aqui — ele aparece na organização e no modo reunião.</Hint>
          </div>
          <div>
            <Label htmlFor={`d-${idx}`}>Contexto</Label>
            <Textarea id={`d-${idx}`} value={item.description} onChange={(e) => onChange({ description: e.target.value })} rows={3} placeholder="O que está acontecendo, números, o que já foi tentado…" />
          </div>
          <div>
            <Label>Links ou documentos</Label>
            {item.links.map((l, li) => (
              <div key={li} className="mb-2 flex gap-2">
                <Input value={l.url} onChange={(e) => onChange({ links: item.links.map((x, k) => (k === li ? { ...x, url: e.target.value } : x)) })} placeholder="https://" inputMode="url" />
                <Button type="button" variant="ghost" size="icon" aria-label="Remover link" onClick={() => onChange({ links: item.links.filter((_, k) => k !== li) })}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <FieldError>{errors?.links?.[0]}</FieldError>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ links: [...item.links, { label: "", url: "" }] })}>
              <Plus /> Adicionar link
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
