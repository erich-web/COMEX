import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoals, getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/primitives";
import { AGENDA_STATUS_LABELS, CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { AgendaItemEditor, AgendaComments } from "./editor";

export default async function PautaDetailPage({ params }: PageProps<"/pautas/[id]">) {
  const { id } = await params;
  const s = await requireMember();
  const supabase = await createClient();
  const [{ data: item }, { data: comments }, units, goals] = await Promise.all([
    supabase
      .from("agenda_items")
      .select("*, unit:business_units(name), goal:strategic_goals(name), meeting:meetings(id,series_date,scheduled_at,status), block:meeting_blocks(title), presenter:profiles!agenda_items_presenter_id_fkey(short_name,full_name), author:profiles!agenda_items_submitted_by_fkey(short_name,full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("agenda_comments").select("id,body,created_at,author:profiles(short_name,full_name)").eq("item_id", id).order("created_at"),
    getUnits(),
    getGoals(),
  ]);
  if (!item) notFound();
  const mine = item.submitted_by === s.profile.id;
  const editable = mine && ["received", "returned", "in_review"].includes(item.status);
  const links = (item.links as { label?: string; url: string }[]) ?? [];

  return (
    <div className="fade-in">
      <PageHeader title={item.title} label={CATEGORY_LABELS[item.category]} back="/pautas" action={<Badge variant={item.status === "returned" ? "alert" : ["approved", "scheduled"].includes(item.status) ? "green" : "soft"}>{AGENDA_STATUS_LABELS[item.status]}</Badge>} />
      <Container className="space-y-4">
        {item.status === "returned" && item.return_reason ? (
          <Card className="border-alert/50 bg-alert/5">
            <div className="t-label text-alert">Devolvida para complementação</div>
            <p className="mt-1 text-sm">{item.return_reason}</p>
          </Card>
        ) : null}
        {item.meeting ? (
          <Card green className="flex items-center justify-between gap-3">
            <div>
              <div className="t-label text-black/60">Agendada</div>
              <div className="t-display text-lg">
                COMEX {fmtDate(item.meeting.series_date, { day: "2-digit", month: "long" })} · {fmtTime(item.meeting.scheduled_at)}
              </div>
              <div className="text-sm">
                {item.block?.title ?? "Bloco a definir"}
                {item.allotted_minutes ? ` · ${item.allotted_minutes} min` : ""}
                {item.presenter ? ` · apresenta: ${item.presenter.short_name ?? item.presenter.full_name}` : ""}
              </div>
            </div>
            <Link href="/proximo-comex" className="shrink-0 text-[11px] font-bold uppercase tracking-[0.1em]">
              Ver agenda
            </Link>
          </Card>
        ) : null}

        {editable ? (
          <AgendaItemEditor item={item} units={units.map((u) => ({ id: u.id, name: u.name }))} goals={goals.map((g) => ({ id: g.id, name: g.name }))} />
        ) : (
          <Card className="space-y-4">
            <Field label="Contexto" value={item.description} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Unidade" value={item.unit?.name ?? "Grupo / transversal"} />
              <Field label="Urgência" value={URGENCY_LABELS[item.urgency]} />
              <Field label="Resultado esperado" value={item.expected_outcome} />
              <Field label="Tempo sugerido" value={item.suggested_minutes ? `${item.suggested_minutes} min` : null} />
              <Field label="Objetivo estratégico" value={item.goal?.name} />
              <Field label="Exige decisão" value={item.requires_decision ? "Sim" : "Não"} />
            </div>
            <Field label="Problema" value={item.problem} />
            <Field label="Solução proposta" value={item.proposed_solution} />
            <Field label="Impacto esperado" value={item.expected_impact} />
            <Field label="Pessoas envolvidas" value={item.people_involved} />
            {links.length ? (
              <div>
                <div className="t-label mb-1">Links</div>
                <ul className="space-y-1 text-sm">
                  {links.map((l, i) => (
                    <li key={i}>
                      <a className="break-all text-green-dark underline" href={l.url} target="_blank" rel="noreferrer">
                        {l.label || l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="text-[11px] text-mute">
              Enviada por {item.author?.short_name ?? item.author?.full_name} em {fmtDateTime(item.created_at)}
            </div>
          </Card>
        )}

        <AgendaComments itemId={item.id} comments={(comments ?? []).map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author: c.author?.short_name ?? c.author?.full_name ?? "" }))} />
      </Container>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="t-label mb-0.5">{label}</div>
      <div className={value ? "whitespace-pre-wrap text-sm" : "text-sm text-mute"}>{value || "Não informado"}</div>
    </div>
  );
}
