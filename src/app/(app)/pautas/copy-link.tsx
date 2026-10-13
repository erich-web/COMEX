"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/toast";

export function CopyLinkButton({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink"
      onClick={async () => {
        try {
          if (navigator.share) {
            await navigator.share({ title: "RPE COMEX — enviar pautas", url });
            return;
          }
          await navigator.clipboard.writeText(url);
          setOk(true);
          toast("Link copiado");
          setTimeout(() => setOk(false), 2000);
        } catch {}
      }}
    >
      {ok ? <Check className="size-4 text-green-dark" /> : <Copy className="size-4" />} {ok ? "Copiado" : "Copiar"}
    </button>
  );
}
