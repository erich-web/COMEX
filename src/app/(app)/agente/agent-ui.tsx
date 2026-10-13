"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, RefreshCw, Zap } from "lucide-react";
import { askAgent, dismissInsight, insightToAgenda, runAgentAnalysis } from "@/actions/agent";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { INSIGHT_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Insight = {
  id: string;
  kind: string;
  title: string;
  body: string;
  suggestion: string | null;
  evidence: { date?: string | null; title?: string | null; meeting_id?: string | null }[];
  score: number;
  status: string;
  unit: string | null;
  agenda_item_id: string | null;
};

const KIND_STYLE: Record<string, string> = {
  recurring_problem: "bg-alert-soft text-alert",
  pending_decision: "bg-amber-soft text-amber",
  growth_idea: "bg-green-soft text-green-dark",
  critical_question: "bg-violet-soft text-violet",
  suggestion: "bg-primary-soft text-primary-ink",
};

const FILTERS = [
  { key: "all", label: "Tudo" },
  { key: "recurring_problem", label: "Recorrentes" },
  { key: "growth_idea", label: "Crescimento" },
  { key: "pending_decision", label: "Decisões sem dono" },
  { key: "critical_question", label: "Perguntas críticas" },
];

export function RunButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      disabled={!enabled}
      onClick={() =>
        start(async () => {
          const r = await runAgentAnalysis();
          if (r.ok) {
            toast(r.message ?? "Análises geradas");
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      <RefreshCw /> {pending ? "Analisando…" : "Analisar agora"}
    </Button>
  );
}

export function AgentFeed({ insights, filter, isAdmin, lastRun, enabled }: { insights: Insight[]; filter: string; isAdmin: boolean; lastRun: string | null; enabled: boolean }) {
  const list = filter === "all" ? insights : insights.filter((i) => i.kind === filter);
  return (
    <>
      <div className="scroll-x flex gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/agente?f=${f.key}`} className={cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[12px] font-medium", filter === f.key ? "border-primary bg-primary-soft font-semibold text-primary-ink" : "border-line-2 bg-surface text-ink-2")}>
            {f.label}
          </Link>
        ))}
      </div>
      {lastRun ? <p className="text-[12px] text-mute">Última análise: {lastRun}</p> : null}
      {list.length === 0 ? (
        <EmptyState
          title={insights.length ? "Nada nesta categoria" : "Nenhuma análise ainda"}
          description={insights.length ? "Veja as outras categorias." : isAdmin ? (enabled ? "Clique em “Analisar agora” para o agente ler as atas e pautas." : "Configure a chave da IA e gere a primeira análise.") : "O administrador ainda não gerou a análise desta semana."}
          icon={<Zap />}
        />
      ) : (
        list.map((i) => <InsightCard key={i.id} insight={i} />)
      )}
    </>
  );
}

function InsightCard({ insight: i }: { insight: Insight }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const turned = i.status === "turned_into_agenda";
  const meetingLinks = i.evidence.filter((e) => e.meeting_id);
  return (
    <article className="space-y-3 rounded-[14px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.05em]", KIND_STYLE[i.kind] ?? "bg-surface-2 text-ink-2")}>{INSIGHT_KIND_LABELS[i.kind] ?? i.kind}</span>
        {i.unit ? <span className="text-[11px] text-mute">{i.unit}</span> : null}
        {i.evidence.length ? <span className="text-[11px] text-mute">· {i.evidence.length} {i.evidence.length === 1 ? "registro" : "registros"}</span> : null}
        {turned ? <Badge variant="green" className="ml-auto">Virou pauta</Badge> : null}
      </div>
      <h3 className="text-[16px] font-bold leading-snug">{i.title}</h3>
      {i.body ? <p className="text-[13px] leading-relaxed text-ink-2">{i.body}</p> : null}
      {i.suggestion ? (
        <div className="rounded-r-[10px] border-l-[3px] border-primary bg-bg px-3 py-2.5 text-[13px] leading-relaxed">
          <strong>Sugestão:</strong> {i.suggestion}
        </div>
      ) : null}
      {i.evidence.length ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mute">
          {i.evidence.slice(0, 6).map((e, k) =>
            e.meeting_id ? (
              <Link key={k} href={`/atas/${e.meeting_id}`} className="underline hover:text-ink">
                {e.date ? `ata de ${e.date.slice(8, 10)}/${e.date.slice(5, 7)}` : e.title || "ata"}
              </Link>
            ) : (
              <span key={k}>{e.date ? `${e.date.slice(8, 10)}/${e.date.slice(5, 7)} · ` : ""}{e.title}</span>
            ),
          )}
        </div>
      ) : null}
      <div className="flex gap-2">
        {turned && i.agenda_item_id ? (
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/pautas/${i.agenda_item_id}`}>Ver pauta</Link>
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await insightToAgenda(i.id);
                  if (r.ok) {
                    toast(r.message ?? "Pauta criada");
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              Virar pauta
            </Button>
            {meetingLinks[0]?.meeting_id ? (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/atas/${meetingLinks[0].meeting_id}`}>Ver atas</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await dismissInsight(i.id);
                    if (r.ok) router.refresh();
                    else toast.error(r.error);
                  })
                }
              >
                Descartar
              </Button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function AskBox({ enabled }: { enabled: boolean }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function send() {
    if (!q.trim() || pending) return;
    start(async () => {
      const r = await askAgent(q);
      if (r.ok) setAnswer(r.data!.answer);
      else toast.error(r.error);
    });
  }
  return (
    <div className="sticky z-30 border-t border-line bg-surface px-4 pb-3 pt-3 md:px-8" style={{ bottom: "calc(var(--nav-h) + var(--safe-b))" }}>
      <div className="mx-auto max-w-3xl space-y-2">
        {answer ? (
          <div className="max-h-[40dvh] overflow-y-auto rounded-[12px] border border-line bg-bg p-3 text-[13px] leading-relaxed whitespace-pre-wrap fade-in">
            {answer}
            <button type="button" onClick={() => setAnswer(null)} className="mt-2 block text-[12px] font-semibold text-mute">
              Fechar
            </button>
          </div>
        ) : null}
        <label className="flex h-12 items-center gap-2 rounded-[12px] border border-line-2 bg-bg pl-3.5 pr-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), send())}
            placeholder={enabled ? "Pergunte: “o que decidimos sobre o Nami?”" : "Agente indisponível — configure a chave da IA"}
            aria-label="Pergunta ao agente"
            disabled={!enabled}
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-mute/70"
          />
          <Button size="iconSm" variant="primary" aria-label="Enviar pergunta" loading={pending} disabled={!enabled || !q.trim()} onClick={send}>
            <ArrowUp strokeWidth={2.5} />
          </Button>
        </label>
      </div>
    </div>
  );
}
