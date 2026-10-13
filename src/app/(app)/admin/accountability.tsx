import Link from "next/link";
import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todaySP } from "@/lib/dates";
import { LinkOwnersButton } from "./actions-ui";
import { cn } from "@/lib/utils";

/** Accountability por pessoa — entregas no prazo, pendências e atrasos. */
export async function AccountabilityByPerson() {
  const supabase = await createClient();
  const today = todaySP();
  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase.from("tasks").select("id,status,due_date,owner_id,completed_at,legacy_owner_text").is("deleted_at", null),
    supabase.from("profiles").select("id,short_name,full_name").eq("is_active", true).in("role", ["admin", "executive", "unit_lead"]),
  ]);
  const all = tasks ?? [];
  const unlinked = all.filter((t) => !t.owner_id && t.legacy_owner_text && !["done", "cancelled"].includes(t.status)).length;
  const byPerson = (profiles ?? [])
    .map((p) => {
      const mine = all.filter((t) => t.owner_id === p.id);
      const o = mine.filter((t) => !["done", "cancelled"].includes(t.status));
      const l = o.filter((t) => t.due_date && t.due_date < today);
      const d = mine.filter((t) => t.status === "done");
      const ot = d.filter((t) => !t.due_date || !t.completed_at || t.completed_at.slice(0, 10) <= t.due_date);
      return { p, open: o.length, late: l.length, blocked: o.filter((t) => t.status === "blocked").length, done: d.length, rate: d.length ? Math.round((ot.length / d.length) * 100) : null };
    })
    .filter((r) => r.open || r.done)
    .sort((a, b) => b.late - a.late || b.open - a.open);

  return (
    <section className="space-y-2">
      {unlinked > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-amber/40 bg-amber-soft px-3 py-2 text-[13px] text-amber">
          <span className="inline-flex items-center gap-2">
            <Link2 className="size-4" /> {unlinked} compromissos importados ainda sem responsável vinculado a um perfil.
          </span>
          <LinkOwnersButton />
        </div>
      ) : null}
      <div className="text-[13px] font-semibold text-mute">Accountability por pessoa</div>
      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-bg text-[11px] font-semibold uppercase tracking-[0.05em] text-mute">
            <tr>
              <th className="px-3 py-2 text-left">Pessoa</th>
              <th className="px-3 py-2 text-right">Abertos</th>
              <th className="px-3 py-2 text-right">Atrasados</th>
              <th className="px-3 py-2 text-right">Bloqueados</th>
              <th className="px-3 py-2 text-right">Concluídos</th>
              <th className="px-3 py-2 text-right">No prazo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-2">
            {byPerson.map(({ p, open, late, blocked, done, rate }) => (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/admin/tarefas?owner=${p.id}`}>{p.short_name ?? p.full_name}</Link>
                </td>
                <td className="px-3 py-2 text-right tabular">{open}</td>
                <td className={cn("px-3 py-2 text-right tabular", late && "font-bold text-alert")}>{late}</td>
                <td className={cn("px-3 py-2 text-right tabular", blocked && "text-amber")}>{blocked}</td>
                <td className="px-3 py-2 text-right tabular">{done}</td>
                <td className="px-3 py-2 text-right tabular">{rate == null ? "—" : `${rate}%`}</td>
              </tr>
            ))}
            {byPerson.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-mute">
                  Nenhum compromisso atribuído ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
