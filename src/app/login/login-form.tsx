"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(initialError ? "error" : "idle");
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      setError("Informe um e-mail válido.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message === "Signups not allowed for otp" ? "Este e-mail não está autorizado. Fale com o administrador do COMEX." : error.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="border border-green/40 bg-green/10 p-5 fade-up">
        <CheckCircle2 className="size-6 text-green" />
        <p className="t-display mt-3 text-2xl">Link enviado</p>
        <p className="mt-2 text-sm text-offwhite/70">
          Abra o e-mail em <span className="font-semibold text-offwhite">{email}</span> e toque no link de acesso. Ele vale por alguns minutos e abre o COMEX direto neste aparelho.
        </p>
        <button className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-green" onClick={() => setStatus("idle")}>
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-[0.15em] text-offwhite/60">
          Seu e-mail corporativo
        </label>
        <div className="mt-2 flex items-center border-b border-offwhite/25 focus-within:border-green">
          <Mail className="size-4 text-offwhite/40" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="nome@gruporpe.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full bg-transparent px-3 text-base text-offwhite placeholder:text-offwhite/30 focus:outline-none"
            aria-invalid={status === "error"}
          />
        </div>
        {error ? <p className="mt-2 text-xs text-[#f06a55]">{error}</p> : null}
      </div>
      <Button type="submit" variant="green" size="lg" block loading={status === "sending"}>
        Receber link de acesso
      </Button>
      <p className="text-center text-[11px] text-offwhite/40">Sem senha. Você recebe um link mágico por e-mail.</p>
    </form>
  );
}
