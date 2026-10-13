import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getUnits } from "@/lib/queries";
import { todaySP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/primitives";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { TaskActions, TaskComments, TaskEditSheet } from "./task-actions";

export default async function TarefaPage({ params }: PageProps<"/tarefas/[id]">) {
  const { id } = await params;
  const s = await requireMember();
  const supabase = await createClient();
  const [{ data: task }, { data: comments }, { data: activity }, { data: assignees }, profiles, units] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, owner:profiles!tasks_owner_id_fkey(id,short_name,full_name), unit:business_units(id,name), meeting:meetings(id,series_date), agenda:agenda_items(id,title), decision:meeting_decisions(id,title)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("task_comments").select("id,body,created_at,author:profiles(short_name,full_name)").eq("task_id", id).order("created_at"),
    supabase.from("task_activity").select("id,action,from_value,to_value,created_at,actor:profiles(short_name)").eq("task_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("task_assignees").select("profile_id, profile:profiles(short_name,full_name)").eq("task_id", id),
    getProfiles(),
    getUnits(),
  ]);
  if (!task) notFound();
  const today = todaySP();
  const canEdit = s.isAdmin || task.owner_id === s.profile.id || task.created_by === s.profile.id || (assignees ?? []).some((a) => a.profile_id === s.profile.id);
  const open = !["done", "cancelled"].includes(task.status);
  const late = open && task.due_date && task.due_date < today;
  const evidence = task.evidence_url?.startsWith("storage:") ? null : task.evidence_url;
  const evidencePath = task.evidence_url?.startsWith("storage:") ? task.evidence_url.slice(8) : null;
  let signedUrl: string | null = null;
  if (evidencePath) {
    const { data } = await supabase.storage.from("comex").createSignedUrl(evidencePath, 3600);
    signedUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="fade-in">
      <PageHeader
        title={task.title}
        label={task.unit?.name ?? task.pillar ?? "Tarefa"}
        back="/tarefas"
        action={<Badge variant={task.status === "done" ? "green" : task.status === "blocked" ? "alert" : late ? "alertSoft" : "soft"}>{TASK_STATUS_LABELS[task.status]}</Badge>}
      />
      <Container className="space-y-4">
        {canEdit && open ? <TaskActions taskId={task.id} status={task.status} /> : null}

        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Responsável" value={task.owner?.short_name ?? task.owner?.full_name ?? task.legacy_owner_text ?? "Sem responsável"} />
            <Info label="Prazo" value={task.due_date ? fmtDate(task.due_date, { day: "2-digit", month: "short", year: "numeric" }) : "Sem prazo"} alert={!!late} />
            <Info label="Prioridade" value={TASK_PRIORITY_LABELS[task.priority]} />
            <Info label="Colaboradores" value={(assignees ?? []).map((a) => a.profile?.short_name ?? a.profile?.full_name).join(", ") || "—"} />
          </div>
          {task.description ? <p className="whitespace-pre-wrap text-sm">{task.description}</p> : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mute">
            {task.meeting ? (
              <Link href={`/reunioes/${task.meeting.id}`} className="underline">
                COMEX de {fmtDate(task.meeting.series_date, { day: "2-digit", month: "short", year: "numeric" })}
              </Link>
            ) : null}
            {task.agenda ? (
              <Link href={`/pautas/${task.agenda.id}`} className="underline">
                Pauta: {task.agenda.title}
              </Link>
            ) : null}
            {task.decision ? <span>Decisão: {task.decision.title}</span> : null}
          </div>
          {task.status === "done" ? (
            <div className="border-l-2 border-green pl-3 text-sm">
              <div className="t-label">Concluída {task.completed_at ? fmtDateTime(task.completed_at) : ""}</div>
              {task.evidence_note ? <p className="mt-1">{task.evidence_note}</p> : null}
              {evidence ? (
                <a href={evidence} target="_blank" rel="noreferrer" className="mt-1 block break-all text-green-dark underline">
                  {evidence}
                </a>
              ) : null}
              {signedUrl ? (
                <a href={signedUrl} target="_blank" rel="noreferrer" className="mt-1 block text-green-dark underline">
                  Ver evidência anexada
                </a>
              ) : null}
            </div>
          ) : null}
          {canEdit ? (
            <TaskEditSheet
              task={{ id: task.id, title: task.title, description: task.description, owner_id: task.owner_id, unit_id: task.unit_id, due_date: task.due_date, priority: task.priority, assignees: (assignees ?? []).map((a) => a.profile_id) }}
              profiles={profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))}
              units={units.map((u) => ({ id: u.id, name: u.name }))}
            />
          ) : null}
        </Card>

        <TaskComments taskId={task.id} comments={(comments ?? []).map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author: c.author?.short_name ?? c.author?.full_name ?? "" }))} />

        {activity?.length ? (
          <details className="border border-line bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2">Histórico de alterações</summary>
            <ul className="divide-y divide-line px-4 pb-3 text-xs text-mute">
              {activity.map((a) => (
                <li key={a.id} className="py-2">
                  <span className="text-ink">{a.actor?.short_name ?? "Sistema"}</span> · {describe(a.action, a.from_value, a.to_value)} · {fmtDateTime(a.created_at)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Container>
    </div>
  );
}

function Info({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <div className="t-label">{label}</div>
      <div className={alert ? "font-semibold text-alert" : "font-medium"}>{value}</div>
    </div>
  );
}

function describe(action: string, from: string | null, to: string | null) {
  const st = (v: string | null) => (v && v in TASK_STATUS_LABELS ? TASK_STATUS_LABELS[v as keyof typeof TASK_STATUS_LABELS] : v ?? "—");
  if (action === "created") return `criou a tarefa (${st(to)})`;
  if (action === "status") return `${st(from)} → ${st(to)}`;
  if (action === "owner") return "alterou o responsável";
  if (action === "due_date") return `prazo ${from ?? "—"} → ${to ?? "—"}`;
  return action;
}
