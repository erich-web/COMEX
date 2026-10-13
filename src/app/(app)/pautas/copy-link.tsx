"use client";

import { Copy, Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";

async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  // fallback (navegadores antigos / WebView): seleciona e copia
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyLinkButton({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold text-primary hover:bg-primary-soft"
        onClick={async () => {
          const done = await copyText(url);
          if (done) {
            setOk(true);
            toast("Link copiado", { description: url });
            setTimeout(() => setOk(false), 2000);
          } else {
            window.prompt("Copie o link:", url);
          }
        }}
      >
        {ok ? <Check className="size-4 text-green-dark" /> : <Copy className="size-4" />} {ok ? "Copiado" : "Copiar"}
      </button>
      {canShare ? (
        <button
          type="button"
          aria-label="Compartilhar link"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-primary hover:bg-primary-soft"
          onClick={async () => {
            try {
              await navigator.share({ title: "COMEX — enviar pautas", text: "Link para enviar pautas ao COMEX", url });
            } catch {}
          }}
        >
          <Share2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
