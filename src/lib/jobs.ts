import "server-only";
import type { DbClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { readSettings } from "@/lib/settings";
import { hasEmail, sendLogged } from "@/lib/email";
import { preComexDigestEmail, taskReminderEmail, type DigestInput, type TaskLite } from "@/lib/email-templates";
import { ensureMinutesSummary, generateInsights } from "@/lib/agent-core";
import { hasLLM } from "@/lib/llm";
import { computeSchedule } from "@/lib/agenda";
import { clockMinutesSP, daysBetween, todaySP } from "@/lib/dates";
import { fmtDate, fmtTime } from "@/lib/format";

/**
 * Rotinas diárias do COMEX (chamadas pelo cron da Vercel ou manualmente pelo admin):
 *  1. encerra reuniões que ficaram "em andamento" depois do dia;
 *  2. na véspera da reunião: renova as análises do agente, garante o resumo da última ata
 *     e envia o resumo da véspera para todos;
 *  3. nos demais dias: lembra, a cada N dias, quem tem compromissos pendentes.
 */

export type JobReport = {
  today: string;
  nextMeeting: string | null;
  digestDay: boolean;
  autoClosed: number;
  analysis: { ran: boolean; count?: number; error?: string };
  digest: { sent: number; skipped: number; failed: number; errors: string[] };
  reminders: { sent: number; skipped: number; failed: number; errors: string[] };
  emailConfigured: boolean;
};

export type JobOptions = {
  kind: "daily" | "manual";
  force?: { digest?: boolean; reminders?: boolean; analysis?: boolean };
  onlyProfileId?: string | null;
  actorId?: string | null;
  skipAutoClose?: boolean;
};

const MEMBER_ROLES = ["admin", "executive", "unit_lead"] as const;

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://comex-omega.vercel.app").replace(/\/$/, "");
}

export async function runDailyJobs(supabase: DbClient, opts: JobOptions): Promise<JobReport> {
  const today = todaySP();
  const settings = await readSettings(supabase);
  const url = appUrl();
  const report: JobReport = {
    today,
    nextMeeting: null,
    digestDay: false,
    autoClosed: 0,
    analysis: { ran: false },
    digest: { sent: 0, skipped: 0, failed: 0, errors: [] },
    reminders: { sent: 0, skipped: 0, failed: 0, errors: [] },
    emailConfigured: hasEmail(),
  };
  const { data: jobRow } = await supabase.from("job_runs").insert({ kind: opts.kind, ok: true, report: {} }).select("id").single();

  try {
    // 1) reuniões esquecidas em andamento
    if (!opts.skipAutoClose) report.autoClosed = await autoCloseStaleMeetings(supabase, today);

    // 2) próxima reunião
    const { data: next } = await supabase.from("meetings").select("id,series_date,scheduled_at,status,duration_minutes").in("status", ["preparing", "published", "in_progress"]).gte("series_date", today).order("series_date").limit(1).maybeSingle();
    report.nextMeeting = next?.series_date ?? null;
    const dayBefore = !!next && daysBetween(today, next.series_date) === 1;
    report.digestDay = (settings.notifications.digest_day_before && dayBefore) || !!opts.force?.digest;

    // membros ativos que recebem e-mail
    const { data: members } = await supabase.from("profiles").select("id,email,full_name,short_name,role,notify_email").eq("is_active", true).in("role", [...MEMBER_ROLES]);
    const recipients = (members ?? []).filter((p) => p.notify_email && !/^qa\./i.test(p.email) && (!opts.onlyProfileId || p.id === opts.onlyProfileId));

    // 3) véspera: análises + resumo
    if (report.digestDay && next) {
      if (hasLLM() && (opts.force?.analysis || (await analysisIsStale(supabase)))) {
        try {
          const r = await generateInsights(supabase, opts.actorId ?? null);
          report.analysis = { ran: true, count: r.count };
        } catch (e) {
          report.analysis = { ran: true, error: e instanceof Error ? e.message : String(e) };
        }
      }
      const digest = await buildDigestContext(supabase, next, today, settings.agendaDeadline.label, opts.actorId ?? null);
      for (const p of recipients) {
        if (!opts.force?.digest) {
          const { data: already } = await supabase.from("email_log").select("id").eq("kind", "pre_comex_digest").eq("profile_id", p.id).eq("status", "sent").contains("meta", { meeting_id: next.id }).limit(1);
          if (already?.length) {
            report.digest.skipped++;
            continue;
          }
        }
        const input = await personalizeDigest(supabase, digest, p, url, today);
        const mail = preComexDigestEmail(input);
        const r = await sendLogged(supabase, { to: p.email, subject: mail.subject, html: mail.html, text: mail.text, kind: "pre_comex_digest", profileId: p.id, meta: { meeting_id: next.id, tasks: input.myTasks.length } });
        if (r.ok) report.digest.sent++;
        else {
          report.digest.failed++;
          report.digest.errors.push(`${p.email}: ${r.error}`);
        }
      }
    }

    // 4) lembretes de compromissos (não no dia do resumo, que já lista tudo)
    if (!report.digestDay || opts.force?.reminders) {
      const every = settings.notifications.task_reminder_every_days;
      const nextLabel = next ? `${fmtDate(next.series_date, { weekday: "long", day: "2-digit", month: "long" })} às ${fmtTime(next.scheduled_at)}` : null;
      for (const p of recipients) {
        const tasks = await openTasksOf(supabase, p.id, today);
        if (!tasks.length) {
          report.reminders.skipped++;
          continue;
        }
        if (!opts.force?.reminders) {
          const { data: last } = await supabase.from("email_log").select("sent_at").eq("kind", "task_reminder").eq("profile_id", p.id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();
          const hours = last ? (Date.now() - new Date(last.sent_at).getTime()) / 3_600_000 : Infinity;
          if (hours < every * 24 - 6) {
            report.reminders.skipped++;
            continue;
          }
        }
        const mail = taskReminderEmail({ firstName: firstName(p), tasks, today, appUrl: url, nextMeetingLabel: nextLabel, everyDays: every });
        const r = await sendLogged(supabase, { to: p.email, subject: mail.subject, html: mail.html, text: mail.text, kind: "task_reminder", profileId: p.id, meta: { tasks: tasks.length, late: tasks.filter((t) => t.due_date && t.due_date < today).length } });
        if (r.ok) report.reminders.sent++;
        else {
          report.reminders.failed++;
          report.reminders.errors.push(`${p.email}: ${r.error}`);
        }
      }
    }
    if (jobRow) await supabase.from("job_runs").update({ ok: true, report: report as unknown as Json, finished_at: new Date().toISOString() }).eq("id", jobRow.id);
    return report;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (jobRow) await supabase.from("job_runs").update({ ok: false, error: err, report: report as unknown as Json, finished_at: new Date().toISOString() }).eq("id", jobRow.id);
    throw e;
  }
}

/* ------------------------------------------------------------------ */

function firstName(p: { short_name: string | null; full_name: string; email: string }) {
  return (p.short_name || p.full_name || p.email).split(" ")[0];
}

async function analysisIsStale(supabase: DbClient) {
  const { data } = await supabase.from("agent_insights").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return true;
  return Date.now() - new Date(data.created_at).getTime() > 20 * 3_600_000;
}

/** Reuniões que começaram e ficaram "em andamento" depois do dia viram encerradas (pautas → discutidas). */
export async function autoCloseStaleMeetings(supabase: DbClient, today: string) {
  const { data } = await supabase.from("meetings").select("id").eq("status", "in_progress").lt("series_date", today);
  let n = 0;
  for (const m of data ?? []) {
    const { error } = await supabase.from("meetings").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", m.id);
    if (error) continue;
    await supabase.from("agenda_items").update({ status: "discussed", discussed_at: new Date().toISOString() }).eq("meeting_id", m.id).eq("status", "scheduled");
    n++;
  }
  return n;
}

export async function openTasksOf(supabase: DbClient, profileId: string, today: string): Promise<TaskLite[]> {
  const { data } = await supabase.from("tasks").select("id,title,due_date,status,unit:business_units(name)").eq("owner_id", profileId).is("deleted_at", null).not("status", "in", '("done","cancelled")').order("due_date", { ascending: true, nullsFirst: false }).limit(40);
  const list = (data ?? []).map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, status: t.status, unit: t.unit?.name ?? null }));
  // atrasadas primeiro
  return list.sort((a, b) => {
    const la = a.due_date && a.due_date < today ? 0 : 1, lb = b.due_date && b.due_date < today ? 0 : 1;
    return la - lb || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });
}

export type DigestContext = Omit<DigestInput, "firstName" | "isAdmin" | "myTasks" | "myPautas" | "appUrl" | "today">;

/** Monta o contexto comum do resumo da véspera (igual para todos; a parte pessoal entra depois). */
export async function buildDigestContext(supabase: DbClient, next: { id: string; series_date: string; scheduled_at: string; status: string; duration_minutes: number }, today: string, deadlineLabel: string, actorId: string | null): Promise<DigestContext> {
  const [{ data: last }, { data: blocks }, { data: items }, { data: insights }, { data: openTasks }] = await Promise.all([
    supabase.from("meetings").select("id,series_date,title,minutes:meeting_minutes(title,summary,content,status,drive_url,file_name)").in("status", ["closed", "in_progress"]).lt("series_date", today).order("series_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("meeting_blocks").select("id,title,kind,duration_minutes,sort_order").eq("meeting_id", next.id).order("sort_order"),
    supabase.from("agenda_items").select("id,title,block_id,allotted_minutes,suggested_minutes,sort_order,presenter:profiles!agenda_items_presenter_id_fkey(short_name),author:profiles!agenda_items_submitted_by_fkey(short_name)").eq("meeting_id", next.id).eq("status", "scheduled").is("deleted_at", null).order("sort_order"),
    supabase.from("agent_insights").select("kind,title,suggestion").eq("status", "open").order("score", { ascending: false }).limit(3),
    supabase.from("tasks").select("owner_id,due_date,owner:profiles!tasks_owner_id_fkey(short_name,full_name)").is("deleted_at", null).not("status", "in", '("done","cancelled")').limit(500),
  ]);

  let summary = last?.minutes?.summary ?? null;
  if (last && !summary && last.minutes?.content) summary = await ensureMinutesSummary(supabase, last.id, actorId);
  const approvedOrNone = !last?.minutes || last.minutes.status === "approved";

  const decisions = last
    ? ((await supabase.from("meeting_decisions").select("title,due_date,owner:profiles!meeting_decisions_owner_id_fkey(short_name),task:tasks(status)").eq("meeting_id", last.id).order("created_at")).data ?? []).map((d) => ({
        title: d.title,
        owner: d.owner?.short_name ?? null,
        due_date: d.due_date,
        done: d.task?.[0] ? d.task[0].status === "done" : null,
      }))
    : [];

  const schedule = computeSchedule(clockMinutesSP(next.scheduled_at), next.duration_minutes, blocks ?? [], (items ?? []).map((i) => ({ id: i.id, block_id: i.block_id, allotted_minutes: i.allotted_minutes, suggested_minutes: i.suggested_minutes, sort_order: i.sort_order })));
  const agenda: DigestContext["agenda"] = [];
  for (const b of schedule.blocks) {
    let cursor = b.startMin;
    for (const id of b.itemIds) {
      const it = (items ?? []).find((i) => i.id === id);
      if (!it) continue;
      const minutes = it.allotted_minutes ?? it.suggested_minutes ?? 10;
      agenda.push({ time: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`, title: it.title, presenter: it.presenter?.short_name ?? it.author?.short_name ?? "", minutes, block: b.title });
      cursor += minutes;
    }
  }

  const byOwner = new Map<string, { name: string; late: number; open: number }>();
  for (const t of openTasks ?? []) {
    const key = t.owner_id ?? "none";
    const e = byOwner.get(key) ?? { name: t.owner?.short_name ?? t.owner?.full_name ?? "Sem responsável", late: 0, open: 0 };
    e.open++;
    if (t.due_date && t.due_date < today) e.late++;
    byOwner.set(key, e);
  }

  // reuniões anteriores sem ata no app (apenas para o admin)
  const { data: noMinutes } = await supabase.from("meetings").select("id,minutes:meeting_minutes(id)").in("status", ["closed", "in_progress"]).lt("series_date", today).gte("series_date", "2026-10-01");
  const pendingClose = (noMinutes ?? []).filter((m) => !m.minutes).length;

  return {
    meeting: { id: next.id, series_date: next.series_date, time: fmtTime(next.scheduled_at), published: next.status !== "preparing", itemsCount: items?.length ?? 0 },
    deadlineLabel,
    lastMeeting: last ? { id: last.id, series_date: last.series_date, title: last.minutes?.title || last.title, summary: approvedOrNone ? summary : null, hasContent: !!last.minutes?.content && approvedOrNone, driveUrl: last.minutes?.drive_url ?? null, fileName: last.minutes?.file_name ?? null } : null,
    decisions,
    teamLate: [...byOwner.values()].filter((x) => x.open > 0).sort((a, b) => b.late - a.late || b.open - a.open),
    agenda,
    insights: (insights ?? []).map((i) => ({ kind: i.kind, title: i.title, suggestion: i.suggestion })),
    pendingClose,
  };
}

export async function personalizeDigest(supabase: DbClient, ctx: DigestContext, p: { id: string; email: string; full_name: string; short_name: string | null; role: string }, url: string, today: string): Promise<DigestInput> {
  const myTasks = await openTasksOf(supabase, p.id, today);
  const { count } = await supabase.from("agenda_items").select("id", { count: "exact", head: true }).eq("submitted_by", p.id).eq("meeting_id", ctx.meeting.id).is("deleted_at", null);
  return { ...ctx, firstName: firstName(p), isAdmin: p.role === "admin", myTasks, myPautas: count ?? 0, appUrl: url, today };
}
