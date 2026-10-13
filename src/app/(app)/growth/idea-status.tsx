"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setIdeaStatus } from "@/actions/growth";
import { GROWTH_STATUS_LABELS } from "@/lib/constants";
import type { GrowthStatus } from "@/lib/types";
import { toast } from "@/components/ui/toast";

export function IdeaStatusButton({ id, status, canChange }: { id: string; status: GrowthStatus; canChange: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canChange) return <span className="shrink-0 border border-line px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-2">{GROWTH_STATUS_LABELS[status]}</span>;
  return (
    <select
      value={status}
      disabled={pending}
      aria-label="Status da ideia"
      className="shrink-0 border border-line bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
      onChange={(e) =>
        start(async () => {
          const r = await setIdeaStatus(id, e.target.value as GrowthStatus);
          if (r.ok) router.refresh();
          else toast.error(r.error);
        })
      }
    >
      {Object.entries(GROWTH_STATUS_LABELS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}
