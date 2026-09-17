import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "btn-3d bg-primary text-white hover:bg-primary-strong",
        mint: "btn-3d bg-primary text-white hover:bg-primary-strong",
        peach: "btn-3d bg-peach-soft text-peach-ink ring-1 ring-inset ring-peach-edge/30 hover:bg-peach-soft",
        lilac: "btn-3d bg-primary-soft text-primary-ink ring-1 ring-inset ring-primary/25 hover:bg-primary-soft",
        sun: "btn-3d bg-sun-soft text-sun-ink ring-1 ring-inset ring-sun-edge/40",
        danger: "btn-3d bg-rose-soft text-rose-ink ring-1 ring-inset ring-rose-edge/30",
        secondary: "btn-3d border border-line-strong bg-surface text-ink-strong hover:bg-surface-2",
        ghost: "text-ink hover:bg-surface-2 active:bg-line/60 transition-colors",
        link: "text-primary underline-offset-4 hover:underline px-0!",
      },
      size: {
        sm: "h-9 rounded-md px-3.5 text-footnote",
        md: "h-11 rounded-md px-5 text-callout",
        lg: "h-14 rounded-md px-7 text-headline",
        icon: "size-11 rounded-md",
        "icon-sm": "size-9 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild ? children : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { buttonVariants };
