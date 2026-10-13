import Link from "next/link";
import { ChevronRight, Plus, Zap } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyTasks, getNextMeeting, getWeeklyPrompt, getLastClosedMeeting, getUnits, taskStats } from "@/lib/queries";
import { greeting, todaySP, daysBetween, addDays } from "@/lib/dates";
import { fmtDate, fmtTime, initials, plural } from "@/lib/format";
import { PromptCard } from "@/components/app/goal-banner";
import { INSIGHT_KIND_LABELS } from "@/lib/constants";

export const metadata = { title: "Início" };

export default async function HomePage() {
  const s = await requireMember();
  const supabase = await createClient();
  const today = todaySP();

  const [meeting, prompt, tasks, lastMeeting, units, { data: myItems }, { data: insight }, { count: unread }] = await Promise.all([
    getNextMeeting(),
    getWeeklyPrompt(),
    getMyTasks(s.profile.id),
    getLastClosedMeeting(),
    getUnits(),
    supabase.from("agenda_items").select("id,title,status,category,created_at,allotted_minutes,suggested_minutes,meeting_id").eq("submitted_by", s.profile.id).is("deleted_at", null).in("status", ["received", "in_review", "returned", "approved", "scheduled"]).order("created_at", { ascending: false }).limit(50),
    supabase.from("agent_insights").select("id,kind,title,body,suggestion").eq("status", "open").order("score", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", s.profile.id).is("read_at", null),
  ]);

  const mine = tasks.filter((t) => t.owner_id === s.profile.id);
  const st = taskStats(mine, today);
  const items = myItems ?? [];
  const onAgenda = items.filter((i) => i.meeting_id && meeting && i.meeting_id === meeting.id && i.status === "scheduled");
  const waiting = items.filter((i) => ["received", "in_review"].includes(i.status));
  const returned = items.filter((i) => i.status === "returned");
  const dueBefore = meeting ? st.open.filter((t) => t.due_date && t.due_date <= meeting.series_date) : st.open;
  const reviewUnits = meeting ? (units ?? []).filter((u) => (meeting.review_unit_ids ?? []).includes(u.id)) : [];
  const daysToMeeting = meeting ? daysBetween(today, meeting.series_date) : null;
  const firstName = (s.profile.short_name || s.profile.full_name || "").split(" ")[0];
  const minutes = onAgenda.reduce((a, i) => a + (i.allotted_minutes ?? i.suggested_minutes ?? 0), 0);
  // prestação de contas desta semana (responsáveis por unidade): enviada desde a última reunião encerrada / últimos 7 dias
  const weekAgo = addDays(today, -7);
  const sinceAcc = lastMeeting?.series_date && lastMeeting.series_date > weekAgo ? lastMeeting.series_date : weekAgo;
  const leadsUnit = s.units.some((u) => u.unit.slug !== "grupo-holding");
  const accountabilitySent = items.some((i) => i.category === "accountability" && i.created_at.slice(0, 10) >= sinceAcc);

  return (
    <div className="fade-in">
      <header className="border-b border-line bg-surface px-4 pb-4 pt-5 md:px-8 md:pt-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-medium text-mute">
              {meeting ? `${fmtDate(meeting.series_date, { weekday: "long", day: "2-digit", month: "short" })} · ${fmtTime(meeting.scheduled_at)}` : fmtDate(today, { weekday: "long", day: "2-digit", month: "long" })}
              {daysToMeeting != null ? <span> · {daysToMeeting === 0 ? "é hoje" : daysToMeeting === 1 ? "amanhã" : `em ${daysToMeeting} dias`}</span> : null}
            </div>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-[-0.01em] md:text-3xl">
              {greeting()}, {firstName}
            </h1>
          </div>
          <Link href="/perfil" className="relative flex size-10 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary-ink" aria-label="Perfil e notificações">
            {initials(s.profile.full_name || s.profile.email)}
            {(unread ?? 0) > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-alert text-[10px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 md:px-8 md:py-6">
        <Link href="/pautas/nova" className="flex items-center gap-4 rounded-[14px] bg-primary px-4 py-4 text-white shadow-[0_6px_16px_rgba(37,99,235,0.25)] transition-colors hover:bg-primary-dark">
          <Plus className="size-6 shrink-0" strokeWidth={2.5} />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold leading-tight">Enviar pautas para a próxima terça</span>
            <span className="mt-0.5 block text-[13px] text-white/85">Várias de uma vez · prazo sexta 17h</span>
          </span>
          <ChevronRight className="size-5 shrink-0" />
        </Link>

        <PromptCard prompt={prompt?.text} hint="Responda como pauta ou leve direto para a reunião." />

        <section>
          <div className="mb-2 text-[13px] font-semibold text-mute">Próximo COMEX{meeting ? ` · ${fmtDate(meeting.series_date, { weekday: "short", day: "2-digit", month: "short" })}` : ""}</div>
          <div className="divide-y divide-surface-2 overflow-hidden rounded-[14px] border border-line bg-surface">
            <Row href={onAgenda.length ? "/proximo-comex" : "/pautas"} dot={onAgenda.length ? "green" : waiting.length ? "amber" : "mute"} right={onAgenda.length ? `${minutes} min` : undefined}>
              {onAgenda.length
                ? `${plural(onAgenda.length, "pauta sua está", "pautas suas estão")} na agenda`
                : waiting.length
                  ? `${plural(waiting.length, "pauta sua aguarda", "pautas suas aguardam")} organização`
                  : returned.length
                    ? `${plural(returned.length, "pauta devolvida", "pautas devolvidas")} para ajuste`
                    : "Você ainda não enviou pautas"}
            </Row>
            {leadsUnit ? (
              <Row href="/pautas/nova" dot={accountabilitySent ? "green" : "amber"}>
                {accountabilitySent ? "Prestação de contas da unidade enviada" : "Prestação de contas da unidade ainda não enviada"}
              </Row>
            ) : null}
            <Row href="/tarefas" dot={st.late.length ? "alert" : dueBefore.length ? "amber" : "green"}>
              {st.late.length
                ? `${plural(st.late.length, "compromisso seu está atrasado", "compromissos seus estão atrasados")}`
                : dueBefore.length
                  ? `${plural(dueBefore.length, "compromisso seu vence", "compromissos seus vencem")} antes da reunião`
                  : st.open.length
                    ? `${plural(st.open.length, "compromisso aberto", "compromissos abertos")}, nenhum atrasado`
                    : "Nenhum compromisso pendente"}
            </Row>
            {reviewUnits.length ? (
              <Row href="/admin" dot="primary" right="40 min" plain={!s.isAdmin}>
                Business Review: {reviewUnits.map((u) => u.name).join(" e ")}
              </Row>
            ) : null}
            {lastMeeting ? (
              <Row href={`/atas/${lastMeeting.id}`} dot="mute">
                Última ata · {fmtDate(lastMeeting.series_date, { day: "2-digit", month: "short" })}
              </Row>
            ) : null}
            <Row href="/como-funciona" dot="mute">
              Como funciona o COMEX
            </Row>
          </div>
        </section>

        {insight ? (
          <Link href="/agente" className="block rounded-[14px] border border-line bg-surface p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-primary">
              <Zap className="size-3.5" /> Agente COMEX · {INSIGHT_KIND_LABELS[insight.kind] ?? insight.kind}
            </div>
            <p className="mt-2 text-[14px] font-semibold leading-snug">{insight.title}</p>
            {insight.suggestion ? <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{insight.suggestion}</p> : null}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Row({ href, dot, right, plain, children }: { href: string; dot: "green" | "amber" | "alert" | "primary" | "mute"; right?: string; plain?: boolean; children: React.ReactNode }) {
  const color = { green: "bg-green", amber: "bg-amber", alert: "bg-alert", primary: "bg-primary", mute: "bg-line-2" }[dot];
  const inner = (
    <>
      <span className={`size-2 shrink-0 rounded-full ${color}`} />
      <span className="min-w-0 flex-1 text-[14px] font-medium">{children}</span>
      {right ? <span className="text-[12px] text-mute">{right}</span> : plain ? null : <ChevronRight className="size-4 text-line-2" />}
    </>
  );
  if (plain) return <div className="flex items-center gap-3 px-4 py-3">{inner}</div>;
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
      {inner}
    </Link>
  );
}
