import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { hasLLM } from "@/lib/llm";
import { fmtDateTime } from "@/lib/format";
import { AgentFeed, AskBox, RunButton } from "./agent-ui";

export const maxDuration = 60;

export const metadata = { title: "Agente COMEX" };

export default async function AgentePage({ searchParams }: PageProps<"/agente">) {
  const sp = await searchParams;
  const filter = typeof sp.f === "string" ? sp.f : "all";
  const s = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_insights")
    .select("id,kind,title,body,suggestion,evidence,score,status,created_at,agenda_item_id,unit:business_units(name)")
    .in("status", ["open", "turned_into_agenda"])
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);
  const insights = (data ?? []).map((i) => ({ ...i, evidence: (i.evidence as { date?: string | null; title?: string | null; meeting_id?: string | null }[]) ?? [], unit: i.unit?.name ?? null }));
  const lastRun = insights[0]?.created_at ?? null;
  const enabled = hasLLM();

  return (
    <div className="fade-in flex min-h-[calc(100dvh-var(--nav-h))] flex-col md:min-h-0">
      <PageHeader title="Agente COMEX" label="Lê todas as atas e pautas. Aponta padrões, propõe soluções e ideias de crescimento." action={s.isAdmin ? <RunButton enabled={enabled} /> : undefined} />
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-4 md:px-8">
        {!enabled ? (
          <div className="rounded-[14px] border border-amber/40 bg-amber-soft p-4 text-[13px] text-amber">
            O agente ainda não está ativo: falta configurar <code className="font-mono">ANTHROPIC_API_KEY</code> no servidor (Vercel → Settings → Environment Variables) e fazer um novo deploy.
          </div>
        ) : null}
        <AgentFeed insights={insights} filter={filter} isAdmin={s.isAdmin} lastRun={lastRun ? fmtDateTime(lastRun) : null} enabled={enabled} />
      </div>
      <AskBox enabled={enabled} />
    </div>
  );
}
