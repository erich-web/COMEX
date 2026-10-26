import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/admin";

/**
 * Envio de e-mail transacional pela API do Resend (sem SDK, só fetch).
 * Variáveis: RESEND_API_KEY (obrigatória), EMAIL_FROM (ex.: "COMEX Grupo RPE <comex@gruporpe.com.br>").
 * Sem domínio verificado no Resend, use o remetente de teste "onboarding@resend.dev" — ele só entrega
 * para o e-mail dono da conta Resend.
 */

const DEV_FROM = "COMEX Grupo RPE <onboarding@resend.dev>";

function key() {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

export const hasEmail = () => key().length > 0;

export function emailFrom() {
  return (process.env.EMAIL_FROM ?? "").trim() || DEV_FROM;
}

export function emailStatus() {
  const k = key();
  return {
    configured: !!k,
    keyHint: k ? `chave começa com "${k.slice(0, 6)}", ${k.length} caracteres` : "RESEND_API_KEY não configurada",
    from: emailFrom(),
    usingTestSender: !(process.env.EMAIL_FROM ?? "").trim(),
  };
}

export type Mail = { to: string; subject: string; html: string; text?: string; replyTo?: string };
export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export async function sendEmail(mail: Mail): Promise<SendResult> {
  const k = key();
  if (!k) return { ok: false, error: "RESEND_API_KEY não configurada no servidor." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${k}` },
      body: JSON.stringify({ from: emailFrom(), to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, reply_to: mail.replyTo }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) return { ok: false, error: `${res.status} ${body.name ?? ""}: ${body.message ?? "falha no envio"}`.trim() };
    return { ok: true, id: body.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de rede ao enviar e-mail." };
  }
}

/** Envia e registra em email_log (sucesso ou falha). */
export async function sendLogged(
  supabase: DbClient,
  mail: Mail & { kind: string; profileId?: string | null; meta?: Record<string, Json | undefined> },
): Promise<SendResult> {
  const r = await sendEmail(mail);
  try {
    await supabase.from("email_log").insert({
      kind: mail.kind,
      profile_id: mail.profileId ?? null,
      to_email: mail.to,
      subject: mail.subject,
      status: r.ok ? "sent" : "failed",
      error: r.ok ? null : r.error,
      meta: { ...(mail.meta ?? {}), provider_id: r.ok ? r.id : null } as Json,
    });
  } catch {
    // o log nunca impede o envio
  }
  return r;
}
