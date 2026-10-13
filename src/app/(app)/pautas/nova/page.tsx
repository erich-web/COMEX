import { requireMember } from "@/lib/auth";
import { getGoals, getNextMeeting, getSettings, getUnits, getWeeklyPrompt } from "@/lib/queries";
import { GoalBanner } from "@/components/app/goal-banner";
import { PageHeader } from "@/components/app/page-header";
import { AgendaBatchForm } from "./batch-form";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Enviar pautas" };

export default async function NovaPautaPage() {
  const s = await requireMember();
  const [units, goals, prompt, meeting, settings] = await Promise.all([getUnits(), getGoals(), getWeeklyPrompt(), getNextMeeting(), getSettings()]);
  const meetingLabel = meeting ? `COMEX de ${fmtDate(meeting.series_date, { day: "2-digit", month: "short" })}` : undefined;
  return (
    <div className="fade-in">
      <PageHeader title="Enviar pautas" label="Preparação do COMEX" back="/pautas" dark />
      <GoalBanner compact goal={settings.goal2030.revenue_target} prompt={prompt?.text} meetingLabel={meetingLabel} className="border-t border-space" />
      <AgendaBatchForm
        units={units.map((u) => ({ id: u.id, name: u.name }))}
        goals={goals.map((g) => ({ id: g.id, name: g.name }))}
        defaultUnitId={s.units[0]?.unit_id ?? null}
        promptText={prompt?.text ?? null}
        deadlineLabel={settings.agendaDeadline.label}
        meetingLabel={meetingLabel ?? null}
        userId={s.profile.id}
      />
    </div>
  );
}
