import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/primitives";
import { configuredModel, describeKey, hasLLM } from "@/lib/llm";
import { emailStatus } from "@/lib/email";
import { hasServiceRole } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/format";
import { AiControls, EmailControls, NotificationSettingsForm, MinutesBulkImport } from "./controls";

export const metadata = { title: "IA e e-mails" };

export default async function IaPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, { data: runs }, { data: emails }, { data: jobs }, { data: insightsRun }, { count: insightsOpen }, { data: minutesStats }, { count: noText }] = await Promise.all([
    getSettings(),
    supabase.from("ai_runs").select("id,kind,model,ok,error,input_tokens,output_tokens,duration_ms,created_at,actor:profiles(short_name)").order("created_at", { ascending: false }).limit(12),
    supabase.from("email_log").select("id,kind,to_email,subject,status,error,sent_at").order("sent_at", { ascending: false }).limit(12),
    supabase.from("job_runs").select("id,kind,ok,report,error,started_at,finished_at").order("started_at", { ascending: false }).limit(5),
    supabase.from("agent_insights").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("agent_insights").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("meeting_minutes").select("meeting_id,content,drive_url,file_path,meeting:meetings(series_date)").order("updated_at", { ascending: false }).limit(200),
    supabase.from("meeting_minutes").select("id", { count: "exact", head: true }).or("content.is.null,content.eq."),
  ]);

  const withText = (minutesStats ?? []).filter((m) => (m.content ?? "").trim().length > 0).length;
  const importable = (minutesStats ?? []).filter((m) => !(m.content ?? "").trim() && m.drive_url && /1drv\.ms|onedrive\.live\.com|sharepoint\.com|drive\.google\.com/i.test(m.drive_url)).map((m) => ({ meeting_id: m.meeting_id, date: m.meeting?.series_date ?? "", url: m.drive_url! }));
  const es = emailStatus();
  const cronSecret = !!(process.env.CRON_SECRET ?? "").trim();
  const serviceRole = hasServiceRole();
  const lastDaily = (jobs ?? []).find((j) => j.kind === "daily");

  const KIND: Record<string, string> = { analysis: "Análise de atas e pautas", question: "Pergunta livre", agenda_plan: "Sugestão de agenda", minutes_structure: "Estruturar ata", minutes_draft: "Resumo/rascunho de ata", agenda_draft: "Pautas a partir de texto/arquivo", agenda_assist: "Completar pauta", classify: "Classificar pauta", test: "Teste" };
  const EKIND: Record<string, string> = { task_reminder: "Lembrete de compromissos", pre_comex_digest: "Resumo da véspera", test: "Teste" };

  return (
    <div className="fade-in">
      <PageHeader title="IA e e-mails" label="Administração" back="/admin" />
      <Container className="space-y-6 py-4">
        {/* ---------------- IA ---------------- */}
        <section className="space-y-3">
          <div className="section-label">Agente COMEX (IA)</div>
          <Card className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Chave da Anthropic" value={hasLLM() ? describeKey() : "não configurada"} ok={hasLLM()} />
              <Row label="Modelo" value={`${configuredModel()}${process.env.ANTHROPIC_MODEL ? " (ANTHROPIC_MODEL)" : " (padrão, com fallback automático)"}`} ok />
              <Row label="Atas com texto" value={`${withText} de ${(minutesStats ?? []).length}${noText ? ` · ${noText} sem texto` : ""}`} ok={withText > 0} />
              <Row label="Análises abertas" value={`${insightsOpen ?? 0}${insightsRun ? ` · última rodada ${fmtDateTime(insightsRun.created_at)}` : " · nenhuma rodada ainda"}`} ok={(insightsOpen ?? 0) > 0} />
            </div>
            <AiControls enabled={hasLLM()} />
            <p className="text-xs text-mute">O agente lê as atas com texto, as decisões, os compromissos e as pautas. Sem texto nas atas ele só enxerga títulos e links — importe as atas abaixo ou no editor de cada reunião.</p>
          </Card>
          {importable.length ? <MinutesBulkImport items={importable} /> : null}
          <Card className="p-0">
            <div className="border-b border-line px-4 py-2.5 text-[12px] font-semibold text-mute">Últimas chamadas à IA</div>
            {(runs ?? []).length === 0 ? (
              <p className="px-4 py-3 text-sm text-mute">Nenhuma chamada registrada ainda.</p>
            ) : (
              <ul className="divide-y divide-surface-2">
                {runs!.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                    <Badge variant={r.ok ? "green" : "alertSoft"}>{r.ok ? "ok" : "erro"}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {KIND[r.kind] ?? r.kind} <span className="text-mute">· {r.model ?? "—"}{r.actor?.short_name ? ` · ${r.actor.short_name}` : ""}</span>
                      </div>
                      <div className="text-[12px] text-mute">
                        {fmtDateTime(r.created_at)}
                        {r.duration_ms != null ? ` · ${(r.duration_ms / 1000).toFixed(1)}s` : ""}
                        {r.input_tokens ? ` · ${r.input_tokens} tokens de entrada` : ""}
                        {r.output_tokens ? ` · ${r.output_tokens} de saída` : ""}
                      </div>
                      {r.error ? <div className="mt-0.5 text-[12px] text-alert">{r.error}</div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* ---------------- E-MAIL ---------------- */}
        <section className="space-y-3">
          <div className="section-label">E-mails e rotina diária</div>
          <Card className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Resend (envio de e-mail)" value={es.keyHint} ok={es.configured} />
              <Row label="Remetente" value={es.from + (es.usingTestSender ? " — remetente de teste: só entrega para o dono da conta Resend. Defina EMAIL_FROM após verificar o domínio." : "")} ok={!es.usingTestSender} />
              <Row label="Chave de serviço do Supabase" value={serviceRole ? "configurada (SUPABASE_SERVICE_ROLE_KEY)" : "não configurada — a rotina automática da Vercel precisa dela"} ok={serviceRole} />
              <Row label="Segredo do cron" value={cronSecret ? "configurado (CRON_SECRET)" : "não configurado — a Vercel não consegue chamar a rotina"} ok={cronSecret} />
              <Row label="Última rotina automática" value={lastDaily ? `${fmtDateTime(lastDaily.started_at)} · ${lastDaily.ok ? "ok" : `erro: ${lastDaily.error ?? ""}`}` : "nunca rodou"} ok={!!lastDaily?.ok} />
            </div>
            <EmailControls enabled={es.configured} />
            <p className="text-xs text-mute">
              A rotina roda todo dia às 8h (horário de São Paulo): na véspera do COMEX envia o resumo (ata anterior, decisões, compromissos, agenda, link de pautas e análises do agente); nos outros dias lembra quem tem compromissos pendentes a cada {settings.notifications.task_reminder_every_days} dias.
              Reuniões esquecidas &quot;em andamento&quot; são encerradas automaticamente no dia seguinte.
            </p>
          </Card>
          <NotificationSettingsForm initial={settings.notifications} />
          <Card className="p-0">
            <div className="border-b border-line px-4 py-2.5 text-[12px] font-semibold text-mute">Últimos e-mails</div>
            {(emails ?? []).length === 0 ? (
              <p className="px-4 py-3 text-sm text-mute">Nenhum e-mail enviado ainda.</p>
            ) : (
              <ul className="divide-y divide-surface-2">
                {emails!.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                    <Badge variant={e.status === "sent" ? "green" : e.status === "failed" ? "alertSoft" : "soft"}>{e.status === "sent" ? "enviado" : e.status === "failed" ? "falhou" : "pulado"}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {EKIND[e.kind] ?? e.kind} <span className="text-mute">· {e.to_email}</span>
                      </div>
                      <div className="truncate text-[12px] text-mute">{fmtDateTime(e.sent_at)} · {e.subject}</div>
                      {e.error ? <div className="mt-0.5 text-[12px] text-alert">{e.error}</div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </Container>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-line bg-bg px-3 py-2">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-green" : "bg-alert"}`} />
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-mute">{label}</div>
        <div className="break-words text-[13px]">{value}</div>
      </div>
    </div>
  );
}
