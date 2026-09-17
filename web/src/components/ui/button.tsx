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
        primary: "btn-3d bg-ink text-white [--edge:var(--color-ink-strong)]",
        mint: "btn-3d bg-mint text-ink-strong [--edge:var(--color-mint-edge)]",
        peach: "btn-3d bg-peach text-ink-strong [--edge:var(--color-peach-edge)]",
        lilac: "btn-3d bg-lilac text-ink-strong [--edge:var(--color-lilac-edge)]",
        sun: "btn-3d bg-sun text-ink-strong [--edge:var(--color-sun-edge)]",
        danger: "btn-3d bg-rose text-ink-strong [--edge:var(--color-rose-edge)]",
        secondary: "btn-3d border-2 border-line bg-surface text-ink [--edge:var(--color-line)] hover:bg-surface-2",
        ghost: "text-ink hover:bg-surface-2 active:bg-line/60 transition-colors",
        link: "text-lilac-ink underline-offset-4 hover:underline px-0!",
      },
      size: {
        sm: "h-9 rounded-[12px] px-3.5 text-footnote",
        md: "h-11 rounded-md px-5 text-callout",
        lg: "h-14 rounded-[18px] px-7 text-headline",
        icon: "size-11 rounded-md",
        "icon-sm": "size-9 rounded-[12px]",
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
