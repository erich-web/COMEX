import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ---------------- Card ---------------- */
export function Card({ className, dark, green, ...props }: React.HTMLAttributes<HTMLDivElement> & { dark?: boolean; green?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border p-4 transition-colors",
        green ? "bg-green-soft text-green-dark border-green/30" : dark ? "bg-ink text-white border-ink" : "bg-surface border-line",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-bold", className)} {...props} />;
}

/* ---------------- Badge ---------------- */
const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-semibold leading-none whitespace-nowrap", {
  variants: {
    variant: {
      black: "bg-ink text-white",
      primary: "bg-primary-soft text-primary-ink",
      green: "bg-green-soft text-green-dark",
      outline: "border border-line-2 text-ink-2",
      soft: "bg-surface-2 text-ink-2",
      alert: "bg-alert text-white",
      alertSoft: "bg-alert-soft text-alert",
      amber: "bg-amber-soft text-amber",
      greenSoft: "bg-green-soft text-green-dark",
      violet: "bg-violet-soft text-violet",
      light: "border border-white/30 text-white",
    },
  },
  defaultVariants: { variant: "soft" },
});
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* ---------------- Form ---------------- */
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-semibold text-ink-2", className)} {...props} />;
}

const fieldBase =
  "w-full rounded-[10px] bg-surface border border-line-2 px-3 text-[15px] text-ink placeholder:text-mute/70 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none focus-visible:outline-none transition-colors disabled:opacity-60 aria-[invalid=true]:border-alert";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-[88px] py-2.5 leading-relaxed resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select ref={ref} className={cn(fieldBase, "h-11 appearance-none pr-9", className)} {...props}>
      {children}
    </select>
    <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </div>
));
Select.displayName = "Select";

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-alert">{children}</p>;
}

export function Hint({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <p className={cn("mt-1 text-xs text-mute", className)}>{children}</p>;
}

/** Chip selecionável (duração, temática, empresa). */
export function Chip({ active, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-full border px-3 text-[13px] font-medium transition-colors",
        active ? "border-primary bg-primary-soft font-semibold text-primary-ink" : "border-line-2 bg-surface text-ink-2 hover:border-mute",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------- Estados ---------------- */
export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-line-2 bg-surface px-6 py-10 text-center">
      {icon ? <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-5">{icon}</div> : null}
      <p className="text-base font-bold">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-xs text-sm text-mute">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

/* ---------------- Stat ---------------- */
export function Stat({ value, label, tone = "default", className }: { value: React.ReactNode; label: string; tone?: "default" | "alert" | "green" | "amber" | "mute"; className?: string }) {
  const color = { default: "text-ink", alert: "text-alert", green: "text-green-dark", amber: "text-amber", mute: "text-mute" }[tone];
  return (
    <div className={cn("rounded-[12px] border border-line bg-surface px-4 py-3", className)}>
      <div className="text-xs font-medium text-mute">{label}</div>
      <div className={cn("mt-0.5 text-2xl font-bold tabular", color)}>{value}</div>
    </div>
  );
}

/* ---------------- Section header ---------------- */
export function SectionHeader({ label, title, action, className }: { label?: string; title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div>
        {label ? <div className="section-label mb-1">{label}</div> : null}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {action}
    </div>
  );
}
