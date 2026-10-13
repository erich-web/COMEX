import { requireMember } from "@/lib/auth";
import { getNextMeeting, getSettings, getUnits, getWeeklyPrompt } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { AgendaBatchForm } from "./batch-form";
import { GuideCard } from "./guide-card";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Enviar pautas" };

export default async function NovaPautaPage() {
  const s = await requireMember();
  const [units, prompt, meeting, settings] = await Promise.all([getUnits(), getWeeklyPrompt(), getNextMeeting(), getSettings()]);
  const meetingLabel = meeting ? `COMEX de ${fmtDate(meeting.series_date, { weekday: "short", day: "2-digit", month: "short" })}` : null;
  return (
    <div className="fade-in">
      <PageHeader title="Enviar pautas" label={meetingLabel ? `${meetingLabel} · rascunho salvo neste aparelho` : "Próximo COMEX"} back="/" />
      <div className="mx-auto max-w-2xl px-4 pt-4 md:px-8">
        <GuideCard />
      </div>
      <AgendaBatchForm
        units={units.map((u) => ({ id: u.id, name: u.name, slug: u.slug }))}
        defaultUnitId={s.units[0]?.unit_id ?? null}
        promptText={prompt?.text ?? null}
        deadlineLabel={settings.agendaDeadline.label}
        meetingLabel={meetingLabel}
        userId={s.profile.id}
      />
    </div>
  );
}
