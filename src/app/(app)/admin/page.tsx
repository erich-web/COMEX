import Link from "next/link";
import { ArrowRight, Inbox, Users, Store, CheckSquare, Link2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNextMeeting, getUnits, getUnitsRevenueSnapshot } from "@/lib/queries";
import { todaySP, weekStart } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card, Stat } from "@/components/ui/primitives";
import { fmtBRL, fmtDate } from "@/lib/format";
import { LinkOwnersButton, ConvertReflection } from "./actions-ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Painel do CEO" };

export default async function AdminHome() {
  await requireAdmin();
  const supabase = await createClient();
  const today = todaySP();
  const ws = weekStart(today);
  const [meeting, units, { data: tasks }, { data: inbox }, { data: checkins }, { data: reflections }, { data: profiles }] = await Promise.all([
    getNextMeeting(),
    getUnits(),
    supabase.from("tasks").select("id,status,due_date,owner_id,unit_id,completed_at,legacy_owner_text,created_at").is("deleted_at", null),
    supabase.from("agenda_items").select("id,status").in("status", ["received", "in_review", "returned", "approved"]).is("deleted_at", null),
    supabase.from("weekly_checkins").select("unit_id").eq("week_start", ws),
    supabase.from("weekly_reflections").select("id,text,created_at,converted_to,profile:profiles(short_name)").is("converted_to", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("id,short_name,full_name,role,is_active").eq("is_active", true).in("role", ["admin", "executive", "unit_lead"]),
  ]);
  const snapshot = await getUnitsRevenueSnapshot(units.map((u) => u.id));
  const all = tasks ?? [];
  const open = all.filter((t) => !["done", "cancelled"].includes(t.status));
  const late = open.filter((t) => t.due_date && t.due_date < today);
  const blocked = open.filter((t) => t.status === "blocked");
  const done = all.filter((t) => t.status === "done");
  const onTime = done.filter((t) => !t.due_date || !t.completed_at || t.completed_at.slice(0, 10) <= t.due_date);
  const unlinked = all.filter((t) => !t.owner_id && t.legacy_owner_text).length;
  const checked = new Set((checkins ?? []).map((c) => c.unit_id));

  const byPerson = (profiles ?? [])
    .map((p) => {
      const mine = all.filter((t) => t.owner_id === p.id);
      const o = mine.filter((t) => !["done", "cancelled"].includes(t.status));
      const l = o.filter((t) => t.due_date && t.due_date < today);
      const d = mine.filter((t) => t.status === "done");
      const ot = d.filter((t) => !t.due_date || !t.completed_at || t.completed_at.slice(0, 10) <= t.due_date);
      return { p, open: o.length, late: l.length, blocked: o.filter((t) => t.status === "blocked").length, done: d.length, rate: d.length ? Math.round((ot.length / d.length) * 100) : null };
    })
    .sort((a, b) => b.late - a.late || b.open - a.open);

  return (
    <div className="fade-in">
      <PageHeader title="Painel do CEO" label="Visão consolidada" dark>
        {meeting ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-offwhite/60">Próximo COMEX: {fmtDate(meeting.series_date, { weekday: "long", day: "2-digit", month: "short" })}</span>
            <Badge variant={meeting.status === "published" ? "green" : "light"}>{meeting.status === "published" ? "Agenda publicada" : "Em preparação"}</Badge>
            <Link href="/admin/pautas" className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-green">
              Organizar <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : null}
      </PageHeader>
      <Container className="space-y-6 pt-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Link href="/admin/pautas">
            <Stat value={(inbox ?? []).length} label="Pautas a organizar" tone={(inbox ?? []).length ? "amber" : "default"} />
          </Link>
          <Link href="/admin/tarefas?f=late">
            <Stat value={late.length} label="Tarefas atrasadas" tone={late.length ? "alert" : "default"} />
          </Link>
          <Stat value={blocked.length} label="Bloqueadas" tone={blocked.length ? "alert" : "default"} />
          <Stat value={done.length ? `${Math.round((onTime.length / done.length) * 100)}%` : "—"} label="Entregas no prazo" tone="green" />
        </div>

        {unlinked > 0 ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-amber/40 bg-amber/10">
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="size-4 text-amber" /> {unlinked} tarefas importadas sem responsável vinculado a um perfil.
            </div>
            <LinkOwnersButton />
          </Card>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="section-label">Accountability por pessoa</div>
            <Link href="/admin/tarefas" className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">
              Ver tarefas
            </Link>
          </div>
          <div className="divide-y divide-line border border-line bg-surface">
            {byPerson.map(({ p, open, late, blocked, done, rate }) => (
              <Link key={p.id} href={`/admin/tarefas?owner=${p.id}`} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2.5 text-sm hover:bg-black/[0.03]">
                <span className="truncate font-medium">{p.short_name ?? p.full_name}</span>
                <span className="t-label w-14 text-right">
                  <span className="t-display text-base text-ink">{open}</span> abertas
                </span>
                <span className={cn("t-label w-16 text-right", late && "text-alert")}>
                  <span className={cn("t-display text-base", late ? "text-alert" : "text-ink")}>{late}</span> atras.
                </span>
                <span className={cn("t-label w-14 text-right", blocked && "text-alert")}>
                  <span className="t-display text-base text-ink">{blocked}</span> bloq.
                </span>
                <span className="t-label w-16 text-right">
                  <span className="t-display text-base text-green-dark">{rate == null ? "—" : `${rate}%`}</span> prazo
                </span>
              </Link>
            ))}
            {byPerson.length === 0 ? <div className="px-3 py-4 text-sm text-mute">Nenhum executivo ativo ainda. Convide em Usuários.</div> : null}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="section-label">Unidades — semana de {fmtDate(ws, { day: "2-digit", month: "short" })}</div>
            <Link href="/admin/unidades" className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">
              Configurar
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {units.map((u) => {
              const r = snapshot.find((x) => x.unit_id === u.id);
              const vs = r?.value != null && r.budget_value ? ((r.value - r.budget_value) / r.budget_value) * 100 : null;
              const uOpen = open.filter((t) => t.unit_id === u.id).length;
              const uLate = late.filter((t) => t.unit_id === u.id).length;
              return (
                <Link key={u.id} href={`/unidades/${u.slug}`} className="border border-line bg-surface p-3 hover:border-black">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-display text-lg">{u.name}</span>
                    <div className="flex gap-1">
                      {!r?.period_start || r.period_start < ws ? <Badge variant="amber">KPIs</Badge> : null}
                      {!checked.has(u.id) ? <Badge variant="amber">Check-in</Badge> : <Badge variant="greenSoft">OK</Badge>}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-mute">
                    <span className="tabular">{r?.value != null ? fmtBRL(r.value) : "Receita não inf."}</span>
                    {vs != null ? <span className={cn("font-semibold tabular", vs >= 0 ? "text-green-dark" : "text-alert")}>{`${vs >= 0 ? "+" : ""}${vs.toFixed(1)}% vs orç.`}</span> : null}
                    <span>
                      {uOpen} tarefas{uLate ? <span className="text-alert"> · {uLate} atrasadas</span> : null}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {(reflections ?? []).length ? (
          <section>
            <div className="section-label mb-2">Reflexões da semana (ideias dos executivos)</div>
            <div className="divide-y divide-line border border-line bg-surface">
              {reflections!.map((r) => (
                <div key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-sm italic">“{r.text}”</p>
                    <div className="mt-0.5 text-[11px] text-mute">
                      {r.profile?.short_name} · {fmtDate(r.created_at, { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <ConvertReflection id={r.id} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { href: "/admin/pautas", icon: Inbox, label: "Pautas" },
            { href: "/admin/tarefas", icon: CheckSquare, label: "Tarefas" },
            { href: "/admin/usuarios", icon: Users, label: "Usuários" },
            { href: "/admin/unidades", icon: Store, label: "Unidades" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-2 border border-line bg-surface px-3 py-3 text-[11px] font-bold uppercase tracking-[0.1em] hover:border-black">
              <l.icon className="size-4" /> {l.label}
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
}
