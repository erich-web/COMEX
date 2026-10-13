"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet mobile-first: sobe de baixo no celular, painel lateral no desktop.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "bottom",
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "bottom" | "right";
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 fade-in" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface text-ink shadow-2xl focus:outline-none rounded-t-2xl md:rounded-none",
            side === "bottom"
              ? "inset-x-0 bottom-0 max-h-[92dvh] slide-up md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:max-h-none"
              : "inset-y-0 right-0 w-full max-w-[520px]",
            className,
          )}
          style={{ paddingBottom: "var(--safe-b)" }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-sm text-mute">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="flex size-9 shrink-0 items-center justify-center hover:bg-ink/5" aria-label="Fechar">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  danger,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 shadow-2xl focus:outline-none fade-up">
          <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
          {description ? <Dialog.Description className="mt-2 text-sm text-ink-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close className="h-10 px-4 text-[11px] font-semibold  hover:bg-ink/5">Cancelar</Dialog.Close>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
              className={cn("h-10 px-4 text-[11px] font-semibold  disabled:opacity-50", danger ? "bg-alert text-white" : "bg-primary text-white")}
            >
              {busy ? "…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
