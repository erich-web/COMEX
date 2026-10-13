import Link from "next/link";
import { Circle, CircleDot, CheckCircle2, Ban, PauseCircle, XCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";
import { daysBetween } from "@/lib/dates";
import type { TaskRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const STATUS_ICON = {
  not_started: Circle,
  in_progress: CircleDot,
  waiting: PauseCircle,
  blocked: Ban,
  done: CheckCircle2,
  cancelled: XCircle,
} as const;

export function TaskListItem({ task, today, showOwner }: { task: TaskRow; today: string; showOwner?: boolean }) {
  const Icon = STATUS_ICON[task.status];
  const open = !["done", "cancelled"].includes(task.status);
  const late = open && task.due_date && task.due_date < today;
  const days = task.due_date ? daysBetween(task.due_date, today) : 0;
  return (
    <Link href={`/tarefas/${task.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-primary/[0.03]">
      <Icon className={cn("size-5 shrink-0", task.status === "done" ? "text-green" : task.status === "blocked" ? "text-alert" : late ? "text-alert" : "text-mute")} />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm font-medium", task.status === "done" && "text-mute line-through")}>{task.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-mute">
          {task.due_date ? (
            <span className={cn(late && "font-semibold text-alert")}>
              {late ? `${days}d de atraso` : `até ${fmtDate(task.due_date)}`}
            </span>
          ) : (
            <span>sem prazo</span>
          )}
          {task.unit?.name ? <span>· {task.unit.name}</span> : task.pillar ? <span>· {task.pillar}</span> : null}
          {showOwner ? <span>· {task.owner?.short_name ?? task.legacy_owner_text ?? "sem responsável"}</span> : null}
          {task.priority === "high" ? <Badge variant="alertSoft">Alta</Badge> : null}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-mute" />
    </Link>
  );
}
