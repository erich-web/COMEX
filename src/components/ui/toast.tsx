"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; description?: string; kind: "ok" | "error" | "info" };
type Listener = (t: Toast) => void;

const listeners = new Set<Listener>();
let seq = 1;

export function toast(title: string, opts: { description?: string; kind?: Toast["kind"] } = {}) {
  const t: Toast = { id: seq++, title, kind: opts.kind ?? "ok", description: opts.description };
  listeners.forEach((l) => l(t));
}
toast.error = (title: string, description?: string) => toast(title, { kind: "error", description });
toast.info = (title: string, description?: string) => toast(title, { kind: "info", description });

export function Toaster() {
  const [items, setItems] = React.useState<Toast[]>([]);
  React.useEffect(() => {
    const l: Listener = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.kind === "error" ? 7000 : 4000);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4" style={{ bottom: "calc(var(--nav-h) + var(--safe-b) + 12px)" }}>
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 border px-4 py-3 shadow-lg fade-up",
            t.kind === "error" ? "bg-alert text-white border-alert" : t.kind === "info" ? "bg-dark text-offwhite border-space" : "bg-black text-offwhite border-black",
          )}
        >
          {t.kind === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className={cn("mt-0.5 size-4 shrink-0", t.kind === "ok" && "text-green")} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{t.title}</p>
            {t.description ? <p className="mt-0.5 text-xs opacity-80">{t.description}</p> : null}
          </div>
          <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="opacity-70 hover:opacity-100" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
