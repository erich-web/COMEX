import Link from "next/link";
import { Bell } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Container } from "@/components/app/page-header";
import { Card, EmptyState } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/format";
import { ProfileForm, MarkAllRead, EmailPreference } from "./profile-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const s = await requireMember();
  const supabase = await createClient();
  const { data: notifications } = await supabase.from("notifications").select("*").eq("profile_id", s.profile.id).order("created_at", { ascending: false }).limit(40);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="fade-in">
      <PageHeader title={s.profile.full_name || "Perfil"} label={s.isAdmin ? "Administrador" : "Executivo COMEX"} back="/" />
      <Container className="space-y-5 py-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="section-label">Notificações{unread ? ` · ${unread} novas` : ""}</div>
            {unread ? <MarkAllRead /> : null}
          </div>
          {(notifications ?? []).length === 0 ? (
            <EmptyState title="Sem notificações" icon={<Bell />} />
          ) : (
            <div className="divide-y divide-surface-2 overflow-hidden rounded-[14px] border border-line bg-surface">
              {notifications!.map((n) => (
                <Link key={n.id} href={n.link ?? "/"} className={cn("block px-3 py-2.5 hover:bg-primary/[0.03]", !n.read_at && "border-l-2 border-green")}>
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body ? <div className="text-xs text-ink-2">{n.body}</div> : null}
                  <div className="mt-0.5 text-[11px] text-mute">{fmtDateTime(n.created_at)}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="section-label mb-2">Seus dados</div>
          <ProfileForm profile={{ full_name: s.profile.full_name, short_name: s.profile.short_name ?? "", phone: s.profile.phone ?? "", email: s.profile.email }} />
        </section>
        <EmailPreference initial={s.profile.notify_email} />
        {s.units.length ? (
          <Card>
            <div className="t-label mb-1">Unidades sob sua responsabilidade</div>
            <div className="text-sm">{s.units.map((u) => u.unit.name).join(", ")}</div>
          </Card>
        ) : null}
      </Container>
    </div>
  );
}
