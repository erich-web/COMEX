"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { linkLegacyOwners } from "@/actions/tasks";
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
