import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";

export const metadata = { title: "Acesso pendente" };

export default async function PendentePage() {
  const s = await getSession();
  if (s.isMember) redirect("/");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-6 text-center text-offwhite">
      <Clock className="size-8 text-green" />
      <h1 className="t-display mt-4 text-3xl">Acesso em liberação</h1>
      <p className="mt-3 max-w-sm text-sm text-offwhite/70">
        Seu e-mail <span className="font-semibold text-offwhite">{s.profile.email}</span> entrou, mas ainda não foi autorizado para o COMEX. Peça ao administrador para liberar seu perfil em
        Administração → Usuários.
      </p>
      <form action="/auth/signout" method="post" className="mt-8">
        <button className="border border-offwhite/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] hover:border-offwhite">Sair</button>
      </form>
    </div>
  );
}
