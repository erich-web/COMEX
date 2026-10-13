import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <div className="flex min-h-dvh flex-col bg-bg" style={{ paddingTop: "var(--safe-t)", paddingBottom: "var(--safe-b)" }}>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 md:mx-auto md:w-full md:max-w-md">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-white">C</span>
          <div>
            <div className="text-[17px] font-bold leading-tight">COMEX</div>
            <div className="text-[12px] text-mute">Grupo RPE · Comitê Executivo</div>
          </div>
        </div>
        <h1 className="mt-8 text-[26px] font-bold tracking-[-0.01em]">Entrar</h1>
        <p className="mt-1 text-[14px] text-mute">Pautas, atas e o agente de análise do COMEX, no seu celular.</p>
        <div className="mt-6 rounded-[14px] border border-line bg-surface p-5">
          <LoginForm next={next} initialError={error} />
        </div>
      </div>
    </div>
  );
}
