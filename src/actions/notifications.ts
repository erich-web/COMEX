"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole, type DbClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { fail } from "./_helpers";
import { hasEmail, sendLogged } from "@/lib/email";
import { preComexDigestEmail, testEmail } from "@/lib/email-templates";
import { appUrl, buildDigestContext, personalizeDigest, runDailyJobs, type JobReport } from "@/lib/jobs";
import { readSettings } from "@/lib/settings";
import { aiCall } from "@/lib/ai-call";
import { hasLLM } from "@/lib/llm";
import { todaySP } from "@/lib/dates";

/** Cliente para rotinas disparadas pelo admin: service_role quando existe, senão o próprio admin (RLS). */
async function jobClient(): Promise<DbClient> {
  return hasServiceRole() ? createServiceClient() : ((await createClient()) as unknown as DbClient);
}

export async function sendTestEmail(): Promise<ActionResult> {
  const s = await requireAdmin();
  if (!hasEmail()) return fail("RESEND_API_KEY não configurada no servidor.");
  const supabase = await jobClient();
  const m = testEmail(appUrl(), s.profile.email);
  const r = await sendLogged(supabase, { to: s.profile.email, subject: m.subject, html: m.html, text: m.text, kind: "test", profileId: s.profile.id });
  revalidatePath("/admin/ia");
  return r.ok ? { ok: true, message: `E-mail de teste enviado para ${s.profile.email}.` } : fail(r.error);
}

export async function sendRemindersNow(): Promise<ActionResult<JobReport>> {
  const s = await requireAdmin();
  if (!hasEmail()) return fail("RESEND_API_KEY não configurada no servidor.");
  try {
    const report = await runDailyJobs(await jobClient(), { kind: "manual", force: { reminders: true }, actorId: s.profile.id, skipAutoClose: true });
    revalidatePath("/admin/ia");
    return { ok: true, data: report, message: `${report.reminders.sent} lembrete(s) enviado(s), ${report.reminders.skipped} sem pendências${report.reminders.failed ? `, ${report.reminders.failed} com falha` : ""}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha ao enviar lembretes.");
  }
}

export async function sendDigestNow(onlyMe = false): Promise<ActionResult<JobReport>> {
  const s = await requireAdmin();
  if (!hasEmail()) return fail("RESEND_API_KEY não configurada no servidor.");
  try {
    const report = await runDailyJobs(await jobClient(), { kind: "manual", force: { digest: true }, actorId: s.profile.id, onlyProfileId: onlyMe ? s.profile.id : null, skipAutoClose: true });
    revalidatePath("/admin/ia");
    return { ok: true, data: report, message: `Resumo da véspera enviado para ${report.digest.sent} pessoa(s)${report.digest.failed ? `, ${report.digest.failed} com falha` : ""}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha ao enviar o resumo.");
  }
}

/** Pré-visualização do resumo da véspera para o próprio admin (sem enviar). */
export async function previewDigest(): Promise<ActionResult<{ html: string; subject: string }>> {
  const s = await requireAdmin();
  const supabase = await jobClient();
  const today = todaySP();
  const { data: next } = await supabase.from("meetings").select("id,series_date,scheduled_at,status,duration_minutes").in("status", ["preparing", "published", "in_progress"]).gte("series_date", today).order("series_date").limit(1).maybeSingle();
  if (!next) return fail("Não há próxima reunião.");
  const settings = await readSettings(supabase);
  try {
    const ctx = await buildDigestContext(supabase, next, today, settings.agendaDeadline.label, s.profile.id);
    const input = await personalizeDigest(supabase, ctx, { id: s.profile.id, email: s.profile.email, full_name: s.profile.full_name, short_name: s.profile.short_name, role: s.profile.role }, appUrl(), today);
    const m = preComexDigestEmail(input);
    return { ok: true, data: { html: m.html, subject: m.subject } };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falha ao montar o resumo.");
  }
}

/** Testa a IA com uma chamada mínima e registra em ai_runs. */
export async function testAI(): Promise<ActionResult<{ model: string; answer: string }>> {
  const s = await requireAdmin();
  if (!hasLLM()) return fail("ANTHROPIC_API_KEY não configurada no servidor.");
  const supabase = await createClient();
  try {
    const r = await aiCall({ client: supabase, kind: "test", actorId: s.profile.id }, "Responda em uma frase curta, em português.", "Confirme que a conexão com a API está funcionando e diga qual modelo você é.", 80);
    revalidatePath("/admin/ia");
    return { ok: true, data: { model: r.model, answer: r.text.trim() }, message: `IA respondeu com o modelo ${r.model}.` };
  } catch (e) {
    revalidatePath("/admin/ia");
    return fail(e instanceof Error ? e.message : "Falha na IA.");
  }
}

export async function setMyEmailPreference(notify: boolean): Promise<ActionResult> {
  const { requireMember } = await import("@/lib/auth");
  const s = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ notify_email: notify }).eq("id", s.profile.id);
  if (error) return fail(error.message);
  revalidatePath("/perfil");
  return { ok: true, message: notify ? "Você voltará a receber os e-mails do COMEX." : "Você não receberá mais lembretes por e-mail." };
}
