import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { ExperimentForm } from "./form";

export const metadata = { title: "Experimento comercial" };

export default async function ExperimentoPage({ searchParams }: PageProps<"/growth/experimento">) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : null;
  const ideaId = typeof sp.idea === "string" ? sp.idea : null;
  const s = await requireMember();
  const supabase = await createClient();
  const [units, profiles, { data: exp }, { data: idea }, { data: ideas }] = await Promise.all([
    getUnits(),
    getProfiles(),
    id ? supabase.from("growth_experiments").select("*").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    ideaId ? supabase.from("growth_ideas").select("id,title,description,unit_id").eq("id", ideaId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("growth_ideas").select("id,title").in("status", ["idea", "evaluating", "approved"]).order("created_at", { ascending: false }).limit(50),
  ]);
  const canEdit = !exp || s.isAdmin || exp.owner_id === s.profile.id;
  return (
    <div className="fade-in">
      <PageHeader title={exp ? "Experimento" : "Novo experimento"} label="Growth RPE" back="/growth" />
      <Container>
        <ExperimentForm
          id={exp?.id ?? null}
          initial={
            exp ?? {
              idea_id: idea?.id ?? null,
              title: idea?.title ?? "",
              hypothesis: idea?.description ?? "",
              objective: "",
              unit_id: idea?.unit_id ?? s.units[0]?.unit_id ?? null,
              owner_id: s.profile.id,
              investment: null,
              deadline: null,
              expected_revenue: null,
              success_metrics: "",
              actual_result: "",
              actual_revenue: null,
              next_decision: "",
              status: "approved" as const,
            }
          }
          readOnly={!canEdit}
          units={units.map((u) => ({ id: u.id, name: u.name }))}
          profiles={profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))}
          ideas={(ideas ?? []).map((i) => ({ id: i.id, title: i.title }))}
        />
      </Container>
    </div>
  );
}
