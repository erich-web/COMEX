import { fmtDate } from "@/lib/format";
import { INSIGHT_KIND_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Base visual (SaaS azul): tabela única, estilos inline, pt-BR        */
/* ------------------------------------------------------------------ */

export const esc = (s: string | null | undefined) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const C = { primary: "#2563eb", ink: "#0f172a", ink2: "#334155", mute: "#64748b", line: "#e2e8f0", bg: "#f1f5f9", surface: "#ffffff", green: "#16a34a", alert: "#dc2626", amber: "#d97706" };

export function layout(opts: { preheader?: string; title: string; subtitle?: string; body: string; appUrl: string; footer?: string }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.ink};">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.surface};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
<tr><td style="padding:18px 24px;border-bottom:1px solid ${C.line};">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:30px;height:30px;background:${C.primary};border-radius:8px;color:#fff;font-weight:700;text-align:center;font-size:14px;line-height:30px;">C</td>
    <td style="padding-left:10px;font-size:14px;font-weight:700;">COMEX · Grupo RPE</td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 24px 8px;">
  <h1 style="margin:0;font-size:21px;line-height:1.3;font-weight:700;color:${C.ink};">${esc(opts.title)}</h1>
  ${opts.subtitle ? `<p style="margin:6px 0 0;font-size:14px;color:${C.mute};">${esc(opts.subtitle)}</p>` : ""}
</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:14px;line-height:1.55;color:${C.ink2};">${opts.body}</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid ${C.line};font-size:12px;color:${C.mute};">
  ${opts.footer ?? `Você recebe este e-mail por fazer parte do Comitê Executivo do Grupo RPE. Preferências em <a href="${esc(opts.appUrl)}/perfil" style="color:${C.primary};">${esc(opts.appUrl.replace(/^https?:\/\//, ""))}/perfil</a>.`}
</td></tr>
</table></td></tr></table></body></html>`;
}

export function button(label: string, href: string, color = C.primary) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;"><tr><td style="background:${color};border-radius:10px;"><a href="${esc(href)}" style="display:inline-block;padding:11px 18px;color:#fff;font-weight:700;font-size:14px;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

export function section(title: string, inner: string) {
  return `<div style="margin:20px 0 0;"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.mute};margin-bottom:8px;">${esc(title)}</div>${inner}</div>`;
}

const pill = (text: string, bg: string, fg: string) => `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${bg};color:${fg};font-size:11px;font-weight:700;white-space:nowrap;">${esc(text)}</span>`;

/* ------------------------------------------------------------------ */
/* Tipos de dados usados pelos e-mails                                  */
/* ------------------------------------------------------------------ */

export type TaskLite = { id: string; title: string; due_date: string | null; status: string; unit: string | null; owner?: string | null };
export type DecisionLite = { title: string; owner: string | null; due_date: string | null; done: boolean | null };
export type InsightLite = { kind: string; title: string; suggestion: string | null };

export function taskRows(tasks: TaskLite[], today: string, appUrl: string, showOwner = false) {
  if (!tasks.length) return `<p style="margin:0;color:${C.mute};">Nenhum compromisso pendente.</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:10px;">${tasks
    .map((t, i) => {
      const late = !!t.due_date && t.due_date < today;
      const when = t.due_date ? (late ? `${daysLate(t.due_date, today)} dias de atraso` : `até ${fmtDate(t.due_date, { day: "2-digit", month: "short" })}`) : "sem prazo";
      const status = TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status;
      const statusPill = t.status === "blocked" ? pill(status, "#fee2e2", C.alert) : t.status === "in_progress" ? pill(status, "#dbeafe", "#1e40af") : t.status === "waiting" ? pill(status, "#fef3c7", C.amber) : pill(status, "#f1f5f9", C.ink2);
      return `<tr><td style="padding:10px 12px;${i ? `border-top:1px solid ${C.line};` : ""}">
        <a href="${esc(appUrl)}/tarefas/${t.id}" style="color:${C.ink};font-weight:600;text-decoration:none;">${esc(t.title)}</a>
        <div style="margin-top:3px;font-size:12px;color:${late ? C.alert : C.mute};${late ? "font-weight:700;" : ""}">${esc(when)}${t.unit ? ` · ${esc(t.unit)}` : ""}${showOwner && t.owner ? ` · ${esc(t.owner)}` : ""} &nbsp;${statusPill}</div>
      </td></tr>`;
    })
    .join("")}</table>`;
}

function daysLate(due: string, today: string) {
  return Math.round((new Date(today + "T12:00:00Z").getTime() - new Date(due + "T12:00:00Z").getTime()) / 86400000);
}

/* ------------------------------------------------------------------ */
/* 1) Lembrete de compromissos pendentes (a cada N dias)                */
/* ------------------------------------------------------------------ */

export function taskReminderEmail(p: { firstName: string; tasks: TaskLite[]; today: string; appUrl: string; nextMeetingLabel: string | null; everyDays: number }) {
  const late = p.tasks.filter((t) => t.due_date && t.due_date < p.today);
  const subject = late.length ? `${late.length} compromisso${late.length > 1 ? "s" : ""} atrasado${late.length > 1 ? "s" : ""} · ${p.tasks.length} pendentes no COMEX` : `${p.tasks.length} compromisso${p.tasks.length > 1 ? "s" : ""} pendente${p.tasks.length > 1 ? "s" : ""} no COMEX`;
  const body = `
    <p style="margin:0 0 6px;">${esc(p.firstName)}, estes são os seus compromissos em aberto no COMEX${p.nextMeetingLabel ? ` — a próxima reunião é ${esc(p.nextMeetingLabel)} e abre com a leitura do que foi assumido` : ""}.</p>
    ${late.length ? `<p style="margin:0 0 6px;color:${C.alert};font-weight:700;">${late.length} ${late.length > 1 ? "estão atrasados" : "está atrasado"}.</p>` : ""}
    ${taskRows(p.tasks, p.today, p.appUrl)}
    ${button("Atualizar meus compromissos", `${p.appUrl}/tarefas`)}
    <p style="margin:0;font-size:12px;color:${C.mute};">Concluiu algo? Marque como concluída no app (com evidência, se tiver). Travou? Marque como bloqueada e diga o que precisa — isso entra na pauta de terça. Este lembrete chega a cada ${p.everyDays} dias enquanto houver pendências.</p>`;
  return {
    subject,
    html: layout({ preheader: `${p.tasks.length} pendentes · ${late.length} atrasados`, title: "Seus compromissos pendentes", subtitle: fmtDate(p.today, { weekday: "long", day: "2-digit", month: "long" }), body, appUrl: p.appUrl }),
    text: `${subject}\n\n${p.tasks.map((t) => `- ${t.title} (${t.due_date ? `até ${t.due_date}` : "sem prazo"}) · ${TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status}`).join("\n")}\n\nAtualize em ${p.appUrl}/tarefas`,
  };
}

/* ------------------------------------------------------------------ */
/* 2) Véspera do COMEX                                                  */
/* ------------------------------------------------------------------ */

export type DigestInput = {
  firstName: string;
  isAdmin: boolean;
  today: string;
  appUrl: string;
  meeting: { id: string; series_date: string; time: string; published: boolean; itemsCount: number };
  deadlineLabel: string;
  lastMeeting: { id: string; series_date: string; title: string; summary: string | null; hasContent: boolean; driveUrl: string | null; fileName: string | null } | null;
  decisions: DecisionLite[];
  myTasks: TaskLite[];
  teamLate: { name: string; late: number; open: number }[];
  agenda: { time: string; title: string; presenter: string; minutes: number; block: string }[];
  myPautas: number;
  insights: InsightLite[];
  pendingClose: number;
};

export function preComexDigestEmail(d: DigestInput) {
  const dateLabel = fmtDate(d.meeting.series_date, { weekday: "long", day: "2-digit", month: "long" });
  const subject = `Amanhã tem COMEX (${fmtDate(d.meeting.series_date, { day: "2-digit", month: "2-digit" })}) · ${d.myTasks.length ? `${d.myTasks.length} compromisso${d.myTasks.length > 1 ? "s" : ""} seu${d.myTasks.length > 1 ? "s" : ""} em aberto` : "sem pendências suas"}`;
  const late = d.myTasks.filter((t) => t.due_date && t.due_date < d.today);

  const lastMinutes = d.lastMeeting
    ? `<div style="border:1px solid ${C.line};border-radius:10px;padding:12px 14px;">
        <div style="font-weight:700;">${esc(d.lastMeeting.title || "COMEX")} · ${esc(fmtDate(d.lastMeeting.series_date, { day: "2-digit", month: "short" }))}</div>
        ${d.lastMeeting.summary ? `<p style="margin:6px 0 0;">${esc(d.lastMeeting.summary)}</p>` : d.lastMeeting.hasContent ? `<p style="margin:6px 0 0;color:${C.mute};">Ata registrada no app.</p>` : `<p style="margin:6px 0 0;color:${C.amber};">A ata desta reunião ainda não foi registrada no app.</p>`}
        <div style="margin-top:8px;font-size:12px;"><a href="${esc(d.appUrl)}/atas/${d.lastMeeting.id}" style="color:${C.primary};">Abrir a ata no app</a>${d.lastMeeting.driveUrl ? ` · <a href="${esc(d.lastMeeting.driveUrl)}" style="color:${C.primary};">Documento original</a>` : ""}</div>
      </div>`
    : `<p style="margin:0;color:${C.mute};">Nenhuma reunião anterior registrada.</p>`;

  const decisionsHtml = d.decisions.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:10px;">${d.decisions
        .slice(0, 12)
        .map((x, i) => `<tr><td style="padding:8px 12px;${i ? `border-top:1px solid ${C.line};` : ""}"><span style="font-weight:600;">${esc(x.title)}</span><div style="font-size:12px;color:${C.mute};margin-top:2px;">${esc(x.owner ?? "sem responsável")}${x.due_date ? ` · até ${esc(fmtDate(x.due_date, { day: "2-digit", month: "short" }))}` : ""} &nbsp;${x.done === true ? pill("Executada", "#dcfce7", C.green) : x.done === false ? pill("Em execução", "#dbeafe", "#1e40af") : pill("Sem tarefa", "#f1f5f9", C.ink2)}</div></td></tr>`)
        .join("")}</table>`
    : `<p style="margin:0;color:${C.mute};">Nenhuma decisão registrada no app para a última reunião.</p>`;

  const agendaHtml = d.meeting.published && d.agenda.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:10px;">${d.agenda
        .slice(0, 14)
        .map((a, i) => `<tr><td style="padding:7px 12px;${i ? `border-top:1px solid ${C.line};` : ""}"><span style="font-family:ui-monospace,Menlo,monospace;color:${C.mute};font-size:12px;">${esc(a.time)}</span> &nbsp;<span style="font-weight:600;">${esc(a.title)}</span><span style="color:${C.mute};font-size:12px;"> · ${esc(a.presenter)} · ${a.minutes}′</span></td></tr>`)
        .join("")}</table>`
    : `<p style="margin:0;color:${C.mute};">${d.meeting.itemsCount ? `${d.meeting.itemsCount} pauta${d.meeting.itemsCount > 1 ? "s" : ""} já na organização — a agenda será publicada no app.` : "A agenda ainda não foi publicada."}</p>`;

  const insightsHtml = d.insights.length
    ? d.insights
        .slice(0, 3)
        .map((i) => `<div style="border-left:3px solid ${C.primary};padding:6px 12px;margin:0 0 10px;background:#f8fafc;border-radius:0 8px 8px 0;"><div style="font-size:11px;font-weight:700;color:${C.primary};text-transform:uppercase;letter-spacing:.05em;">${esc(INSIGHT_KIND_LABELS[i.kind] ?? i.kind)}</div><div style="font-weight:600;margin-top:2px;">${esc(i.title)}</div>${i.suggestion ? `<div style="font-size:13px;color:${C.ink2};margin-top:3px;">${esc(i.suggestion)}</div>` : ""}</div>`)
        .join("") + `<div style="font-size:12px;"><a href="${esc(d.appUrl)}/agente" style="color:${C.primary};">Ver todas as análises e transformar em pauta</a></div>`
    : "";

  const teamHtml = d.isAdmin && d.teamLate.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:10px;">${d.teamLate
        .slice(0, 10)
        .map((t, i) => `<tr><td style="padding:7px 12px;${i ? `border-top:1px solid ${C.line};` : ""}"><span style="font-weight:600;">${esc(t.name)}</span><span style="float:right;font-size:12px;color:${C.mute};">${t.late ? `<span style="color:${C.alert};font-weight:700;">${t.late} atrasad${t.late > 1 ? "os" : "o"}</span> · ` : ""}${t.open} abert${t.open > 1 ? "os" : "o"}</span></td></tr>`)
        .join("")}</table>`
    : "";

  const body = `
    <p style="margin:0 0 4px;">${esc(d.firstName)}, o COMEX é <strong>${esc(dateLabel)}, às ${esc(d.meeting.time)}</strong>. Abrimos lendo a ata anterior e os compromissos assumidos — chegue com os seus atualizados.</p>
    ${button("Enviar pautas para amanhã", `${d.appUrl}/enviar-pautas`)}
    <p style="margin:-6px 0 0;font-size:12px;color:${C.mute};">${d.myPautas ? `Você já enviou ${d.myPautas} pauta${d.myPautas > 1 ? "s" : ""} para esta reunião.` : `Você ainda não enviou pautas para esta reunião.`} Prazo recomendado: ${esc(d.deadlineLabel)} — depois disso a pauta entra como extraordinária.</p>

    ${section("Seus compromissos em aberto" + (late.length ? ` · ${late.length} atrasado${late.length > 1 ? "s" : ""}` : ""), taskRows(d.myTasks, d.today, d.appUrl) + (d.myTasks.length ? `<div style="margin-top:8px;font-size:12px;"><a href="${esc(d.appUrl)}/tarefas" style="color:${C.primary};">Atualizar status antes da reunião</a></div>` : ""))}
    ${section("Ata da última reunião", lastMinutes)}
    ${section("Decisões da última reunião", decisionsHtml)}
    ${section("Agenda de amanhã", agendaHtml)}
    ${insightsHtml ? section("Olhar do Agente COMEX", insightsHtml) : ""}
    ${teamHtml ? section("Pendências por pessoa (visão do organizador)", teamHtml) : ""}
    ${d.isAdmin && d.pendingClose ? `<p style="margin:16px 0 0;font-size:12px;color:${C.amber};">${d.pendingClose} reuni${d.pendingClose > 1 ? "ões anteriores continuam" : "ão anterior continua"} sem encerramento no app — encerre e registre a ata em Organização.</p>` : ""}`;

  return {
    subject,
    html: layout({ preheader: `${d.myTasks.length} compromissos · ${d.decisions.length} decisões da última reunião`, title: "Amanhã tem COMEX", subtitle: `${dateLabel} · ${d.meeting.time}`, body, appUrl: d.appUrl }),
    text: `${subject}\n\nEnvie pautas: ${d.appUrl}/enviar-pautas\n\nSeus compromissos:\n${d.myTasks.map((t) => `- ${t.title} (${t.due_date ? `até ${t.due_date}` : "sem prazo"})`).join("\n") || "- nenhum"}\n\nÚltima ata: ${d.lastMeeting ? `${d.appUrl}/atas/${d.lastMeeting.id}` : "—"}\n${d.lastMeeting?.summary ?? ""}\n\nDecisões:\n${d.decisions.map((x) => `- ${x.title} (${x.owner ?? "sem responsável"})`).join("\n") || "- nenhuma"}`,
  };
}

/* ------------------------------------------------------------------ */
/* 3) Teste                                                             */
/* ------------------------------------------------------------------ */

export function testEmail(appUrl: string, who: string) {
  return {
    subject: "COMEX · e-mail de teste",
    html: layout({ title: "Os e-mails do COMEX estão funcionando", subtitle: `Enviado para ${who}`, body: `<p style="margin:0;">Se você recebeu esta mensagem, o remetente e a chave do Resend estão configurados. Os lembretes de compromissos e o resumo da véspera do COMEX usarão este mesmo canal.</p>${button("Abrir o COMEX", appUrl)}`, appUrl }),
    text: "Os e-mails do COMEX estão funcionando.",
  };
}
