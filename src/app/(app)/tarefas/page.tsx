import Link from "next/link";
import { Plus, CheckSquare } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getMyTasks, taskStats } from "@/lib/queries";
import { todaySP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { EmptyState, Stat } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { TaskListItem } from "@/components/app/task-item";
import { cn } from "@/lib/utils";

export const metadata = { title: "Compromissos" };

const FILTERS = [
  { key: "open", label: "Pendentes" },
  { key: "late", label: "Atrasadas" },
  { key: "week", label: "Esta semana" },
  { key: "blocked", label: "Bloqueadas" },
  { key: "done", label: "Concluídas" },
  { key: "created", label: "Criadas por mim" },
] as const;

export default async function TarefasPage({ searchParams }: PageProps<"/tarefas">) {
  const sp = await searchParams;
  const f = (typeof sp.f === "string" ? sp.f : "open") as (typeof FILTERS)[number]["key"];
  const s = await requireMember();
  const today = todaySP();
  const all = await getMyTasks(s.profile.id);
  const mine = all.filter((t) => t.owner_id === s.profile.id);
  const st = taskStats(mine, today);
  const list =
    f === "late" ? st.late : f === "week" ? st.week : f === "blocked" ? st.blocked : f === "done" ? st.done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")) : f === "created" ? all.filter((t) => t.created_by === s.profile.id && t.owner_id !== s.profile.id) : [...st.late, ...st.open.filter((t) => !st.late.includes(t))];

  return (
    <div className="fade-in">
      <PageHeader
        title="Meus compromissos"
        label="Accountability"
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/tarefas/nova">
              <Plus /> Nova
            </Link>
          </Button>
        }
      >
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Stat value={st.open.length} label="Pendentes" />
          <Stat value={st.late.length} label="Atrasadas" tone={st.late.length ? "alert" : "default"} />
          <Stat value={st.week.length} label="Na semana" tone={st.week.length ? "amber" : "default"} />
          <Stat value={st.onTimeRate == null ? "—" : `${st.onTimeRate}%`} label="No prazo" tone="green" />
        </div>
        <div className="scroll-x -mx-4 mt-4 flex gap-1 px-4 md:mx-0 md:px-0">
          {FILTERS.map((x) => (
            <Link key={x.key} href={`/tarefas?f=${x.key}`} className={cn("shrink-0 border px-3 py-2 text-[12px] font-bold", f === x.key ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-2")}>
              {x.label}
              {x.key === "late" && st.late.length ? <span className="ml-1 text-alert">{st.late.length}</span> : null}
            </Link>
          ))}
        </div>
      </PageHeader>
      <Container className="py-4">
        {list.length === 0 ? (
          <EmptyState title={f === "late" ? "Nenhuma tarefa atrasada" : "Nada por aqui"} description={f === "open" ? "Suas tarefas do COMEX aparecem aqui. Crie uma ou aguarde as decisões da próxima reunião." : undefined} icon={<CheckSquare />} />
        ) : (
          <div className="divide-y divide-surface-2 overflow-hidden rounded-[14px] border border-line bg-surface">
            {list.map((t) => (
              <TaskListItem key={t.id} task={t} today={today} showOwner={f === "created"} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
