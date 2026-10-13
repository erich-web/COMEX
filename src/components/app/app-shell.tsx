"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListTodo, FileText, Zap, CalendarDays, CheckSquare, Users, Settings, LogOut, Bell, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/auth";

/** Quatro abas no celular — o que o executivo usa toda semana. */
const MOBILE_TABS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/pautas", label: "Pautas", icon: ListTodo },
  { href: "/atas", label: "Atas", icon: FileText },
  { href: "/agente", label: "Agente", icon: Zap },
];

/** Desktop de quem organiza a reunião. */
export const ADMIN_LINKS = [
  { href: "/admin", label: "Próxima terça", icon: CalendarDays },
  { href: "/admin/tarefas", label: "Compromissos", icon: CheckSquare },
  { href: "/admin/usuarios", label: "Pessoas e empresas", icon: Users },
  { href: "/admin/calendario", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/pautas") || pathname.startsWith("/admin/reunioes");
  if (href === "/admin/usuarios") return pathname.startsWith("/admin/usuarios") || pathname.startsWith("/admin/unidades");
  if (href === "/admin/calendario") return pathname.startsWith("/admin/calendario") || pathname.startsWith("/admin/provocacoes");
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
      style={{ paddingBottom: "var(--safe-b)", height: "calc(var(--nav-h) + var(--safe-b))" }}
      aria-label="Navegação principal"
    >
      <ul className="grid h-[var(--nav-h)] grid-cols-4">
        {MOBILE_TABS.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} className={cn("flex h-full flex-col items-center justify-center gap-1 transition-colors", active ? "text-primary" : "text-mute hover:text-ink")} aria-current={active ? "page" : undefined}>
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors", active ? "bg-primary-soft font-semibold text-primary-ink" : "font-medium text-ink-2 hover:bg-surface-2")}>
      <Icon className="size-[18px]" />
      {label}
    </Link>
  );
}

export function Sidebar({ profile, isAdmin, unread, presentHref }: { profile: Profile; isAdmin: boolean; unread: number; presentHref?: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-white">C</span>
        <div>
          <div className="text-[15px] font-bold leading-tight">COMEX</div>
          <div className="text-[11px] text-mute">Grupo RPE · terças, 9h</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-1">
          {MOBILE_TABS.map((t) => (
            <SideItem key={t.href} {...t} active={isActive(pathname, t.href)} />
          ))}
        </div>
        {isAdmin ? (
          <>
            <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-mute">Organização</div>
            <div className="flex flex-col gap-1">
              {ADMIN_LINKS.map((l) => (
                <SideItem key={l.href} {...l} active={isActive(pathname, l.href)} />
              ))}
              {presentHref ? <SideItem href={presentHref} label="Modo reunião" icon={Presentation} active={false} /> : null}
            </div>
          </>
        ) : null}
      </nav>
      <div className="border-t border-line p-3">
        <Link href="/perfil" className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-surface-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-[12px] font-bold text-primary-ink">{initials(profile.full_name || profile.email)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{profile.short_name || profile.full_name}</span>
            <span className="block truncate text-[11px] text-mute">{profile.role === "admin" ? "Administrador" : "Executivo"}</span>
          </span>
          {unread > 0 ? <span className="flex size-5 items-center justify-center rounded-full bg-alert text-[10px] font-bold text-white">{unread}</span> : <Bell className="size-4 text-mute" />}
        </Link>
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-[13px] font-medium text-mute hover:bg-surface-2 hover:text-ink">
            <LogOut className="size-4" /> Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
