"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="text-title-1">Não foi possível carregar</h1>
      <p className="mt-2 text-callout text-ink-muted">{error.message || "Tente novamente em instantes."}</p>
      <Button onClick={reset} className="mt-6" variant="secondary"><RefreshCw /> Tentar de novo</Button>
    </Card>
  );
}
