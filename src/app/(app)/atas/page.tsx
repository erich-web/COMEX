import Link from "next/link";
import { FileText, Search, ExternalLink, ChevronRight } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Atas" };

export default async function AtasPage({ searchParams }: PageProps<"/atas">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = typeof sp.f === "string" ? sp.f : "all"; // all | decisions | mine | year
  const s = await requireMember();
  const supabase = await createClient();
  const year = new Date().getFullYear();

  let query = supabase
    .from("meetings")
    .select("id,series_date,title,status,minutes:meeting_minutes(id,title,status,drive_url,content,summary), decisions:meeting_decisions(id), tasks:tasks(id,owner_id,unit_id,status)")
    .in("status", ["closed", "in_progress"])
    .order("series_date", { ascending: false })
    .limit(150);
  if (filter === "year") query = query.gte("series_date", `${year}-01-01`);
  const { data } = await query;
  let meetings = data ?? [];
  const myUnitIds = new Set(s.units.map((u) => u.unit_id));

  if (filter === "decisions") meetings = meetings.filter((m) => (m.decisions?.length ?? 0) > 0);
  if (filter === "mine") meetings = meetings.filter((m) => (m.tasks ?? []).some((t) => t.owner_id === s.profile.id || (t.unit_id && myUnitIds.has(t.unit_id))));
  if (q) {
    const needle = q.toLowerCase();
    meetings = meetings.filter((m) => `${m.title} ${m.minutes?.title ?? ""} ${m.minutes?.summary ?? ""} ${m.minutes?.content ?? ""}`.toLowerCase().includes(needle));
  }

  const chips = [
    { key: "all", label: "Todas" },
    { key: "decisions", label: "Com decisões" },
    { key: "mine", label: "Minha unidade" },
    { key: "year", label: String(year) },
  ];
  const [latest, ...rest] = meetings;

  return (
    <div className="fade-in">
      <PageHeader title="Atas">
        <form className="mt-3 flex flex-col gap-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-mute" />
            <input name="q" defaultValue={q} placeholder="Buscar decisão, tema ou unidade…" aria-label="Buscar nas atas" className="h-11 w-full rounded-[12px] border border-line-2 bg-bg pl-10 pr-3 text-[15px] focus:border-primary focus:outline-none" />
            <input type="hidden" name="f" value={filter} />
          </label>
          <div className="scroll-x flex gap-2">
            {chips.map((c) => (
              <Link key={c.key} href={`/atas?f=${c.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[12px] font-medium", filter === c.key ? "border-primary bg-primary-soft font-semibold text-primary-ink" : "border-line-2 bg-surface text-ink-2")}>
                {c.label}
              </Link>
            ))}
          </div>
        </form>
      </PageHeader>

      <div className="mx-auto max-w-3xl space-y-3 px-4 py-4 md:px-8">
        {meetings.length === 0 ? (
          <EmptyState title="Nenhuma ata encontrada" description={q ? "Tente outra palavra." : "As atas aparecem aqui depois que a reunião é encerrada."} icon={<FileText />} />
        ) : (
          <>
            {latest && !q && filter === "all" ? <LatestCard m={latest} isAdmin={s.isAdmin} myId={s.profile.id} /> : null}
            {(latest && !q && filter === "all" ? rest : meetings).map((m) => (
              <Link key={m.id} href={`/atas/${m.id}`} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-mute">{fmtDate(m.series_date, { day: "2-digit", month: "short", year: "numeric" })}</div>
                  <div className="mt-0.5 text-[15px] font-semibold leading-snug">{m.minutes?.title || m.title}</div>
                  <div className="mt-0.5 text-[12px] text-mute">
                    {m.decisions?.length ? `${m.decisions.length} decisões` : "sem decisões registradas"}
                    {m.tasks?.length ? ` · ${m.tasks.length} compromissos` : ""}
                    {!m.minutes ? " · sem ata" : m.minutes.status !== "approved" ? " · rascunho" : ""}
                  </div>
                </div>
                {m.minutes?.drive_url ? <ExternalLink className="size-4 shrink-0 text-mute" /> : null}
                <ChevronRight className="size-[18px] shrink-0 text-line-2" />
              </Link>
            ))}
            <p className="pt-2 text-center text-[12px] text-mute">Histórico completo · {meetings.length} reuniões</p>
          </>
        )}
      </div>
    </div>
  );
}

function LatestCard({ m, isAdmin, myId }: { m: { id: string; series_date: string; title: string; minutes: { title: string | null; status: string; drive_url: string | null; summary: string | null } | null; decisions: { id: string }[] | null; tasks: { owner_id: string | null; status: string }[] | null }; isAdmin: boolean; myId: string }) {
  const minePending = (m.tasks ?? []).filter((t) => t.owner_id === myId && !["done", "cancelled"].includes(t.status)).length;
  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-mute">{fmtDate(m.series_date, { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}</div>
        <Badge variant="green">Última</Badge>
      </div>
      <div className="mt-2 text-[16px] font-bold leading-snug">{m.minutes?.title || m.title}</div>
      {m.minutes?.summary ? <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{m.minutes.summary}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="soft">{m.decisions?.length ?? 0} decisões</Badge>
        <Badge variant="soft">{m.tasks?.length ?? 0} compromissos</Badge>
        {minePending ? <Badge variant="amber">{minePending} pendentes seus</Badge> : null}
      </div>
      <div className="mt-3 flex gap-2">
        <Button asChild variant="primary" size="sm" className="flex-1">
          <Link href={`/atas/${m.id}`}>Ler ata</Link>
        </Button>
        {m.minutes?.drive_url ? (
          <Button asChild variant="outline" size="sm" className="flex-1">
            <a href={m.minutes.drive_url} target="_blank" rel="noreferrer">
              PDF no Drive
            </a>
          </Button>
        ) : isAdmin ? (
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/admin/reunioes/${m.id}/ata`}>{m.minutes ? "Editar ata" : "Criar ata"}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
