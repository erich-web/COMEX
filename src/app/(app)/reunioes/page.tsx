import Link from "next/link";
import { FileText, Search, ExternalLink } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, EmptyState, Input, Select } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Reuniões e atas" };

export default async function ReunioesPage({ searchParams }: PageProps<"/reunioes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const unit = typeof sp.unidade === "string" ? sp.unidade : "";
  const exec = typeof sp.exec === "string" ? sp.exec : "";
  const from = typeof sp.de === "string" ? sp.de : "";
  const to = typeof sp.ate === "string" ? sp.ate : "";
  const s = await requireMember();
  const supabase = await createClient();
  const [units, profiles] = await Promise.all([getUnits(), getProfiles()]);

  let query = supabase.from("meetings").select("id,series_date,title,status,minutes:meeting_minutes(id,title,status,drive_url,content), decisions:meeting_decisions(id), tasks:tasks(id)").in("status", ["closed", "in_progress", "published"]).order("series_date", { ascending: false }).limit(120);
  if (from) query = query.gte("series_date", from);
  if (to) query = query.lte("series_date", to);
  const { data } = await query;
  let meetings = data ?? [];

  // filtros por unidade/executivo via tarefas e decisões
  if (unit || exec) {
    let tq = supabase.from("tasks").select("meeting_id").not("meeting_id", "is", null);
    if (unit) tq = tq.eq("unit_id", unit);
    if (exec) tq = tq.eq("owner_id", exec);
    const { data: t } = await tq;
    const ids = new Set((t ?? []).map((x) => x.meeting_id));
    meetings = meetings.filter((m) => ids.has(m.id));
  }
  if (q) {
    const needle = q.toLowerCase();
    meetings = meetings.filter((m) => `${m.title} ${m.minutes?.title ?? ""} ${m.minutes?.content ?? ""}`.toLowerCase().includes(needle));
  }
  void s;

  return (
    <div className="fade-in">
      <PageHeader title="Reuniões e atas" label="Histórico do COMEX">
        <form className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="relative col-span-2 md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
            <Input name="q" defaultValue={q} placeholder="Buscar nas atas…" className="pl-9" />
          </div>
          <Select name="unidade" defaultValue={unit}>
            <option value="">Todas as unidades</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select name="exec" defaultValue={exec}>
            <option value="">Todos os executivos</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short_name ?? p.full_name}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input type="date" name="de" defaultValue={from} aria-label="De" />
            <Input type="date" name="ate" defaultValue={to} aria-label="Até" />
          </div>
          <button className="col-span-2 h-11 bg-black text-[11px] font-bold uppercase tracking-[0.12em] text-offwhite md:col-span-1">Filtrar</button>
        </form>
      </PageHeader>
      <Container>
        {meetings.length === 0 ? (
          <EmptyState title="Nenhuma reunião encontrada" icon={<FileText />} />
        ) : (
          <div className="divide-y divide-line border border-line bg-surface">
            {meetings.map((m) => {
              const hasMinutes = !!m.minutes && (m.minutes.status === "approved" || s.isAdmin);
              return (
                <Link key={m.id} href={`/reunioes/${m.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-black/[0.03]">
                  <div className="w-14 shrink-0 text-center">
                    <div className="t-display text-2xl leading-none">{m.series_date.slice(8, 10)}</div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-mute">{fmtDate(m.series_date, { month: "short" })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.minutes?.title || m.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-mute">
                      <span>{fmtDate(m.series_date, { year: "numeric", weekday: "short" })}</span>
                      {m.decisions?.length ? <span>· {m.decisions.length} decisões</span> : null}
                      {m.tasks?.length ? <span>· {m.tasks.length} tarefas</span> : null}
                      {m.minutes?.drive_url ? (
                        <span className="inline-flex items-center gap-0.5">
                          · <ExternalLink className="size-3" /> Drive
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {hasMinutes ? <Badge variant={m.minutes!.status === "approved" ? "green" : "amber"}>{m.minutes!.status === "approved" ? "Ata" : "Rascunho"}</Badge> : <Badge variant="soft">Sem ata</Badge>}
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
