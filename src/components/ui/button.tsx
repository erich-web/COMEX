import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-[11px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 select-none active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-black text-offwhite hover:bg-dark",
        green: "bg-green text-black hover:bg-green-dark",
        outline: "border border-line-2 bg-transparent text-ink hover:border-black hover:bg-black/5",
        ghost: "bg-transparent text-ink hover:bg-black/5",
        danger: "border border-alert text-alert bg-transparent hover:bg-alert/10",
        link: "bg-transparent text-ink border-b border-ink px-0 py-0 h-auto tracking-[0.08em] hover:text-green hover:border-green",
        dark: "bg-dark text-offwhite border border-space hover:border-green",
      },
      size: {
        sm: "h-9 px-4 text-[10px]",
        md: "h-11 px-6",
        lg: "h-13 px-8 text-[12px]",
        icon: "h-11 w-11 px-0",
        iconSm: "h-9 w-9 px-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, block }), className)} ref={ref} disabled={disabled || loading} {...props}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
