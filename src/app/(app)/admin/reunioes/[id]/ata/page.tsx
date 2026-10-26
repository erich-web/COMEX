import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { fmtDate } from "@/lib/format";
import { MinutesEditor, DecisionsPanel } from "./editor";

export const metadata = { title: "Ata e decisões" };

export default async function AtaPage({ params }: PageProps<"/admin/reunioes/[id]/ata">) {
  const { id } = await params;
  const s = await requireAdmin();
  const supabase = await createClient();
  const [{ data: m }, { data: decisions }, { data: items }, profiles, units] = await Promise.all([
    supabase.from("meetings").select("*, minutes:meeting_minutes(*)").eq("id", id).maybeSingle(),
    supabase.from("meeting_decisions").select("*, owner:profiles!meeting_decisions_owner_id_fkey(short_name), task:tasks(id,status)").eq("meeting_id", id).order("created_at"),
    supabase.from("agenda_items").select("id,title,category,presenter:profiles!agenda_items_presenter_id_fkey(short_name),author:profiles!agenda_items_submitted_by_fkey(short_name)").eq("meeting_id", id).in("status", ["scheduled", "discussed"]).order("sort_order"),
    getProfiles(),
    getUnits(),
  ]);
  if (!m) notFound();
  const skeleton =
    m.minutes?.content ||
    `COMEX — ${fmtDate(m.series_date, { day: "2-digit", month: "2-digit", year: "numeric" })}, 9h.\n\nPARTICIPANTES\n\n\nPAUTAS DISCUTIDAS\n${(items ?? []).map((i, k) => `${k + 1}. ${i.title} (${i.presenter?.short_name ?? i.author?.short_name ?? ""})`).join("\n")}\n\nDECISÕES\n${(decisions ?? []).map((d, k) => `${k + 1}. ${d.title}${d.owner?.short_name ? ` — ${d.owner.short_name}` : ""}${d.due_date ? ` (até ${fmtDate(d.due_date, { day: "2-digit", month: "2-digit" })})` : ""}`).join("\n")}\n\nENCAMINHAMENTOS\n`;

  const people = profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }));
  const unitList = units.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="fade-in">
      <PageHeader title="Ata e decisões" label={`COMEX ${fmtDate(m.series_date, { day: "2-digit", month: "long", year: "numeric" })}`} back={`/admin/reunioes/${id}`} />
      <Container className="space-y-5 py-4">
        <MinutesEditor
          meetingId={id}
          userId={s.profile.id}
          initial={{
            title: m.minutes?.title ?? m.title,
            summary: m.minutes?.summary ?? "",
            content: skeleton,
            source_notes: m.minutes?.source_notes ?? "",
            drive_url: m.minutes?.drive_url ?? "",
            status: m.minutes?.status ?? "draft",
            file_name: m.minutes?.file_name ?? null,
            has_file: !!m.minutes?.file_path,
            structured_at: m.minutes?.structured_at ?? null,
          }}
          profiles={people}
          units={unitList}
        />
        <DecisionsPanel
          meetingId={id}
          decisions={(decisions ?? []).map((d) => ({ id: d.id, title: d.title, description: d.description, owner: d.owner?.short_name ?? null, due_date: d.due_date, task: d.task?.[0] ?? null }))}
          items={(items ?? []).map((i) => ({ id: i.id, title: i.title }))}
          profiles={people}
          units={unitList}
        />
      </Container>
    </div>
  );
}
