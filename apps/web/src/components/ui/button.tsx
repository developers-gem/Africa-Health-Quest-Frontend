import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Button with the game's "pop" identity: 2px outline, offset shadow, press-down.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-2 border-foreground bg-primary text-primary-foreground shadow-pop-sm hover:brightness-105 active:translate-y-[2px] active:shadow-none",
        secondary:
          "border-2 border-foreground bg-secondary text-secondary-foreground shadow-pop-sm hover:brightness-110 active:translate-y-[2px] active:shadow-none",
        accent:
          "border-2 border-foreground bg-accent text-accent-foreground shadow-pop-sm hover:brightness-105 active:translate-y-[2px] active:shadow-none",
        outline:
          "border-2 border-foreground bg-card text-foreground shadow-pop-sm hover:bg-muted active:translate-y-[2px] active:shadow-none",
        destructive:
          "border-2 border-foreground bg-destructive text-destructive-foreground shadow-pop-sm hover:brightness-110 active:translate-y-[2px] active:shadow-none",
        ghost: "text-foreground hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline px-0",
        game: "border-2 border-foreground bg-primary text-primary-foreground shadow-pop text-base active:translate-y-[3px] active:shadow-none",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
