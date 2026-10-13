import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getWeeklyPrompt } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { Card } from "@/components/ui/primitives";
import { PromptsManager } from "./manager";

export const metadata = { title: "Provocações semanais" };

export default async function ProvocacoesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: prompts }, current] = await Promise.all([supabase.from("weekly_prompts").select("*").order("created_at"), getWeeklyPrompt()]);
  return (
    <div className="fade-in">
      <PageHeader title="Provocações semanais" label="Biblioteca de inspiração" back="/admin" />
      <Container className="space-y-5">
        <Card dark>
          <div className="section-label">Provocação desta semana</div>
          <p className="mt-2 font-serif text-xl italic">“{current?.text ?? "Nenhuma provocação ativa"}”</p>
          <p className="mt-2 text-xs text-offwhite/60">Rodízio automático por semana; para fixar uma mensagem em determinada reunião, edite a reunião em Calendário.</p>
        </Card>
        <PromptsManager prompts={(prompts ?? []).map((p) => ({ id: p.id, text: p.text, author: p.author, is_active: p.is_active }))} />
      </Container>
    </div>
  );
}
