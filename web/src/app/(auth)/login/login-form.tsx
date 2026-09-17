"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const DEMO = [
  { email: "recepcao@cuidarmais.demo", label: "Recepção" },
  { email: "profissional@cuidarmais.demo", label: "Profissional" },
  { email: "coordenacao@cuidarmais.demo", label: "Coordenação" },
  { email: "gestao@cuidarmais.demo", label: "Gestão" },
  { email: "admin@cuidarmais.demo", label: "Admin" },
];

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  const [show, setShow] = React.useState(false);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <form action={action} className="mt-8 space-y-5" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="E-mail" htmlFor="email">
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.fields?.email} className="h-14 pl-12" placeholder="nome@crateus.ce.gov.br" aria-invalid={Boolean(state?.error) || undefined} />
          </div>
        </Field>
        <Field label="Senha" htmlFor="password">
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input ref={passRef} id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="h-14 pr-12 pl-12" aria-invalid={Boolean(state?.error) || undefined} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2" aria-label={show ? "Esconder senha" : "Mostrar senha"}>
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </Field>
        {state?.error && <p role="alert" className="rounded-lg bg-rose-soft px-4 py-3 text-callout font-semibold text-rose-ink">{state.error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>Entrar</Button>
      </form>

      <div className="mt-10 rounded-[24px] border-2 border-dashed border-line p-4">
        <p className="text-footnote font-bold text-ink-strong">Acesso de demonstração</p>
        <p className="mb-3 text-caption text-ink-muted">Dados 100% fictícios. Senha: <b className="text-ink">Cuidar+2026</b></p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              data-demo={d.label}
              onClick={() => {
                if (emailRef.current) emailRef.current.value = d.email;
                if (passRef.current) passRef.current.value = "Cuidar+2026";
              }}
              className="rounded-full bg-surface-2 px-3 py-1.5 text-footnote font-semibold text-ink hover:bg-lilac-soft hover:text-lilac-ink"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
