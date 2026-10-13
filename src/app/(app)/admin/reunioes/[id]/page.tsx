import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { MEETING_STATUS_LABELS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { MeetingSettings, BlocksEditor } from "./editors";

export const metadata = { title: "Configurar reunião" };

export default async function AdminReuniaoPage({ params }: PageProps<"/admin/reunioes/[id]">) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: m }, { data: blocks }, { data: prompts }, units, profiles, { data: participants }] = await Promise.all([
    supabase.from("meetings").select("*").eq("id", id).maybeSingle(),
    supabase.from("meeting_blocks").select("*").eq("meeting_id", id).order("sort_order"),
    supabase.from("weekly_prompts").select("id,text").eq("is_active", true).order("created_at"),
    getUnits(),
    getProfiles(),
    supabase.from("meeting_participants").select("profile_id").eq("meeting_id", id),
  ]);
  if (!m) notFound();
  return (
    <div className="fade-in">
      <PageHeader title={`COMEX ${fmtDate(m.series_date, { day: "2-digit", month: "short" })}`} label={`${fmtDate(m.series_date, { weekday: "long" })} · ${fmtTime(m.scheduled_at)} · ${m.duration_minutes} min`} back="/admin/pautas" action={<Badge variant={m.status === "published" ? "green" : "soft"}>{MEETING_STATUS_LABELS[m.status]}</Badge>}>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="primary" size="sm">
            <Link href={`/admin/pautas?reuniao=${m.id}`}>Organizar pautas</Link>
          </Button>
          <Button asChild variant="green" size="sm">
            <Link href={`/apresentar/${m.id}`}>Modo reunião</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/reunioes/${m.id}/ata`}>Ata e decisões</Link>
          </Button>
        </div>
      </PageHeader>
      <Container className="space-y-5">
        <MeetingSettings
          meeting={{ id: m.id, title: m.title, series_date: m.series_date, time: fmtTime(m.scheduled_at), duration_minutes: m.duration_minutes, status: m.status, prompt_id: m.prompt_id, review_unit_ids: m.review_unit_ids, notes: m.notes ?? "" }}
          prompts={prompts ?? []}
          units={units.map((u) => ({ id: u.id, name: u.name }))}
          profiles={profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))}
          participants={(participants ?? []).map((p) => p.profile_id)}
        />
        <BlocksEditor meetingId={m.id} startClock={fmtTime(m.scheduled_at)} duration={m.duration_minutes} initial={(blocks ?? []).map((b) => ({ id: b.id, kind: b.kind, title: b.title, duration_minutes: b.duration_minutes, sort_order: b.sort_order, notes: b.notes ?? "" }))} />
      </Container>
    </div>
  );
}
