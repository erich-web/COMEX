import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import { todaySP, weekStart } from "@/lib/dates";
import { PageHeader, Container } from "@/components/app/page-header";
import { CheckinForm } from "./checkin-form";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Check-in semanal" };

export default async function CheckinPage({ params }: PageProps<"/unidades/[slug]/checkin">) {
  const { slug } = await params;
  const s = await requireMember();
  const supabase = await createClient();
  const { data: unit } = await supabase.from("business_units").select("*").eq("slug", slug).maybeSingle();
  if (!unit) notFound();
  const canEdit = s.isAdmin || s.units.some((u) => u.unit_id === unit.id && u.can_edit);
  if (!canEdit) redirect(`/unidades/${slug}`);
  const ws = weekStart(todaySP());
  const [{ data: existing }, settings] = await Promise.all([supabase.from("weekly_checkins").select("*").eq("unit_id", unit.id).eq("week_start", ws).maybeSingle(), getSettings()]);

  return (
    <div className="fade-in">
      <PageHeader title="Check-in semanal" label={unit.name} back={`/unidades/${slug}`}>
        <p className="mt-2 text-xs text-mute">
          Semana de {fmtDate(ws, { day: "2-digit", month: "short" })} · prazo recomendado: {settings.prepDeadline.label}. Seis perguntas, respostas curtas e concretas.
        </p>
      </PageHeader>
      <Container>
        <CheckinForm
          unitId={unit.id}
          slug={slug}
          weekStart={ws}
          initial={
            existing
              ? {
                  sales_summary: existing.sales_summary ?? "",
                  problems: (existing.problems as { title: string; detail?: string | null }[]) ?? [],
                  solutions: existing.solutions ?? "",
                  sales_initiatives: existing.sales_initiatives ?? "",
                  growth_initiative: existing.growth_initiative ?? "",
                  needs_from_comex: existing.needs_from_comex ?? "",
                }
              : null
          }
        />
      </Container>
    </div>
  );
}
