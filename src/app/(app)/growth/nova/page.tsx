import { requireMember } from "@/lib/auth";
import { getGoals, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { IdeaForm } from "./form";

export const metadata = { title: "Nova ideia" };

export default async function NovaIdeiaPage() {
  const s = await requireMember();
  const [units, goals] = await Promise.all([getUnits(), getGoals()]);
  return (
    <div className="fade-in">
      <PageHeader title="Nova ideia" label="Growth RPE" back="/growth" />
      <Container>
        <IdeaForm units={units.map((u) => ({ id: u.id, name: u.name }))} goals={goals.map((g) => ({ id: g.id, name: g.name }))} defaultUnit={s.units[0]?.unit_id ?? ""} />
      </Container>
    </div>
  );
}
