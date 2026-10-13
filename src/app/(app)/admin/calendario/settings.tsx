"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import { saveSetting } from "@/actions/admin";
import { ensureUpcomingMeetings } from "@/actions/meetings";
import { Button } from "@/components/ui/button";
import { Card, Hint, Input, Label, Select } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { BLOCK_KIND_LABELS } from "@/lib/constants";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type Cal = { weekday: number; time: string; duration_minutes: number };
type Dl = { weekday: number; time: string; label: string };
type Blk = { order: number; kind: string; title: string; minutes: number };

export function CalendarSettings({ calendar, agendaDeadline, prepDeadline, defaultBlocks }: { calendar: Cal; agendaDeadline: Dl; prepDeadline: Dl; defaultBlocks: Blk[] }) {
  const router = useRouter();
  const [cal, setCal] = useState(calendar);
  const [ad, setAd] = useState(agendaDeadline);
  const [pd, setPd] = useState(prepDeadline);
  const [blocks, setBlocks] = useState(defaultBlocks);
  const [pending, start] = useTransition();
  const total = blocks.reduce((a, b) => a + (Number(b.minutes) || 0), 0);
  const label = (d: Dl) => `${DAYS[d.weekday]}-feira até ${d.time.replace(":00", "h")}`.replace("Sábado-feira", "Sábado").replace("Domingo-feira", "Domingo");

  function saveAll() {
    start(async () => {
      const r1 = await saveSetting("calendar", { ...cal, timezone: "America/Sao_Paulo" });
      const r2 = await saveSetting("agenda_deadline", { ...ad, label: label(ad) });
      const r3 = await saveSetting("prep_deadline", { ...pd, label: label(pd) });
      const r4 = await saveSetting("default_blocks", blocks.map((b, i) => ({ ...b, order: i + 1, minutes: Number(b.minutes) })));
      const bad = [r1, r2, r3, r4].find((r) => !r.ok);
      if (bad && !bad.ok) return toast.error(bad.error);
      toast("Configurações salvas", { description: "Valem para as próximas reuniões criadas." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="section-label">Recorrência do COMEX</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Dia</Label>
            <Select value={cal.weekday} onChange={(e) => setCal({ ...cal, weekday: Number(e.target.value) })}>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Início</Label>
            <Input type="time" value={cal.time} onChange={(e) => setCal({ ...cal, time: e.target.value })} />
          </div>
          <div>
            <Label>Duração (min)</Label>
            <Input type="number" value={cal.duration_minutes} onChange={(e) => setCal({ ...cal, duration_minutes: Number(e.target.value) })} />
          </div>
        </div>
        <Hint>Fuso America/Sao_Paulo. Reuniões futuras são criadas automaticamente com esta recorrência.</Hint>
      </Card>

      <Card className="space-y-3">
        <div className="section-label">Prazos de preparação</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Envio de pautas — dia</Label>
            <Select value={ad.weekday} onChange={(e) => setAd({ ...ad, weekday: Number(e.target.value) })}>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>até</Label>
            <Input type="time" value={ad.time} onChange={(e) => setAd({ ...ad, time: e.target.value })} />
          </div>
          <div>
            <Label>Indicadores, tarefas e check-ins — dia</Label>
            <Select value={pd.weekday} onChange={(e) => setPd({ ...pd, weekday: Number(e.target.value) })}>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>até</Label>
            <Input type="time" value={pd.time} onChange={(e) => setPd({ ...pd, time: e.target.value })} />
          </div>
        </div>
        <Hint>Contribuições fora do prazo não são bloqueadas — apenas marcadas como atrasadas/extraordinárias.</Hint>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="section-label">Agenda-base (blocos padrão)</div>
          <span className={`text-xs font-bold tabular ${total > cal.duration_minutes ? "text-alert" : "text-ink-2"}`}>
            {total}/{cal.duration_minutes} min
          </span>
        </div>
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_auto] gap-2">
              <div className="space-y-1">
                <Input value={b.title} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className="h-10" />
                <Select value={b.kind} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, kind: e.target.value } : x)))} className="h-9 text-xs">
                  {Object.entries(BLOCK_KIND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <Input type="number" value={b.minutes} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, minutes: Number(e.target.value) } : x)))} className="h-10" aria-label="Minutos" />
              <button className="p-1 text-mute hover:text-alert" onClick={() => setBlocks(blocks.filter((_, k) => k !== i))} aria-label="Remover">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setBlocks([...blocks, { order: blocks.length + 1, kind: "custom", title: "Novo bloco", minutes: 15 }])}>
          <Plus /> Bloco
        </Button>
      </Card>

      <Button variant="primary" size="lg" block loading={pending} onClick={saveAll}>
        Salvar configurações
      </Button>
    </div>
  );
}

export function EnsureMeetingsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await ensureUpcomingMeetings(12);
          if (r.ok) {
            toast(`${r.data?.created ?? 0} reunião(ões) criadas`);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      <RefreshCw /> Gerar próximas 12 semanas
    </Button>
  );
}
