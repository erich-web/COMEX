"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { saveCheckin } from "@/actions/performance";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Hint, Input, Label, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

type Initial = { sales_summary: string; problems: { title: string; detail?: string | null }[]; solutions: string; sales_initiatives: string; growth_initiative: string; needs_from_comex: string } | null;

export function CheckinForm({ unitId, slug, weekStart, initial }: { unitId: string; slug: string; weekStart: string; initial: Initial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({
    sales_summary: initial?.sales_summary ?? "",
    problems: (initial?.problems ?? []).map((p) => ({ title: p.title, detail: p.detail ?? "" })),
    solutions: initial?.solutions ?? "",
    sales_initiatives: initial?.sales_initiatives ?? "",
    growth_initiative: initial?.growth_initiative ?? "",
    needs_from_comex: initial?.needs_from_comex ?? "",
    commitments: [] as { title: string; due_date: string }[],
  });

  function save() {
    start(async () => {
      const r = await saveCheckin({
        unit_id: unitId,
        week_start: weekStart,
        ...f,
        problems: f.problems.filter((p) => p.title.trim()),
        commitments: f.commitments.filter((c) => c.title.trim()).map((c) => ({ title: c.title, due_date: c.due_date || null })),
      });
      if (r.ok) {
        toast(r.message ?? "Check-in registrado", { description: r.data?.tasks ? `${r.data.tasks} compromisso(s) viraram tarefas.` : undefined });
        router.push(`/unidades/${slug}`);
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Q n={1} title="Como foram as vendas?" hint="Resultado contra orçamento e principais variações.">
        <Textarea value={f.sales_summary} onChange={(e) => setF({ ...f, sales_summary: e.target.value })} rows={3} aria-invalid={!!errors.sales_summary} placeholder="Ex.: R$ 182 mil, 6% abaixo do orçado; sábado forte, terça e quarta fracas…" />
        <FieldError>{errors.sales_summary?.[0]}</FieldError>
      </Q>
      <Q n={2} title="Quais foram os principais problemas da semana?" hint="Até três, em ordem de prioridade.">
        <div className="space-y-2">
          {f.problems.map((p, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input value={p.title} onChange={(e) => setF({ ...f, problems: f.problems.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} placeholder={`Problema ${i + 1}`} />
                <Input value={p.detail} onChange={(e) => setF({ ...f, problems: f.problems.map((x, k) => (k === i ? { ...x, detail: e.target.value } : x)) })} placeholder="Detalhe (opcional)" className="text-sm" />
              </div>
              <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setF({ ...f, problems: f.problems.filter((_, k) => k !== i) })}>
                <Trash2 />
              </Button>
            </div>
          ))}
          {f.problems.length < 3 ? (
            <Button variant="outline" size="sm" onClick={() => setF({ ...f, problems: [...f.problems, { title: "", detail: "" }] })}>
              <Plus /> Adicionar problema
            </Button>
          ) : null}
        </div>
      </Q>
      <Q n={3} title="Que soluções estão sendo implementadas?" hint="Ações concretas, com responsáveis e prazos.">
        <Textarea value={f.solutions} onChange={(e) => setF({ ...f, solutions: e.target.value })} rows={3} />
      </Q>
      <Q n={4} title="O que estamos fazendo para vender mais?" hint="Campanhas, iniciativas comerciais, parcerias e oportunidades.">
        <Textarea value={f.sales_initiatives} onChange={(e) => setF({ ...f, sales_initiatives: e.target.value })} rows={3} />
        <div className="mt-3 border-l-2 border-green pl-3">
          <Label>Qual iniciativa concreta você está conduzindo para aumentar a receita da sua unidade?</Label>
          <Input value={f.growth_initiative} onChange={(e) => setF({ ...f, growth_initiative: e.target.value })} placeholder="Uma iniciativa, mensurável" />
        </div>
      </Q>
      <Q n={5} title="O que precisamos do COMEX?" hint="Decisões, investimentos, apoio ou recursos.">
        <Textarea value={f.needs_from_comex} onChange={(e) => setF({ ...f, needs_from_comex: e.target.value })} rows={2} />
      </Q>
      <Q n={6} title="Quais compromissos assumimos para a próxima semana?" hint="Cada compromisso vira uma tarefa sua, com prazo.">
        <div className="space-y-2">
          {f.commitments.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input value={c.title} onChange={(e) => setF({ ...f, commitments: f.commitments.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} placeholder="Compromisso" className="flex-1" />
              <Input type="date" value={c.due_date} onChange={(e) => setF({ ...f, commitments: f.commitments.map((x, k) => (k === i ? { ...x, due_date: e.target.value } : x)) })} className="w-[150px]" />
              <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setF({ ...f, commitments: f.commitments.filter((_, k) => k !== i) })}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setF({ ...f, commitments: [...f.commitments, { title: "", due_date: "" }] })}>
            <Plus /> Adicionar compromisso
          </Button>
          {initial ? <Hint>Compromissos já registrados viraram tarefas; aqui você adiciona novos.</Hint> : null}
        </div>
      </Q>
      <div className="sticky z-30 bg-bg pb-3 pt-2" style={{ bottom: "calc(var(--nav-h) + var(--safe-b))" }}>
        <Button variant="green" size="lg" block loading={pending} onClick={save}>
          {initial ? "Atualizar check-in" : "Registrar check-in"}
        </Button>
      </div>
    </div>
  );
}

function Q({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="t-display text-2xl text-green">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug">{title}</div>
          {hint ? <div className="mb-2 text-xs text-mute">{hint}</div> : null}
          {children}
        </div>
      </div>
    </Card>
  );
}
