import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Printer, Pencil, Gavel } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todaySP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { TaskListItem } from "@/components/app/task-item";
import type { TaskRow } from "@/lib/queries";
import { MEETING_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { PrintButton } from "./print-button";

export default async function ReuniaoPage({ params }: PageProps<"/reunioes/[id]">) {
  const { id } = await params;
  const s = await requireMember();
  const supabase = await createClient();
  const { data: m } = await supabase.from("meetings").select("*, minutes:meeting_minutes(*)").eq("id", id).maybeSingle();
  if (!m) notFound();
  const today = todaySP();
  const [{ data: decisions }, { data: tasks }, { data: items }, { data: participants }] = await Promise.all([
    supabase.from("meeting_decisions").select("*, owner:profiles!meeting_decisions_owner_id_fkey(short_name,full_name), unit:business_units(name), task:tasks(id,status)").eq("meeting_id", id).order("created_at"),
    supabase.from("tasks").select("*, owner:profiles!tasks_owner_id_fkey(id,short_name,full_name), unit:business_units(id,name)").eq("meeting_id", id).is("deleted_at", null).order("status").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("agenda_items").select("id,title,category,presenter:profiles!agenda_items_presenter_id_fkey(short_name),author:profiles!agenda_items_submitted_by_fkey(short_name)").eq("meeting_id", id).in("status", ["scheduled", "discussed"]).is("deleted_at", null).order("sort_order"),
    supabase.from("meeting_participants").select("profile:profiles(short_name,full_name)").eq("meeting_id", id),
  ]);
  const minutes = m.minutes && (m.minutes.status === "approved" || s.isAdmin) ? m.minutes : null;
  const openTasks = (tasks ?? []).filter((t) => !["done", "cancelled"].includes(t.status));
  const doneTasks = (tasks ?? []).filter((t) => t.status === "done");

  return (
    <div className="fade-in">
      <PageHeader
        title={minutes?.title || m.title}
        label={`${fmtDate(m.series_date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · ${fmtTime(m.scheduled_at)}`}
        back="/reunioes"
        action={<Badge variant={m.status === "closed" ? "black" : "green"}>{MEETING_STATUS_LABELS[m.status]}</Badge>}
      >
        <div className="no-print mt-3 flex flex-wrap gap-2">
          {minutes?.drive_url ? (
            <Button asChild variant="outline" size="sm">
              <a href={minutes.drive_url} target="_blank" rel="noreferrer">
                <ExternalLink /> Abrir no Drive
              </a>
            </Button>
          ) : null}
          {minutes ? <PrintButton /> : null}
          {s.isAdmin ? (
            <Button asChild variant="primary" size="sm">
              <Link href={`/admin/reunioes/${id}/ata`}>
                <Pencil /> {minutes ? "Editar ata" : "Criar ata"}
              </Link>
            </Button>
          ) : null}
        </div>
      </PageHeader>
      <Container className="space-y-5">
        {(participants ?? []).length ? (
          <div className="text-xs text-mute">
            <span className="t-label">Participantes:</span> {(participants ?? []).map((p) => p.profile?.short_name ?? p.profile?.full_name).join(", ")}
          </div>
        ) : null}

        {minutes ? (
          <Card className="print:border-0">
            {minutes.status === "draft" ? <Badge variant="amber">Rascunho — visível só para administradores</Badge> : null}
            {minutes.summary ? <p className="mb-3 font-serif text-base italic text-ink-2">{minutes.summary}</p> : null}
            {minutes.content ? <div className="whitespace-pre-wrap text-sm leading-relaxed">{minutes.content}</div> : <p className="text-sm text-mute">Conteúdo da ata disponível apenas no documento do Drive.</p>}
            {minutes.approved_at ? <div className="mt-4 text-[11px] text-mute">Aprovada em {fmtDateTime(minutes.approved_at)}</div> : null}
          </Card>
        ) : (
          <EmptyState title="Ata ainda não disponível" description={m.status === "closed" ? "A ata será publicada após aprovação." : "A ata é redigida após a reunião."} />
        )}

        {(decisions ?? []).length ? (
          <section>
            <div className="section-label mb-2">Decisões ({decisions!.length})</div>
            <div className="divide-y divide-line border border-line bg-surface">
              {decisions!.map((d) => (
                <div key={d.id} className="flex items-start gap-3 px-3 py-3">
                  <Gavel className="mt-0.5 size-4 shrink-0 text-green-dark" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.title}</div>
                    {d.description ? <div className="text-xs text-ink-2">{d.description}</div> : null}
                    <div className="mt-0.5 text-[11px] text-mute">
                      {d.owner?.short_name ?? d.owner?.full_name ?? "sem responsável"}
                      {d.due_date ? ` · até ${fmtDate(d.due_date)}` : ""}
                      {d.unit?.name ? ` · ${d.unit.name}` : ""}
                    </div>
                  </div>
                  {d.task?.[0] ? (
                    <Link href={`/tarefas/${d.task[0].id}`}>
                      <Badge variant={d.task[0].status === "done" ? "green" : "soft"}>{d.task[0].status === "done" ? "Executada" : "Em execução"}</Badge>
                    </Link>
                  ) : (
                    <Badge variant="outline">Sem tarefa</Badge>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {(items ?? []).length ? (
          <section>
            <div className="section-label mb-2">Pautas discutidas</div>
            <div className="divide-y divide-line border border-line bg-surface">
              {items!.map((i) => (
                <Link key={i.id} href={`/pautas/${i.id}`} className="block px-3 py-2.5 hover:bg-black/[0.03]">
                  <div className="text-sm">{i.title}</div>
                  <div className="text-[11px] text-mute">
                    {CATEGORY_LABELS[i.category]} · {i.presenter?.short_name ?? i.author?.short_name}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {(tasks ?? []).length ? (
          <section>
            <div className="section-label mb-2">
              Tarefas originadas · {doneTasks.length}/{tasks!.length} concluídas
            </div>
            <div className="divide-y divide-line border border-line bg-surface">
              {[...openTasks, ...doneTasks].map((t) => (
                <TaskListItem key={t.id} task={t as TaskRow} today={today} showOwner />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
