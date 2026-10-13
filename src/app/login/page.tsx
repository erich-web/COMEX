import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <div className="flex min-h-dvh flex-col bg-black text-offwhite" style={{ paddingTop: "var(--safe-t)", paddingBottom: "var(--safe-b)" }}>
      <div className="relative flex flex-1 flex-col justify-end overflow-hidden px-6 pb-10 pt-16 md:mx-auto md:w-full md:max-w-md md:justify-center">
        <div className="pointer-events-none absolute -right-4 -top-6 select-none font-serif text-[11rem] font-semibold leading-none text-offwhite/[0.04]">RPE</div>
        <div className="relative">
          <div className="section-label">Grupo RPE · Comitê Executivo</div>
          <h1 className="t-display mt-3 text-5xl md:text-6xl">
            RPE
            <br />
            <span className="text-green">COMEX</span>
          </h1>
          <p className="mt-4 max-w-[34ch] font-serif text-lg italic text-offwhite/60">Decisões viram compromissos. Compromissos viram entrega. Rumo aos R$ 200 milhões.</p>
          <div className="mt-8">
            <LoginForm next={next} initialError={error} />
          </div>
        </div>
      </div>
    </div>
  );
}
