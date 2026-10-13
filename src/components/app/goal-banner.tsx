import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Provocação da semana — card claro, sem gráficos. */
export function PromptCard({ prompt, hint, className }: { prompt?: string | null; hint?: string; className?: string }) {
  if (!prompt) return null;
  return (
    <section className={cn("rounded-[14px] border border-line bg-surface p-4", className)}>
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-violet">
        <Zap className="size-3.5" /> Provocação da semana
      </div>
      <p className="mt-2 text-[17px] font-semibold leading-[1.35]">{prompt}</p>
      {hint ? <p className="mt-1.5 text-xs text-mute">{hint}</p> : null}
    </section>
  );
}

/** Compat: antigo banner da meta. */
export function GoalBanner({ prompt, className }: { prompt?: string | null; goal?: number; compact?: boolean; meetingLabel?: string; className?: string }) {
  return <PromptCard prompt={prompt} className={className} />;
}
