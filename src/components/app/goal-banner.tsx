import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fmtBRLShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bloco RPE 2030 + provocação da semana (dashboard e formulário de pautas). */
export function GoalBanner({ prompt, goal, compact, meetingLabel, className }: { prompt?: string | null; goal: number; compact?: boolean; meetingLabel?: string; className?: string }) {
  return (
    <section className={cn("relative overflow-hidden bg-black text-offwhite", compact ? "px-4 py-4" : "px-4 py-6 md:px-8 md:py-8", className)}>
      <div className="pointer-events-none absolute -right-3 -bottom-8 select-none font-serif text-[9rem] font-semibold leading-none text-offwhite/[0.04]">RPE</div>
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="section-label">Compromisso permanente</div>
          {meetingLabel ? <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-offwhite/50">{meetingLabel}</span> : null}
        </div>
        <div className={cn("t-display mt-2", compact ? "text-2xl" : "text-3xl md:text-5xl")}>
          RPE 2030 — <span className="text-green">{fmtBRLShort(goal).replace("R$ ", "R$ ")}</span>
        </div>
        {prompt ? (
          <p className={cn("mt-3 max-w-[40ch] font-serif italic text-offwhite/80", compact ? "text-[15px]" : "text-lg md:text-xl")}>“{prompt}”</p>
        ) : null}
        {!compact ? (
          <Link href="/rpe-2030" className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-green">
            Ver a rota até 2030 <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
