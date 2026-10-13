import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, Sidebar } from "@/components/app/app-shell";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session.isMember) redirect("/pendente");

  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", session.profile.id).is("read_at", null);

  return (
    <div className="flex min-h-dvh">
      <Sidebar profile={session.profile} isAdmin={session.isAdmin} unread={count ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pb-[calc(var(--nav-h)+var(--safe-b)+16px)] md:pb-10" style={{ paddingTop: "var(--safe-t)" }}>
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
