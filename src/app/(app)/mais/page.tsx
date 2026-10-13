import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { PageHeader, Container } from "@/components/app/page-header";
import { ADMIN_LINKS, MORE_LINKS } from "@/components/app/app-shell";
import { initials } from "@/lib/format";

export const metadata = { title: "Mais" };

export default async function MaisPage() {
  const s = await requireMember();
  return (
    <div className="fade-in">
      <PageHeader title="Mais" label="Grupo RPE" />
      <Container className="space-y-6">
        <Link href="/perfil" className="flex items-center gap-3 bg-black p-4 text-offwhite">
          <span className="flex size-11 items-center justify-center bg-green text-sm font-bold text-black">{initials(s.profile.full_name || s.profile.email)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">{s.profile.full_name}</span>
            <span className="block truncate text-xs text-offwhite/60">
              {s.profile.email} · {s.isAdmin ? "Administrador" : "Executivo"}
            </span>
          </span>
          <ChevronRight className="size-4 text-offwhite/50" />
        </Link>
        <List items={MORE_LINKS} />
        {s.isAdmin ? (
          <section>
            <div className="section-label mb-2">Administração</div>
            <List items={ADMIN_LINKS} />
          </section>
        ) : null}
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center justify-center gap-2 border border-line py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2 hover:border-black">
            <LogOut className="size-4" /> Sair da conta
          </button>
        </form>
        <p className="text-center text-[10px] uppercase tracking-[0.15em] text-mute">RPE COMEX · Hospitalidade genuína</p>
      </Container>
    </div>
  );
}

function List({ items }: { items: typeof MORE_LINKS }) {
  return (
    <div className="divide-y divide-line border border-line bg-surface">
      {items.map((l) => {
        const Icon = l.icon;
        return (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.03]">
            <Icon className="size-5 text-ink-2" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{l.label}</span>
              <span className="block truncate text-xs text-mute">{l.desc}</span>
            </span>
            <ChevronRight className="size-4 text-mute" />
          </Link>
        );
      })}
    </div>
  );
}
