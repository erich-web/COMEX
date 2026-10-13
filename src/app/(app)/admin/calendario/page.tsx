import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import { todaySP } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge } from "@/components/ui/primitives";
import { MEETING_STATUS_LABELS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { CalendarSettings, EnsureMeetingsButton } from "./settings";

export const metadata = { title: "Calendário e prazos" };

export default async function CalendarioPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, { data: meetings }] = await Promise.all([getSettings(), supabase.from("meetings").select("id,series_date,scheduled_at,status,title").gte("series_date", todaySP()).order("series_date").limit(16)]);
  return (
    <div className="fade-in">
      <PageHeader title="Calendário e prazos" label="Administração" back="/admin" />
      <Container className="space-y-6 py-4">
        <CalendarSettings calendar={settings.calendar} agendaDeadline={settings.agendaDeadline} prepDeadline={settings.prepDeadline} defaultBlocks={settings.defaultBlocks} />
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="section-label">Próximas reuniões</div>
            <EnsureMeetingsButton />
          </div>
          <div className="divide-y divide-surface-2 overflow-hidden rounded-[14px] border border-line bg-surface">
            {(meetings ?? []).map((m) => (
              <Link key={m.id} href={`/admin/reunioes/${m.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary/[0.03]">
                <span className="w-24 text-sm font-semibold">{fmtDate(m.series_date, { weekday: "short", day: "2-digit", month: "short" })}</span>
                <span className="text-sm text-mute tabular">{fmtTime(m.scheduled_at)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
                <Badge variant={m.status === "published" ? "green" : m.status === "cancelled" ? "alertSoft" : "soft"}>{MEETING_STATUS_LABELS[m.status]}</Badge>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">Reagendar ou cancelar uma ocorrência (ex.: feriado) não altera a recorrência — abra a reunião e edite.</p>
        </section>
      </Container>
    </div>
  );
}
