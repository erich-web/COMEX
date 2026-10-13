import Link from "next/link";
import { Gavel, Link2 } from "lucide-react";
import type { Schedule } from "@/lib/agenda";
import { BLOCK_KIND_LABELS } from "@/lib/constants";
import type { BlockKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TimelineItem = { id: string; title: string; category: string; minutes: number | null; presenter: string | null; unit: string | null; requiresDecision: boolean; links: { label?: string; url: string }[] };

/** Linha do tempo da reunião: blocos com horários calculados e pautas vinculadas. */
export function AgendaTimeline({ schedule, items, showItems, linkBase = "/pautas" }: { schedule: Schedule; items: TimelineItem[]; showItems: boolean; linkBase?: string }) {
  return (
    <div className="border border-line bg-surface">
      {schedule.blocks.map((b, i) => {
        const bi = b.itemIds.map((id) => items.find((x) => x.id === id)).filter(Boolean) as TimelineItem[];
        return (
          <div key={b.id} className={cn("flex gap-3 px-3 py-3", i > 0 && "border-t border-line")}>
            <div className="w-14 shrink-0 text-right">
              <div className="t-display text-base tabular">{b.startClock}</div>
              <div className="text-[10px] text-mute tabular">{b.duration_minutes} min</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{b.title}</div>
                <span className="t-label">{BLOCK_KIND_LABELS[b.kind as BlockKind] ?? b.kind}</span>
              </div>
              {b.overBy > 0 ? <div className="mt-1 text-[11px] font-semibold text-alert">+{b.overBy} min acima do bloco</div> : null}
              {showItems && bi.length ? (
                <ol className="mt-2 space-y-1.5">
                  {bi.map((it) => (
                    <li key={it.id}>
                      <Link href={`${linkBase}/${it.id}`} className="flex items-start gap-2 border border-line bg-bg px-2.5 py-2 hover:border-black">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug">
                            {it.requiresDecision ? <Gavel className="mr-1 inline size-3.5 text-green-dark" /> : null}
                            {it.title}
                          </span>
                          <span className="block text-[11px] text-mute">
                            {it.category}
                            {it.unit ? ` · ${it.unit}` : ""}
                            {it.presenter ? ` · ${it.presenter}` : ""}
                            {it.links.length ? (
                              <span className="ml-1 inline-flex items-center gap-0.5">
                                <Link2 className="size-3" /> {it.links.length}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-bold tabular text-ink-2">{it.minutes ? `${it.minutes}′` : "—"}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : showItems && (b.kind === "deliberation" || b.kind === "growth" || b.kind === "knowledge" || b.kind === "brainstorm") ? (
                <div className="mt-1 text-[11px] text-mute">Sem pautas vinculadas</div>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className={cn("flex items-center justify-between border-t px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em]", schedule.overLimit > 0 ? "border-alert bg-alert/10 text-alert" : "border-line text-mute")}>
        <span>Encerramento previsto</span>
        <span className="tabular">
          {schedule.endClock}
          {schedule.overLimit > 0 ? ` · +${schedule.overLimit} min além do limite` : ""}
        </span>
      </div>
    </div>
  );
}
