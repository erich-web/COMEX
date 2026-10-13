import Link from "next/link";
import { ListPlus, Share2 } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AGENDA_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { CopyLinkButton } from "./copy-link";

export const metadata = { title: "Minhas pautas" };

const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "returned", label: "Devolvidas — precisam de você", statuses: ["returned"] },
  { key: "next", label: "Para o próximo COMEX", statuses: ["approved", "scheduled"] },
  { key: "pending", label: "Aguardando análise", statuses: ["received", "in_review"] },
  { key: "later", label: "Adiadas", statuses: ["postponed"] },
  { key: "done", label: "Discutidas anteriormente", statuses: ["discussed", "archived"] },
];

export default async function MinhasPautasPage() {
  const s = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_items")
    .select("id,title,status,category,created_at,unit:business_units(name),meeting:meetings(series_date)")
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
        label="Preparação"
        action={
          <Button asChild variant="green" size="sm">
            <Link href="/pautas/nova">
              <ListPlus /> Enviar
            </Link>
          </Button>
        }
      />
      <Container className="space-y-6">
        <div className="flex items-center justify-between gap-3 border border-line bg-surface px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-xs text-ink-2">
            <Share2 className="size-4 shrink-0 text-green-dark" />
            <span className="truncate">
              Link permanente: <span className="font-mono text-[11px]">{appUrl.replace(/^https?:\/\//, "")}/enviar-pautas</span>
            </span>
          </div>
          <CopyLinkButton url={`${appUrl}/enviar-pautas`} />
        </div>

        {items.length === 0 ? (
          <EmptyState title="Nenhuma pauta ainda" description="Cadastre várias pautas de uma vez e envie com um único botão." icon={<ListPlus />} action={<Button asChild variant="green"><Link href="/pautas/nova">Enviar pautas</Link></Button>} />
        ) : (
          GROUPS.map((g) => {
            const list = items.filter((i) => g.statuses.includes(i.status));
            if (!list.length) return null;
            return (
              <section key={g.key}>
                <h2 className="t-label mb-2">{g.label}</h2>
                <div className="divide-y divide-line border border-line bg-surface">
                  {list.map((i) => (
                    <Link key={i.id} href={`/pautas/${i.id}`} className="block px-3 py-3 hover:bg-black/[0.03]">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium leading-snug">{i.title}</span>
                        <Badge variant={i.status === "scheduled" || i.status === "approved" ? "green" : i.status === "returned" ? "alert" : i.status === "discussed" ? "black" : "soft"}>{AGENDA_STATUS_LABELS[i.status]}</Badge>
                      </div>
                      <div className="mt-1 text-[11px] text-mute">
                        {CATEGORY_LABELS[i.category]}
                        {i.unit?.name ? ` · ${i.unit.name}` : ""} · enviada {fmtDate(i.created_at, { day: "2-digit", month: "short" })}
                        {i.meeting?.series_date ? ` · COMEX ${fmtDate(i.meeting.series_date, { day: "2-digit", month: "short" })}` : ""}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </Container>
    </div>
  );
}
