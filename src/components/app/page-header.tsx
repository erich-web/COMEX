import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cabeçalho de página mobile-first. */
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
    <header className={cn("px-4 pt-4 pb-3 md:px-8 md:pt-8", dark && "bg-black text-offwhite")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {back ? (
            <Link href={back} className={cn("mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em]", dark ? "text-offwhite/60" : "text-mute")}>
              <ChevronLeft className="size-4" /> Voltar
            </Link>
          ) : null}
          {label ? <div className={cn("section-label", dark && "text-green")}>{label}</div> : null}
          <h1 className="t-display mt-1 text-[28px] md:text-4xl">{title}</h1>
        </div>
        {action ? <div className="shrink-0 pt-1">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 md:px-8 md:max-w-5xl", className)} {...props} />;
}
