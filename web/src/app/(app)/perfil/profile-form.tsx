"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeOwnPassword, updateOwnProfile } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/form";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [name, setName] = React.useState(fullName);
  const [tel, setTel] = React.useState(phone);
  const [pass, setPass] = React.useState("");
  const [pass2, setPass2] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="p-6">
        <h2 className="mb-4 text-headline font-bold">Dados de contato</h2>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          setBusy("p");
          const r = await updateOwnProfile({ full_name: name, phone: tel });
          setBusy(null);
          if (!r.ok) return toast.error(r.error);
          toast.success("Perfil atualizado");
          router.refresh();
        }}>
          <Field label="Nome completo" htmlFor="pf-name"><Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Telefone" htmlFor="pf-tel"><Input id="pf-tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></Field>
          <Button type="submit" variant="mint" loading={busy === "p"}>Salvar</Button>
        </form>
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 text-headline font-bold">Trocar senha</h2>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          if (pass !== pass2) return toast.error("As senhas não conferem.");
          setBusy("s");
          const r = await changeOwnPassword(pass);
          setBusy(null);
          if (!r.ok) return toast.error(r.error);
          setPass(""); setPass2("");
          toast.success("Senha alterada");
        }}>
          <Field label="Nova senha" htmlFor="pf-pass" hint="Mínimo de 8 caracteres."><Input id="pf-pass" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
          <Field label="Repita a nova senha" htmlFor="pf-pass2"><Input id="pf-pass2" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} /></Field>
          <Button type="submit" loading={busy === "s"} disabled={pass.length < 8}>Alterar senha</Button>
        </form>
      </Card>
    </div>
  );
}
