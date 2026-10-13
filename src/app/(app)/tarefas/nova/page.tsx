import { requireMember } from "@/lib/auth";
import { getProfiles, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { NewTaskForm } from "./form";

export const metadata = { title: "Nova tarefa" };

export default async function NovaTarefaPage() {
  const s = await requireMember();
  const [profiles, units] = await Promise.all([getProfiles(), getUnits()]);
  return (
    <div className="fade-in">
      <PageHeader title="Nova tarefa" label="Compromisso" back="/tarefas" />
      <Container>
        <NewTaskForm me={s.profile.id} profiles={profiles.map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))} units={units.map((u) => ({ id: u.id, name: u.name }))} defaultUnit={s.units[0]?.unit_id ?? ""} />
      </Container>
    </div>
  );
}
