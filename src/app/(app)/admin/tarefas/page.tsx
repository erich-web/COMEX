import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getUnits, type TaskRow } from "@/lib/queries";
import { todaySP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { EmptyState, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { TaskListItem } from "@/components/app/task-item";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tarefas de todos" };

export default async function AdminTarefasPage({ searchParams }: PageProps<"/admin/tarefas">) {
  const sp = await searchParams;
  const f = typeof sp.f === "string" ? sp.f : "open";
  const owner = typeof sp.owner === "string" ? sp.owner : "";
  const unit = typeof sp.unit === "string" ? sp.unit : "";
  await requireAdmin();
  const supabase = await createClient();
  const today = todaySP();
  const [profiles, units] = await Promise.all([getProfiles(), getUnits()]);
  let q = supabase.from("tasks").select("*, owner:profiles!tasks_owner_id_fkey(id,short_name,full_name), unit:business_units(id,name)").is("deleted_at", null).order("due_date", { ascending: true, nullsFirst: false }).limit(500);
  if (owner === "none") q = q.is("owner_id", null);
  else if (owner) q = q.eq("owner_id", owner);
  if (unit) q = q.eq("unit_id", unit);
  if (f === "open") q = q.not("status", "in", '("done","cancelled")');
  if (f === "late") q = q.not("status", "in", '("done","cancelled")').lt("due_date", today);
  if (f === "blocked") q = q.eq("status", "blocked");
  if (f === "done") q = q.eq("status", "done").order("completed_at", { ascending: false });
  if (f === "nodate") q = q.not("status", "in", '("done","cancelled")').is("due_date", null);
  const { data } = await q;
  const list = (data ?? []) as TaskRow[];
  const FILTERS = [
    ["open", "Abertas"],
    ["late", "Atrasadas"],
    ["blocked", "Bloqueadas"],
    ["nodate", "Sem prazo"],
    ["done", "Concluídas"],
  ];
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ f, owner, unit, ...patch });
    [...p.keys()].forEach((k) => !p.get(k) && p.delete(k));
    return `/admin/tarefas?${p.toString()}`;
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Tarefas de todos"
        label="Accountability consolidado"
        back="/admin"
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/tarefas/nova">
              <Plus /> Nova
            </Link>
          </Button>
        }
      >
        <form className="mt-3 grid grid-cols-2 gap-2">
          <input type="hidden" name="f" value={f} />
          <Select name="owner" defaultValue={owner}>
            <option value="">Todos os responsáveis</option>
            <option value="none">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short_name ?? p.full_name}
              </option>
            ))}
          </Select>
          <Select name="unit" defaultValue={unit}>
            <option value="">Todas as unidades</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <button className="col-span-2 h-10 border border-black text-[11px] font-bold uppercase tracking-[0.12em]">Aplicar filtros</button>
        </form>
        <div className="scroll-x -mx-4 mt-3 flex gap-1 px-4 md:mx-0 md:px-0">
          {FILTERS.map(([k, l]) => (
            <Link key={k} href={qs({ f: k })} className={cn("shrink-0 border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em]", f === k ? "border-black bg-black text-offwhite" : "border-line bg-surface text-ink-2")}>
              {l}
            </Link>
          ))}
        </div>
      </PageHeader>
      <Container>
        <div className="mb-2 text-xs text-mute">{list.length} tarefa(s)</div>
        {list.length === 0 ? (
          <EmptyState title="Nada aqui" />
        ) : (
          <div className="divide-y divide-line border border-line bg-surface">
            {list.map((t) => (
              <TaskListItem key={t.id} task={t} today={today} showOwner />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
