import Link from "next/link";
import { CalendarDays, Presentation, Settings2 } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNextMeeting, getSettings, getWeeklyPrompt } from "@/lib/queries";
import { computeSchedule } from "@/lib/agenda";
import { clockMinutesSP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { GoalBanner } from "@/components/app/goal-banner";
import { MEETING_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { AgendaTimeline } from "@/components/app/agenda-timeline";

export const metadata = { title: "Próximo COMEX" };

export default async function ProximoComexPage() {
  const s = await requireMember();
  const supabase = await createClient();
  const [meeting, prompt, settings] = await Promise.all([getNextMeeting(), getWeeklyPrompt(), getSettings()]);
  if (!meeting) {
    return (
      <div>
        <PageHeader title="Próximo COMEX" label="Agenda" />
        <Container className="py-4">
          <EmptyState title="Nenhuma reunião programada" icon={<CalendarDays />} />
        </Container>
      </div>
    );
  }
  const published = meeting.status !== "preparing";
  const [{ data: blocks }, { data: items }, { data: units }] = await Promise.all([
    supabase.from("meeting_blocks").select("*").eq("meeting_id", meeting.id).order("sort_order"),
    published || s.isAdmin
      ? supabase.from("agenda_items").select("id,title,category,block_id,allotted_minutes,suggested_minutes,sort_order,requires_decision,unit:business_units(name),presenter:profiles!agenda_items_presenter_id_fkey(short_name,full_name),author:profiles!agenda_items_submitted_by_fkey(short_name,full_name),links").eq("meeting_id", meeting.id).eq("status", "scheduled").is("deleted_at", null).order("sort_order")
      : Promise.resolve({ data: [] }),
    meeting.review_unit_ids.length ? supabase.from("business_units").select("id,name,slug").in("id", meeting.review_unit_ids) : Promise.resolve({ data: [] }),
  ]);
  const schedule = computeSchedule(clockMinutesSP(meeting.scheduled_at), meeting.duration_minutes, blocks ?? [], (items ?? []).map((i) => ({ id: i.id, block_id: i.block_id, allotted_minutes: i.allotted_minutes, suggested_minutes: i.suggested_minutes, sort_order: i.sort_order })));

  return (
    <div className="fade-in">
      <PageHeader
        title={`COMEX ${fmtDate(meeting.series_date, { day: "2-digit", month: "short" })}`}
        label={`${fmtDate(meeting.series_date, { weekday: "long" })} · ${fmtTime(meeting.scheduled_at)}–${schedule.endClock}`}
        action={<Badge variant={published ? "green" : "soft"}>{MEETING_STATUS_LABELS[meeting.status]}</Badge>}
        dark
      >
        {s.isAdmin ? (
          <div className="mt-3 flex gap-2">
            <Button asChild variant="green" size="sm">
              <Link href={`/apresentar/${meeting.id}`}>
                <Presentation /> Modo reunião
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-white/30 text-white">
              <Link href={`/admin/reunioes/${meeting.id}`}>
                <Settings2 /> Organizar
              </Link>
            </Button>
          </div>
        ) : null}
      </PageHeader>
      <GoalBanner compact goal={settings.goal2030.revenue_target} prompt={prompt?.text} className="border-t border-line" />
      <Container className="space-y-5 pt-5">
        {!published ? (
          <Card className="border-amber/40 bg-amber/10">
            <p className="text-sm">
              A agenda ainda está em preparação. Pautas podem ser enviadas até <strong>{settings.agendaDeadline.label.toLowerCase()}</strong>; o administrador publica a ordem final, horários e apresentadores.
            </p>
            <Link href="/pautas/nova" className="mt-2 inline-block text-[13px] font-semibold text-primary">
              Enviar pautas →
            </Link>
          </Card>
        ) : null}
        {(units ?? []).length ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="t-label">Business Review em profundidade:</span>
            {(units ?? []).map((u) => (
              <span key={u.id} className="rounded-md bg-primary-soft px-2 py-1 text-[12px] font-semibold text-primary-ink">
                {u.name}
              </span>
            ))}
          </div>
        ) : null}
        <AgendaTimeline
          schedule={schedule}
          items={(items ?? []).map((i) => ({
            id: i.id,
            title: i.title,
            category: CATEGORY_LABELS[i.category],
            minutes: i.allotted_minutes ?? i.suggested_minutes ?? null,
            presenter: i.presenter?.short_name ?? i.presenter?.full_name ?? i.author?.short_name ?? i.author?.full_name ?? null,
            unit: i.unit?.name ?? null,
            requiresDecision: i.requires_decision,
            links: (i.links as { label?: string; url: string }[]) ?? [],
          }))}
          showItems={published || s.isAdmin}
        />
        {meeting.notes ? (
          <Card>
            <div className="t-label mb-1">Orientações</div>
            <p className="whitespace-pre-wrap text-sm">{meeting.notes}</p>
          </Card>
        ) : null}
      </Container>
    </div>
  );
}
