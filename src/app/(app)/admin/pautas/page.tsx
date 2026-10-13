import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNextMeeting, getProfiles, getUnits } from "@/lib/queries";
import { computeSchedule, similarity } from "@/lib/agenda";
import { clockMinutesSP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge } from "@/components/ui/primitives";
import { MEETING_STATUS_LABELS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { OrganizeBoard, type BoardItem } from "./board";

export const metadata = { title: "Organizar pautas" };

export default async function AdminPautasPage({ searchParams }: PageProps<"/admin/pautas">) {
  const sp = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const next = await getNextMeeting();
  const meetingId = typeof sp.reuniao === "string" ? sp.reuniao : next?.id;
  const [{ data: meeting }, { data: meetings }, profiles, units] = await Promise.all([
    meetingId ? supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("meetings").select("id,series_date,status").in("status", ["preparing", "published", "in_progress"]).order("series_date").limit(8),
    getProfiles(),
    getUnits(),
  ]);
  const [{ data: blocks }, { data: items }, { data: discussed }] = await Promise.all([
    meeting ? supabase.from("meeting_blocks").select("*").eq("meeting_id", meeting.id).order("sort_order") : Promise.resolve({ data: [] }),
    supabase
      .from("agenda_items")
      .select("*, unit:business_units(name), author:profiles!agenda_items_submitted_by_fkey(id,short_name,full_name), presenter:profiles!agenda_items_presenter_id_fkey(id,short_name), comments:agenda_comments(id)")
      .is("deleted_at", null)
      .or(`status.in.(received,in_review,returned,approved,postponed),meeting_id.eq.${meeting?.id ?? "00000000-0000-0000-0000-000000000000"}`)
      .order("priority", { ascending: false })
      .order("created_at"),
    supabase.from("agenda_items").select("id,title,discussed_at,meeting:meetings(series_date)").eq("status", "discussed").order("discussed_at", { ascending: false }).limit(300),
  ]);

  const list = (items ?? []).filter((i) => i.status !== "discussed" && i.status !== "archived");
  // duplicidades: contra outras pendentes e contra já discutidas
  const boardItems: BoardItem[] = list.map((i) => {
    const dupPending = list.filter((o) => o.id !== i.id && similarity(i.title, o.title) >= 0.5).map((o) => o.title);
    const dupPast = (discussed ?? []).filter((o) => similarity(i.title, o.title) >= 0.6).map((o) => `${o.title} (${o.meeting?.series_date ? fmtDate(o.meeting.series_date, { day: "2-digit", month: "short" }) : "discutida"})`);
    return {
      id: i.id,
      title: i.title,
      description: i.description,
      category: i.category,
      urgency: i.urgency,
      status: i.status,
      unit: i.unit?.name ?? null,
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

  const schedule = meeting
    ? computeSchedule(clockMinutesSP(meeting.scheduled_at), meeting.duration_minutes, blocks ?? [], boardItems.filter((i) => i.meeting_id === meeting.id).map((i) => ({ id: i.id, block_id: i.block_id, allotted_minutes: i.allotted_minutes, suggested_minutes: i.suggested_minutes, sort_order: i.sort_order })))
    : null;

  return (
    <div className="fade-in">
      <PageHeader title="Organizar pautas" label="Administração" back="/admin">
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(meetings ?? []).map((m) => (
            <Link key={m.id} href={`/admin/pautas?reuniao=${m.id}`} className={`border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${m.id === meeting?.id ? "border-black bg-black text-offwhite" : "border-line bg-surface"}`}>
              {fmtDate(m.series_date, { day: "2-digit", month: "short" })}
            </Link>
          ))}
          {meeting ? (
            <>
              <Badge variant={meeting.status === "published" ? "green" : "soft"}>{MEETING_STATUS_LABELS[meeting.status]}</Badge>
              <Link href={`/admin/reunioes/${meeting.id}`} className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 underline">
                Blocos e configurações
              </Link>
            </>
          ) : null}
        </div>
      </PageHeader>
      <Container className="md:max-w-none">
        {meeting && schedule ? (
          <OrganizeBoard
            meeting={{ id: meeting.id, series_date: meeting.series_date, status: meeting.status, startClock: fmtTime(meeting.scheduled_at), duration: meeting.duration_minutes }}
            blocks={(blocks ?? []).map((b) => ({ id: b.id, title: b.title, kind: b.kind, duration_minutes: b.duration_minutes, sort_order: b.sort_order }))}
            items={boardItems}
            profiles={profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))}
            units={units.map((u) => ({ id: u.id, name: u.name }))}
          />
        ) : (
          <p className="text-sm text-mute">Nenhuma reunião futura. Crie em Calendário.</p>
        )}
      </Container>
    </div>
  );
}
