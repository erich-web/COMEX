import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ---------------- Card ---------------- */
export function Card({ className, dark, green, ...props }: React.HTMLAttributes<HTMLDivElement> & { dark?: boolean; green?: boolean }) {
  return (
    <div
      className={cn(
        "border p-4 transition-colors",
        green ? "bg-green text-black border-green" : dark ? "bg-dark text-offwhite border-space" : "bg-surface border-line",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("t-display text-xl", className)} {...props} />;
}

/* ---------------- Badge ---------------- */
const badgeVariants = cva("inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] leading-none whitespace-nowrap", {
  variants: {
    variant: {
      black: "bg-black text-offwhite",
      green: "bg-green text-black",
      outline: "border border-ink text-ink",
      soft: "bg-black/6 text-ink-2",
      alert: "bg-alert text-white",
      alertSoft: "bg-alert/10 text-alert",
      amber: "bg-amber/15 text-amber",
      greenSoft: "bg-green/15 text-green-dark",
      light: "border border-offwhite/30 text-offwhite",
    },
  },
  defaultVariants: { variant: "soft" },
});
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* ---------------- Form ---------------- */
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1.5", className)} {...props} />;
}

const fieldBase =
  "w-full bg-surface border border-line-2 px-3 text-[15px] text-ink placeholder:text-mute/70 focus:border-black focus:outline-none focus-visible:outline-none transition-colors disabled:opacity-60 aria-[invalid=true]:border-alert";

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
    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

/* ---------------- Estados ---------------- */
export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line-2 px-6 py-10 text-center">
      {icon ? <div className="mx-auto mb-3 flex size-10 items-center justify-center bg-black/5 text-mute [&_svg]:size-5">{icon}</div> : null}
      <p className="t-display text-lg">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-xs text-sm text-mute">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-black/8", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

/* ---------------- Stat ---------------- */
export function Stat({ value, label, tone = "default", className }: { value: React.ReactNode; label: string; tone?: "default" | "alert" | "green" | "amber" | "mute"; className?: string }) {
  const color = { default: "text-ink", alert: "text-alert", green: "text-green-dark", amber: "text-amber", mute: "text-mute" }[tone];
  return (
    <div className={cn("border border-line bg-surface p-3", className)}>
      <div className={cn("t-display text-3xl tabular", color)}>{value}</div>
      <div className="t-label mt-1">{label}</div>
    </div>
  );
}

/* ---------------- Section header ---------------- */
export function SectionHeader({ label, title, action, className }: { label?: string; title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div>
        {label ? <div className="section-label mb-1">{label}</div> : null}
        <h2 className="t-display text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
