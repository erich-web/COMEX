import Link from "next/link";
import { Plus, Link2 } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AGENDA_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { CopyLinkButton } from "./copy-link";

export const metadata = { title: "Minhas pautas" };

const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "returned", label: "Devolvidas — precisam de você", statuses: ["returned"] },
  { key: "next", label: "Na próxima terça", statuses: ["approved", "scheduled"] },
  { key: "pending", label: "Aguardando organização", statuses: ["received", "in_review"] },
  { key: "later", label: "Adiadas", statuses: ["postponed"] },
  { key: "done", label: "Já discutidas", statuses: ["discussed", "archived"] },
];

export default async function MinhasPautasPage() {
  const s = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_items")
    .select("id,title,key_question,status,category,suggested_minutes,allotted_minutes,created_at,unit:business_units(name,slug),meeting:meetings(series_date)")
    .eq("submitted_by", s.profile.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  const items = data ?? [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="fade-in">
      <PageHeader
        title="Minhas pautas"
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/pautas/nova">
              <Plus /> Enviar
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-4 md:px-8">
        {items.length === 0 ? (
          <EmptyState title="Nenhuma pauta ainda" description="Cadastre várias de uma vez — título, pergunta-chave, duração, temática e empresa — e envie com um único botão." icon={<Plus />} action={<Button asChild variant="primary"><Link href="/pautas/nova">Enviar pautas</Link></Button>} />
        ) : (
          GROUPS.map((g) => {
            const list = items.filter((i) => g.statuses.includes(i.status));
            if (!list.length) return null;
            return (
              <section key={g.key}>
                <h2 className="mb-2 text-[13px] font-semibold text-mute">{g.label}</h2>
                <div className="divide-y divide-surface-2 overflow-hidden rounded-[14px] border border-line bg-surface">
                  {list.map((i) => (
                    <Link key={i.id} href={`/pautas/${i.id}`} className="block px-4 py-3 hover:bg-surface-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[15px] font-semibold leading-snug">{i.title}</span>
                        <Badge variant={i.status === "scheduled" || i.status === "approved" ? "green" : i.status === "returned" ? "alertSoft" : i.status === "discussed" ? "primary" : "soft"}>{AGENDA_STATUS_LABELS[i.status]}</Badge>
                      </div>
                      {i.key_question ? <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{i.key_question}</p> : null}
                      <div className="mt-1 text-[12px] text-mute">
                        {i.allotted_minutes ?? i.suggested_minutes ? `${i.allotted_minutes ?? i.suggested_minutes} min · ` : ""}
                        {CATEGORY_LABELS[i.category]}
                        {i.unit?.name ? ` · ${i.unit.slug === "grupo-holding" ? "Grupo" : i.unit.name}` : ""}
                        {i.meeting?.series_date ? ` · COMEX ${fmtDate(i.meeting.series_date, { day: "2-digit", month: "short" })}` : ` · enviada ${fmtDate(i.created_at, { day: "2-digit", month: "short" })}`}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}

        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-ink-2">
            <Link2 className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              Link permanente para enviar pautas: <span className="font-mono text-[11px]">{appUrl.replace(/^https?:\/\//, "")}/enviar-pautas</span>
            </span>
          </div>
          <CopyLinkButton url={`${appUrl}/enviar-pautas`} />
        </div>
      </div>
    </div>
  );
}
