"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListTodo, CheckSquare, Store, MoreHorizontal, CalendarDays, FileText, Rocket, Target, Settings, LayoutGrid, Users, Building2, Lightbulb, BarChart3, LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/auth";

const MOBILE_TABS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/pautas", label: "Pautas", icon: ListTodo },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/unidades", label: "Unidades", icon: Store },
  { href: "/mais", label: "Mais", icon: MoreHorizontal },
];

export const MORE_LINKS = [
  { href: "/proximo-comex", label: "Próximo COMEX", icon: CalendarDays, desc: "Agenda publicada, horários e apresentadores" },
  { href: "/reunioes", label: "Reuniões e atas", icon: FileText, desc: "Histórico, decisões e atas aprovadas" },
  { href: "/growth", label: "Growth RPE", icon: Rocket, desc: "Banco de ideias e experimentos comerciais" },
  { href: "/rpe-2030", label: "Estratégia RPE 2030", icon: Target, desc: "R$ 200 milhões: rota, cenários e gap" },
  { href: "/perfil", label: "Perfil e configurações", icon: Settings, desc: "Seus dados e notificações" },
];

export const ADMIN_LINKS = [
  { href: "/admin", label: "Painel do CEO", icon: BarChart3, desc: "Visão consolidada por pessoa e unidade" },
  { href: "/admin/pautas", label: "Organizar pautas", icon: LayoutGrid, desc: "Quadro de pautas recebidas e agenda" },
  { href: "/admin/tarefas", label: "Tarefas de todos", icon: CheckSquare, desc: "Accountability consolidado" },
  { href: "/admin/usuarios", label: "Usuários e permissões", icon: Users, desc: "Executivos, papéis e responsáveis" },
  { href: "/admin/unidades", label: "Unidades e indicadores", icon: Building2, desc: "Cadastro e KPIs por unidade" },
  { href: "/admin/calendario", label: "Calendário e prazos", icon: CalendarDays, desc: "Recorrência, blocos e deadlines" },
  { href: "/admin/metas", label: "Metas RPE 2030", icon: Target, desc: "Metas anuais e cenários" },
  { href: "/admin/provocacoes", label: "Provocações semanais", icon: Lightbulb, desc: "Biblioteca de perguntas inspiradoras" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/mais") return pathname === "/mais" || MORE_LINKS.some((l) => pathname.startsWith(l.href)) || pathname.startsWith("/admin");
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-space bg-black text-offwhite md:hidden"
      style={{ paddingBottom: "var(--safe-b)", height: "calc(var(--nav-h) + var(--safe-b))" }}
      aria-label="Navegação principal"
    >
      <ul className="grid h-[var(--nav-h)] grid-cols-5">
        {MOBILE_TABS.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} className={cn("flex h-full flex-col items-center justify-center gap-1 transition-colors", active ? "text-green" : "text-offwhite/55 hover:text-offwhite")} aria-current={active ? "page" : undefined}>
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ profile, isAdmin, unread }: { profile: Profile; isAdmin: boolean; unread: number }) {
  const pathname = usePathname();
  const Item = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const active = isActive(pathname, href) && !(href === "/mais");
    return (
      <Link href={href} className={cn("flex items-center gap-3 px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors", active ? "bg-green text-black" : "text-offwhite/60 hover:bg-white/5 hover:text-offwhite")}>
        <Icon className="size-4" />
        {label}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-space bg-black text-offwhite md:flex">
      <div className="border-b border-space px-5 py-5">
        <div className="t-label text-offwhite/50">Grupo RPE</div>
        <div className="t-display mt-1 text-2xl">
          RPE <span className="text-green">COMEX</span>
        </div>
        <div className="mt-1 text-[11px] text-offwhite/50">Comitê Executivo · terças, 9h–12h</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="t-label px-5 pb-1 text-offwhite/40">Executivo</div>
        {MOBILE_TABS.filter((t) => t.href !== "/mais").map((t) => (
          <Item key={t.href} {...t} />
        ))}
        {MORE_LINKS.filter((l) => l.href !== "/perfil").map((l) => (
          <Item key={l.href} {...l} />
        ))}
        {isAdmin ? (
          <>
            <div className="t-label mt-4 px-5 pb-1 text-offwhite/40">Administração</div>
            {ADMIN_LINKS.map((l) => (
              <Item key={l.href} {...l} />
            ))}
          </>
        ) : null}
      </nav>
      <div className="border-t border-space p-3">
        <Link href="/perfil" className="flex items-center gap-3 px-2 py-2 hover:bg-white/5">
          <span className="flex size-9 items-center justify-center bg-green text-[12px] font-bold text-black">{initials(profile.full_name || profile.email)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{profile.short_name || profile.full_name}</span>
            <span className="block truncate text-[11px] text-offwhite/50">{profile.role === "admin" ? "Administrador" : "Executivo"}</span>
          </span>
          {unread > 0 ? <span className="flex size-5 items-center justify-center bg-alert text-[10px] font-bold">{unread}</span> : <Bell className="size-4 text-offwhite/40" />}
        </Link>
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-3 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-offwhite/50 hover:text-offwhite">
            <LogOut className="size-4" /> Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
