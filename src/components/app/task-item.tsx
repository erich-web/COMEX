import Link from "next/link";
import { Circle, CircleDot, CheckCircle2, Ban, PauseCircle, XCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";
import { daysBetween } from "@/lib/dates";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import type { TaskRow } from "@/lib/queries";
import type { TaskStatus } from "@/lib/types";
import { TaskQuickStatus } from "./task-quick-status";
import { cn } from "@/lib/utils";

export const STATUS_ICON = {
  not_started: Circle,
  in_progress: CircleDot,
  waiting: PauseCircle,
  blocked: Ban,
  done: CheckCircle2,
  cancelled: XCircle,
} as const;

/** Cor de cada status — a mesma em lista, detalhe, modo reunião e e-mail. */
export const STATUS_STYLE: Record<TaskStatus, { badge: "soft" | "primary" | "amber" | "alertSoft" | "green" | "outline"; icon: string; dot: string }> = {
  not_started: { badge: "soft", icon: "text-mute", dot: "bg-line-2" },
  in_progress: { badge: "primary", icon: "text-primary", dot: "bg-primary" },
  waiting: { badge: "amber", icon: "text-amber", dot: "bg-amber" },
  blocked: { badge: "alertSoft", icon: "text-alert", dot: "bg-alert" },
  done: { badge: "green", icon: "text-green", dot: "bg-green" },
  cancelled: { badge: "outline", icon: "text-mute", dot: "bg-line-2" },
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge variant={STATUS_STYLE[status].badge} className={cn("gap-1", className)}>
      <Icon className="size-3" /> {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

export function TaskListItem({ task, today, showOwner, quick = true }: { task: TaskRow; today: string; showOwner?: boolean; quick?: boolean }) {
  const Icon = STATUS_ICON[task.status];
  const open = !["done", "cancelled"].includes(task.status);
  const late = open && task.due_date && task.due_date < today;
  const days = task.due_date ? daysBetween(task.due_date, today) : 0;
  return (
    <div className="flex items-center gap-2 pr-2 hover:bg-primary/[0.03]">
      <Link href={`/tarefas/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
        <Icon className={cn("size-5 shrink-0", task.status === "done" ? "text-green" : task.status === "blocked" || late ? "text-alert" : STATUS_STYLE[task.status].icon)} />
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-sm font-medium", task.status === "done" && "text-mute line-through")}>{task.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-mute">
            <TaskStatusBadge status={task.status} />
            {task.status === "done" && task.completed_at ? (
              <span className="text-green-dark">concluída em {fmtDate(task.completed_at, { day: "2-digit", month: "short" })}</span>
            ) : task.due_date ? (
              <span className={cn(late && "font-semibold text-alert")}>{late ? `${days}d de atraso` : `até ${fmtDate(task.due_date)}`}</span>
            ) : (
              <span>sem prazo</span>
            )}
            {task.unit?.name ? <span>· {task.unit.name}</span> : task.pillar ? <span>· {task.pillar}</span> : null}
            {showOwner ? <span>· {task.owner?.short_name ?? task.legacy_owner_text ?? "sem responsável"}</span> : null}
            {task.priority === "high" && open ? <Badge variant="alertSoft">Alta</Badge> : null}
          </div>
        </div>
        {!quick ? <ChevronRight className="size-4 shrink-0 text-mute" /> : null}
      </Link>
      {quick && open ? <TaskQuickStatus taskId={task.id} status={task.status} title={task.title} /> : quick ? <ChevronRight className="size-4 shrink-0 text-mute" /> : null}
    </div>
  );
}
