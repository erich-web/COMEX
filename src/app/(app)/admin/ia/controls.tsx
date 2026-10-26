"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Eye, Send, Bell, Download, RefreshCw } from "lucide-react";
import { runAgentAnalysis } from "@/actions/agent";
import { previewDigest, sendDigestNow, sendRemindersNow, sendTestEmail, testAI } from "@/actions/notifications";
import { importMinutesFromUrl } from "@/actions/minutes";
import { saveSetting } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, Hint, Input, Label } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import type { NotificationSettings } from "@/lib/settings";

export function AiControls({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [testing, startTest] = useTransition();
  const [running, startRun] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!enabled}
        loading={testing}
        onClick={() =>
          startTest(async () => {
            const r = await testAI();
            if (r.ok) toast(r.message ?? "IA ok", { description: r.data?.answer });
            else toast.error("A IA não respondeu", r.error);
            router.refresh();
          })
        }
      >
        <Sparkles /> Testar conexão
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={!enabled}
        loading={running}
        onClick={() =>
          startRun(async () => {
            const r = await runAgentAnalysis();
            if (r.ok) toast(r.message ?? "Análises geradas");
            else toast.error("Falha na análise", r.error);
            router.refresh();
          })
        }
      >
        <RefreshCw /> {running ? "Analisando…" : "Gerar análises agora"}
      </Button>
    </div>
  );
}

export function EmailControls({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setBusy(key);
    try {
      const r = await fn();
      if (r.ok) toast(r.message ?? "Feito");
      else toast.error("Não foi possível", r.error);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!enabled} loading={busy === "test"} onClick={() => run("test", sendTestEmail)}>
          <Mail /> Enviar teste para mim
        </Button>
        <Button
          variant="outline"
          size="sm"
          loading={busy === "preview"}
          onClick={async () => {
            setBusy("preview");
            const r = await previewDigest();
            setBusy(null);
            if (r.ok && r.data) setPreview(r.data);
            else toast.error("Não foi possível montar", r.ok ? "" : r.error);
          }}
        >
          <Eye /> Pré-visualizar resumo da véspera
        </Button>
        <Button variant="outline" size="sm" disabled={!enabled} loading={busy === "digestme"} onClick={() => run("digestme", () => sendDigestNow(true))}>
          <Send /> Resumo da véspera só para mim
        </Button>
        <Button variant="soft" size="sm" disabled={!enabled} loading={busy === "digest"} onClick={() => confirm("Enviar o resumo da véspera agora para todos os membros ativos?") && run("digest", () => sendDigestNow(false))}>
          <Send /> Resumo da véspera para todos
        </Button>
        <Button variant="soft" size="sm" disabled={!enabled} loading={busy === "rem"} onClick={() => confirm("Enviar agora o lembrete de compromissos pendentes para todos que têm pendências?") && run("rem", sendRemindersNow)}>
          <Bell /> Lembrete de pendências para todos
        </Button>
      </div>
      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="Resumo da véspera" description={preview?.subject} side="right" className="md:max-w-[640px]">
        {preview ? <iframe title="Pré-visualização" srcDoc={preview.html} className="h-[80dvh] w-full rounded-[10px] border border-line bg-white" /> : null}
      </Sheet>
    </>
  );
}

export function NotificationSettingsForm({ initial }: { initial: NotificationSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Card className="space-y-3">
      <div className="section-label">Regras dos e-mails</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Lembrar pendências a cada (dias)</Label>
          <Input type="number" min={1} max={14} value={v.task_reminder_every_days} onChange={(e) => setV({ ...v, task_reminder_every_days: Number(e.target.value) })} />
          <Hint>Só para quem tem compromissos em aberto. Não envia no dia do resumo da véspera.</Hint>
        </div>
        <div>
          <Label>Resumo na véspera do COMEX</Label>
          <label className="flex h-11 items-center gap-2 rounded-[10px] border border-line-2 px-3 text-sm">
            <input type="checkbox" className="size-4 accent-[#2563eb]" checked={v.digest_day_before} onChange={(e) => setV({ ...v, digest_day_before: e.target.checked })} /> Enviar automaticamente no dia anterior
          </label>
        </div>
      </div>
      <Button
        variant="primary"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await saveSetting("notifications", { ...v, task_reminder_every_days: Math.max(1, v.task_reminder_every_days || 3), send_hour: v.send_hour ?? 8 });
            if (r.ok) toast("Regras salvas");
            else toast.error(r.error);
            router.refresh();
          })
        }
      >
        Salvar regras
      </Button>
    </Card>
  );
}

export function MinutesBulkImport({ items }: { items: { meeting_id: string; date: string; url: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  async function run() {
    setBusy(true);
    const out: string[] = [];
    for (const it of items) {
      const r = await importMinutesFromUrl(it.meeting_id, it.url);
      out.push(`${it.date}: ${r.ok ? `ok (${r.data?.chars ?? 0} caracteres)` : r.error}`);
      setLog([...out]);
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{items.length} ata{items.length > 1 ? "s" : ""} só com link, sem texto</div>
          <div className="text-xs text-mute">Tenta baixar o PDF pelo link (OneDrive compartilhado ou Google Drive público) e extrair o texto. Links restritos precisam do upload manual no editor da ata.</div>
        </div>
        <Button variant="outline" size="sm" loading={busy} onClick={run}>
          <Download /> Importar texto pelos links
        </Button>
      </div>
      {log.length ? <ul className="max-h-48 overflow-y-auto rounded-[10px] bg-bg p-2 text-[12px] text-ink-2">{log.map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
    </Card>
  );
}
