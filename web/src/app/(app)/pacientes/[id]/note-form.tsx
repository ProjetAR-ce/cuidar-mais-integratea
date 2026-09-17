"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addJourneyNote } from "@/lib/actions/care";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";

export function NoteForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const r = await addJourneyNote(patientId, text);
        setSaving(false);
        if (!r.ok) return toast.error(r.error);
        setText("");
        toast.success("Anotação registrada na linha do tempo");
        router.refresh();
      }}
    >
      <label htmlFor="note" className="sr-only">Anotação</label>
      <Textarea id="note" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Contato telefônico com a família sobre a próxima consulta." className="min-h-24" />
      <Button type="submit" className="mt-3 w-full" loading={saving} disabled={text.trim().length < 5}>Registrar</Button>
    </form>
  );
}
