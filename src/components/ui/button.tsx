import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 select-none active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]",
        green: "bg-green text-white hover:bg-green-dark",
        outline: "border border-line-2 bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
        ghost: "bg-transparent text-ink-2 hover:bg-surface-2",
        danger: "border border-alert/40 text-alert bg-transparent hover:bg-alert-soft",
        link: "bg-transparent text-primary px-0 py-0 h-auto rounded-none hover:text-primary-dark hover:underline",
        dark: "bg-ink text-white hover:bg-ink-2",
        soft: "bg-primary-soft text-primary-ink hover:bg-primary-soft/70",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5 text-[14px]",
        lg: "h-13 px-6 text-[15px] rounded-[14px]",
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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, block, asChild = false, loading, children, disabled, ...props }, ref) => {
  const classes = cn(buttonVariants({ variant, size, block }), className);
  if (asChild) {
    // Slot exige exatamente um filho React — nunca adicionamos o spinner aqui.
    return (
      <Slot className={classes} ref={ref} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button className={classes} ref={ref} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </button>
  );
});
Button.displayName = "Button";

export { buttonVariants };
