import Link from "next/link";
import { Rocket, Plus, FlaskConical } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card, EmptyState, Stat } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { GROWTH_STATUS_LABELS } from "@/lib/constants";
import { fmtBRL, fmtDate } from "@/lib/format";
import { IdeaStatusButton } from "./idea-status";
import { cn } from "@/lib/utils";

export const metadata = { title: "Growth RPE" };

export default async function GrowthPage() {
  const s = await requireMember();
  const supabase = await createClient();
  const [{ data: ideas }, { data: experiments }] = await Promise.all([
    supabase.from("growth_ideas").select("*, author:profiles(short_name,full_name), unit:business_units(name)").order("created_at", { ascending: false }).limit(100),
    supabase.from("growth_experiments").select("*, owner:profiles!growth_experiments_owner_id_fkey(short_name,full_name), unit:business_units(name)").order("created_at", { ascending: false }).limit(50),
  ]);
  const exps = experiments ?? [];
  const running = exps.filter((e) => e.status === "executing");
  const expectedRevenue = exps.filter((e) => ["approved", "executing"].includes(e.status)).reduce((a, e) => a + (e.expected_revenue ?? 0), 0);
  const realized = exps.reduce((a, e) => a + (e.actual_revenue ?? 0), 0);

  return (
    <div className="fade-in">
      <PageHeader
        title="Growth RPE"
        label="Cultura de vendas"
        dark
        action={
          <Button asChild variant="green" size="sm">
            <Link href="/growth/nova">
              <Plus /> Nova ideia
            </Link>
          </Button>
        }
      >
        <p className="mt-2 max-w-[40ch] font-serif text-base italic text-offwhite/70">“Vender mais e melhor é responsabilidade de todos.”</p>
      </PageHeader>
      <Container className="space-y-6 pt-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat value={(ideas ?? []).filter((i) => i.status === "idea").length} label="Ideias novas" />
          <Stat value={running.length} label="Em execução" tone="green" />
          <Stat value={fmtBRL(expectedRevenue)} label="Receita adicional esperada" className="col-span-2 md:col-span-1" />
          <Stat value={realized ? fmtBRL(realized) : "—"} label="Receita realizada" tone="green" className="col-span-2 md:col-span-1" />
        </div>

        <section>
          <div className="mb-2 flex items-end justify-between">
            <div className="section-label">Experimentos comerciais</div>
            <Link href="/growth/experimento" className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">
              + Experimento
            </Link>
          </div>
          {exps.length === 0 ? (
            <EmptyState title="Nenhum experimento" description="Uma ideia aprovada vira experimento: hipótese, investimento, prazo e resultado medido." icon={<FlaskConical />} />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {exps.map((e) => (
                <Link key={e.id} href={`/growth/experimento?id=${e.id}`} className="border border-line bg-surface p-3 hover:border-black">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold leading-snug">{e.title}</div>
                    <Badge variant={e.status === "executing" ? "green" : e.status === "done" || e.status === "scaled" ? "black" : e.status === "discontinued" ? "alertSoft" : "soft"}>{GROWTH_STATUS_LABELS[e.status]}</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-mute">
                    {e.unit?.name ?? "Grupo"} · {e.owner?.short_name ?? e.owner?.full_name ?? "sem responsável"}
                    {e.deadline ? ` · até ${fmtDate(e.deadline)}` : ""}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="t-label">Investimento</div>
                      <div className="font-semibold tabular">{e.investment != null ? fmtBRL(e.investment) : "—"}</div>
                    </div>
                    <div>
                      <div className="t-label">Esperado</div>
                      <div className="font-semibold tabular">{e.expected_revenue != null ? fmtBRL(e.expected_revenue) : "—"}</div>
                    </div>
                    <div>
                      <div className="t-label">Realizado</div>
                      <div className={cn("font-semibold tabular", e.actual_revenue != null && e.expected_revenue != null && (e.actual_revenue >= e.expected_revenue ? "text-green-dark" : "text-alert"))}>{e.actual_revenue != null ? fmtBRL(e.actual_revenue) : "—"}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="section-label mb-2">Banco de ideias</div>
          {(ideas ?? []).length === 0 ? (
            <EmptyState title="Banco de ideias vazio" description="Campanhas, promoções, CRM, cross-selling, parcerias, novos produtos… tudo que puxa receita." icon={<Rocket />} action={<Button asChild variant="green"><Link href="/growth/nova">Registrar ideia</Link></Button>} />
          ) : (
            <div className="divide-y divide-line border border-line bg-surface">
              {ideas!.map((i) => (
                <div key={i.id} className="flex items-start gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{i.title}</div>
                    {i.description ? <div className="mt-0.5 line-clamp-2 text-xs text-ink-2">{i.description}</div> : null}
                    <div className="mt-1 text-[11px] text-mute">
                      {i.kind ? `${i.kind} · ` : ""}
                      {i.unit?.name ?? "Grupo"} · {i.author?.short_name ?? i.author?.full_name} · {fmtDate(i.created_at, { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <IdeaStatusButton id={i.id} status={i.status} canChange={s.isAdmin || i.author_id === s.profile.id} />
                </div>
              ))}
            </div>
          )}
        </section>
        <Card dark>
          <div className="section-label">Provocação comercial</div>
          <p className="mt-2 font-serif text-lg italic">Qual iniciativa concreta você está conduzindo para aumentar a receita da sua unidade?</p>
          <p className="mt-2 text-xs text-offwhite/60">Responda no check-in semanal da sua unidade.</p>
        </Card>
      </Container>
    </div>
  );
}
