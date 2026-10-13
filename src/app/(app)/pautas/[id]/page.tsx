import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnits } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/primitives";
import { AGENDA_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { AgendaItemEditor, AgendaComments } from "./editor";

export default async function PautaDetailPage({ params }: PageProps<"/pautas/[id]">) {
  const { id } = await params;
  const s = await requireMember();
  const supabase = await createClient();
  const [{ data: item }, { data: comments }, units] = await Promise.all([
    supabase
      .from("agenda_items")
      .select("*, attachments:agenda_attachments(id,name), unit:business_units(name,slug), meeting:meetings(id,series_date,scheduled_at,status), block:meeting_blocks(title), presenter:profiles!agenda_items_presenter_id_fkey(short_name,full_name), author:profiles!agenda_items_submitted_by_fkey(short_name,full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("agenda_comments").select("id,body,created_at,author:profiles(short_name,full_name)").eq("item_id", id).order("created_at"),
    getUnits(),
  ]);
  if (!item) notFound();
  const mine = item.submitted_by === s.profile.id;
  const editable = mine && ["received", "returned", "in_review"].includes(item.status);
  const links = (item.links as { label?: string; url: string }[]) ?? [];
  const unitName = item.unit ? (item.unit.slug === "grupo-holding" ? "Grupo" : item.unit.name) : "Grupo";

  return (
    <div className="fade-in">
      <PageHeader title={item.title} label={`${CATEGORY_LABELS[item.category]} · ${unitName}`} back="/pautas" action={<Badge variant={item.status === "returned" ? "alertSoft" : ["approved", "scheduled"].includes(item.status) ? "green" : "soft"}>{AGENDA_STATUS_LABELS[item.status]}</Badge>} />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 md:px-8">
        {item.status === "returned" && item.return_reason ? (
          <Card className="border-alert/40 bg-alert-soft">
            <div className="text-[12px] font-semibold text-alert">Devolvida para ajuste</div>
            <p className="mt-1 text-sm">{item.return_reason}</p>
          </Card>
        ) : null}
        {item.meeting ? (
          <Card green className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold">Na agenda</div>
              <div className="text-base font-bold">
                COMEX {fmtDate(item.meeting.series_date, { day: "2-digit", month: "long" })} · {fmtTime(item.meeting.scheduled_at)}
              </div>
              <div className="text-sm">
                {item.block?.title ?? "Bloco a definir"}
                {item.allotted_minutes ? ` · ${item.allotted_minutes} min` : ""}
                {item.presenter ? ` · apresenta: ${item.presenter.short_name ?? item.presenter.full_name}` : ""}
              </div>
            </div>
            {s.isAdmin ? (
              <Link href="/admin" className="shrink-0 text-[13px] font-semibold">
                Organizar
              </Link>
            ) : null}
          </Card>
        ) : null}

        {editable ? (
          <AgendaItemEditor item={item} units={units.map((u) => ({ id: u.id, name: u.name, slug: u.slug }))} />
        ) : (
          <Card className="space-y-4">
            <Field label="Pergunta-chave" value={item.key_question ?? item.expected_outcome} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Duração" value={item.allotted_minutes ?? item.suggested_minutes ? `${item.allotted_minutes ?? item.suggested_minutes} min` : null} />
              <Field label="Empresa" value={unitName} />
            </div>
            <Field label="Contexto" value={item.description} />
            {item.problem ? <Field label="Problema" value={item.problem} /> : null}
            {item.proposed_solution ? <Field label="Solução proposta" value={item.proposed_solution} /> : null}
            {links.length ? (
              <div>
                <div className="mb-1 text-[12px] font-semibold text-mute">Links</div>
                <ul className="space-y-1 text-sm">
                  {links.map((l, i) => (
                    <li key={i}>
                      <a className="break-all text-primary underline" href={l.url} target="_blank" rel="noreferrer">
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

        {(item.attachments ?? []).length ? (
          <Card>
            <div className="mb-2 text-[12px] font-semibold text-mute">Anexos</div>
            <ul className="space-y-1.5">
              {item.attachments.map((a) => (
                <li key={a.id}>
                  <a href={`/anexos/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline">
                    <FileText className="size-4" /> {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <AgendaComments itemId={item.id} comments={(comments ?? []).map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author: c.author?.short_name ?? c.author?.full_name ?? "" }))} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="mb-0.5 text-[12px] font-semibold text-mute">{label}</div>
      <div className={value ? "whitespace-pre-wrap text-sm" : "text-sm text-mute"}>{value || "Não informado"}</div>
    </div>
  );
}
