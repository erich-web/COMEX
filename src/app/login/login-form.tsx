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
      <div className="fade-up">
        <CheckCircle2 className="size-6 text-green" />
        <p className="mt-3 text-xl font-bold">Link enviado</p>
        <p className="mt-2 text-sm text-ink-2">
          Abra o e-mail em <span className="font-semibold text-ink">{email}</span> e toque no link de acesso. Ele vale por alguns minutos e abre o COMEX direto neste aparelho.
        </p>
        <button className="mt-4 text-[13px] font-semibold text-primary" onClick={() => setStatus("idle")}>
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-[13px] font-semibold text-ink-2">
          Seu e-mail corporativo
        </label>
        <div className="mt-1.5 flex items-center rounded-[10px] border border-line-2 bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Mail className="size-4 text-mute" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="nome@gruporpe.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full bg-transparent px-3 text-base text-ink placeholder:text-mute/60 focus:outline-none"
            aria-invalid={status === "error"}
          />
        </div>
        {error ? <p className="mt-2 text-xs text-alert">{error}</p> : null}
      </div>
      <Button type="submit" variant="primary" size="lg" block loading={status === "sending"}>
        Receber link de acesso
      </Button>
      <p className="text-center text-[12px] text-mute">Sem senha. Você recebe um link mágico por e-mail.</p>
    </form>
  );
}
