"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Lightbulb } from "lucide-react";
import { linkLegacyOwners } from "@/actions/tasks";
import { convertReflection } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function LinkOwnersButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await linkLegacyOwners();
          if (r.ok) {
            toast(`${r.data?.linked ?? 0} tarefa(s) vinculadas por nome`);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      <Link2 /> Vincular por nome
    </Button>
  );
}

export function ConvertReflection({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-green-dark"
      onClick={() =>
        start(async () => {
          const r = await convertReflection(id, "growth_idea");
          if (r.ok) {
            toast(r.message ?? "Convertida");
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      <Lightbulb className="size-3.5" /> Virar ideia
    </button>
  );
}
