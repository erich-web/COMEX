import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLastClosedMeeting, getNextMeeting, getProfiles, getUnits } from "@/lib/queries";
import { similarity } from "@/lib/agenda";
import { todaySP } from "@/lib/dates";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/primitives";
import { MEETING_STATUS_LABELS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { OrganizeBoard, type BoardItem } from "./pautas/board";
import { cn } from "@/lib/utils";

export const metadata = { title: "Organizar a reunião" };

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const today = todaySP();
  const [next, last] = await Promise.all([getNextMeeting(), getLastClosedMeeting()]);
  const meetingId = typeof sp.reuniao === "string" ? sp.reuniao : next?.id;
  const [{ data: meeting }, { data: meetings }, profiles, units] = await Promise.all([
    meetingId ? supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("meetings").select("id,series_date,status").in("status", ["preparing", "published", "in_progress"]).order("series_date").limit(8),
    getProfiles(),
    getUnits(),
  ]);
  const [{ data: blocks }, { data: items }, { data: discussed }, { data: lastTasks }] = await Promise.all([
    meeting ? supabase.from("meeting_blocks").select("*").eq("meeting_id", meeting.id).order("sort_order") : Promise.resolve({ data: [] }),
    supabase
      .from("agenda_items")
      .select("*, unit:business_units(name,slug), author:profiles!agenda_items_submitted_by_fkey(id,short_name,full_name), presenter:profiles!agenda_items_presenter_id_fkey(id,short_name), comments:agenda_comments(id)")
      .is("deleted_at", null)
      .or(`status.in.(received,in_review,returned,approved,postponed),meeting_id.eq.${meeting?.id ?? "00000000-0000-0000-0000-000000000000"}`)
      .order("priority", { ascending: false })
      .order("created_at"),
    supabase.from("agenda_items").select("id,title,discussed_at,meeting:meetings(series_date)").eq("status", "discussed").order("discussed_at", { ascending: false }).limit(300),
    last ? supabase.from("tasks").select("id,status,due_date").eq("meeting_id", last.id).is("deleted_at", null) : Promise.resolve({ data: [] as { id: string; status: string; due_date: string | null }[] }),
  ]);

  const list = (items ?? []).filter((i) => i.status !== "discussed" && i.status !== "archived");
  const boardItems: BoardItem[] = list.map((i) => {
    const dupPending = list.filter((o) => o.id !== i.id && similarity(i.title, o.title) >= 0.5).map((o) => o.title);
    const dupPast = (discussed ?? []).filter((o) => similarity(i.title, o.title) >= 0.6).map((o) => `${o.title} (${o.meeting?.series_date ? fmtDate(o.meeting.series_date, { day: "2-digit", month: "short" }) : "discutida"})`);
    return {
      id: i.id,
      title: i.title,
      description: i.description,
      key_question: i.key_question,
      category: i.category,
      urgency: i.urgency,
      status: i.status,
      unit: i.unit ? (i.unit.slug === "grupo-holding" ? "Grupo" : i.unit.name) : null,
      unit_id: i.unit_id,
      author: i.author?.short_name ?? i.author?.full_name ?? "",
      author_id: i.author?.id ?? i.submitted_by,
      presenter_id: i.presenter?.id ?? null,
      requires_decision: i.requires_decision,
      suggested_minutes: i.suggested_minutes,
      allotted_minutes: i.allotted_minutes,
      block_id: i.block_id,
      meeting_id: i.meeting_id,
      sort_order: i.sort_order,
      priority: i.priority,
      admin_notes: i.admin_notes,
      return_reason: i.return_reason,
      expected_outcome: i.expected_outcome,
      problem: i.problem,
      proposed_solution: i.proposed_solution,
      created_at: i.created_at,
      comments: i.comments?.length ?? 0,
      duplicates: [...dupPending.slice(0, 2), ...dupPast.slice(0, 2)],
    };
  });

  // tiles do topo
  const received = boardItems.filter((i) => ["received", "in_review", "approved", "returned"].includes(i.status) && !i.block_id);
  const authors = new Set(received.map((i) => i.author_id)).size;
  const requested = boardItems.filter((i) => i.status !== "postponed").reduce((a, i) => a + (i.allotted_minutes ?? i.suggested_minutes ?? 10), 0);
  const available = (blocks ?? []).filter((b) => !["opening", "closing", "accountability", "business_review"].includes(b.kind)).reduce((a, b) => a + b.duration_minutes, 0);
  const lt = lastTasks ?? [];
  const lateLast = lt.filter((t) => !["done", "cancelled"].includes(t.status) && t.due_date && t.due_date < today).length;

  return (
    <div className="fade-in">
      <PageHeader
        title="Organizar a reunião"
        label={meeting ? `${fmtDate(meeting.series_date, { weekday: "long", day: "2-digit", month: "short" })} · ${fmtTime(meeting.scheduled_at)}` : "Próxima terça"}
        action={meeting ? <Badge variant={meeting.status === "published" ? "green" : "soft"}>{MEETING_STATUS_LABELS[meeting.status]}</Badge> : undefined}
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(meetings ?? []).map((m) => (
            <Link key={m.id} href={`/admin?reuniao=${m.id}`} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-medium", m.id === meeting?.id ? "border-primary bg-primary-soft font-semibold text-primary-ink" : "border-line-2 bg-surface text-ink-2")}>
              {fmtDate(m.series_date, { day: "2-digit", month: "short" })}
            </Link>
          ))}
          {meeting ? (
            <Link href={`/admin/reunioes/${meeting.id}`} className="ml-auto text-[12px] font-semibold text-primary">
              Blocos, participantes e ata
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <div className="space-y-4 px-4 py-4 md:px-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Pautas recebidas" value={String(received.length)} suffix={authors ? `de ${authors} ${authors === 1 ? "pessoa" : "pessoas"}` : undefined} />
          <Tile label="Tempo pedido vs. disponível" value={String(requested)} suffix={`/ ${available} min`} tone={requested > available ? "amber" : undefined} />
          <Tile label="Compromissos da última ata" value={String(lt.length)} suffix={lateLast ? `· ${lateLast} atrasados` : "· em dia"} tone={lateLast ? "alert" : undefined} href="/admin/tarefas" />
        </div>

        {meeting ? (
          <OrganizeBoard
            meeting={{ id: meeting.id, series_date: meeting.series_date, status: meeting.status, startClock: fmtTime(meeting.scheduled_at), duration: meeting.duration_minutes }}
            blocks={(blocks ?? []).map((b) => ({ id: b.id, title: b.title, kind: b.kind, duration_minutes: b.duration_minutes, sort_order: b.sort_order }))}
            items={boardItems}
            profiles={profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))}
            units={units.map((u) => ({ id: u.id, name: u.name }))}
          />
        ) : (
          <p className="text-sm text-mute">Nenhuma reunião futura. Crie em Configurações → Calendário.</p>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, suffix, tone, href }: { label: string; value: string; suffix?: string; tone?: "amber" | "alert"; href?: string }) {
  const inner = (
    <>
      <div className="text-[12px] font-medium text-mute">{label}</div>
      <div className={cn("mt-0.5 text-2xl font-bold tabular", tone === "amber" && "text-amber", tone === "alert" && "text-alert")}>
        {value} {suffix ? <span className={cn("text-[13px] font-medium", tone === "alert" ? "text-alert" : "text-mute")}>{suffix}</span> : null}
      </div>
    </>
  );
  const cls = "block rounded-[12px] border border-line bg-surface px-4 py-3";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-surface-2")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
