import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";

export const metadata = { title: "Acesso pendente" };

export default async function PendentePage() {
  const s = await getSession();
  if (s.isMember) redirect("/");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center text-ink">
      <Clock className="size-8 text-primary" />
      <h1 className="mt-4 text-2xl font-bold">Acesso em liberação</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-2">
        Seu e-mail <span className="font-semibold text-ink">{s.profile.email}</span> entrou, mas ainda não foi autorizado para o COMEX. Peça ao administrador para liberar seu perfil em
        Administração → Usuários.
      </p>
      <form action="/auth/signout" method="post" className="mt-8">
        <button className="rounded-[10px] border border-line-2 bg-surface px-5 py-3 text-[13px] font-semibold hover:bg-surface-2">Sair</button>
      </form>
    </div>
  );
}
