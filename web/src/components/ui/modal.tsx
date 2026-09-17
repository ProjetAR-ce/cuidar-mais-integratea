"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sheet que sobe no celular e modal centralizado no desktop (Apple). */
export function Modal({
  open, onOpenChange, title, description, children, footer, size = "md", trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  trigger?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-strong/30 backdrop-blur-[3px] data-[state=open]:animate-[fade-up_200ms_ease-out]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface shadow-float outline-none",
            "inset-x-0 bottom-0 rounded-t-[28px] data-[state=open]:animate-[sheet-up_320ms_cubic-bezier(0.22,1,0.36,1)]",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:data-[state=open]:animate-[fade-up_240ms_ease-out]",
            size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : size === "xl" ? "sm:max-w-5xl" : "sm:max-w-xl"
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="flex items-start gap-3 px-6 pt-5 pb-2">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-title-2 font-bold text-ink-strong">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-callout text-ink-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Janela"}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted hover:bg-line" aria-label="Fechar">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 pt-2 pb-6">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
