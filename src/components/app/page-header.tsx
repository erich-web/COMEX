import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cabeçalho de página mobile-first: fundo branco, borda inferior, título à esquerda e ação à direita. */
export function PageHeader({
  title,
  label,
  back,
  action,
  dark,
  children,
}: {
  title: string;
  label?: string;
  back?: string;
  action?: React.ReactNode;
  dark?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("border-b border-line bg-surface px-4 pb-3 pt-4 md:px-8 md:pt-7", dark && "bg-ink text-white border-ink")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {back ? (
            <Link href={back} aria-label="Voltar" className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] border", dark ? "border-white/20 text-white" : "border-line text-ink")}>
              <ChevronLeft className="size-[18px]" />
            </Link>
          ) : null}
          <div className="min-w-0">
            {label ? <div className={cn("text-[12px] font-medium", dark ? "text-white/60" : "text-mute")}>{label}</div> : null}
            <h1 className="truncate text-[20px] font-bold tracking-[-0.01em] md:text-2xl">{title}</h1>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 md:max-w-5xl md:px-8", className)} {...props} />;
}
