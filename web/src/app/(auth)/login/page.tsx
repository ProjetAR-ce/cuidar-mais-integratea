import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { Logo, Blob } from "@/components/ui/brand";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  inativo: "Seu usuário está inativo. Procure a administração.",
  responsavel: "Responsáveis acessam pelo aplicativo Cuidar+ no celular.",
  perfil: "Seu usuário ainda não tem um perfil no sistema.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const erro = typeof sp.erro === "string" ? ERRORS[sp.erro] : undefined;

  return (
    <div className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary-soft p-12 lg:flex" aria-hidden>
        <Blob tone="peach" variant={0} className="-top-16 -left-20 size-96 animate-float" opacity={0.55} />
        <Blob tone="mint" variant={1} className="top-1/3 -right-24 size-[26rem] animate-float [animation-delay:-2s]" opacity={0.5} />
        <Blob tone="lilac" variant={2} className="-bottom-24 left-10 size-96 animate-float [animation-delay:-4s]" opacity={0.45} />
        <Blob tone="sun" variant={1} className="bottom-1/4 left-1/2 size-40 animate-float [animation-delay:-1s]" opacity={0.55} />
        <Blob tone="rose" variant={0} className="top-24 left-1/2 size-28 animate-float [animation-delay:-3s]" opacity={0.55} />

        <Logo className="relative" />
        <div className="relative flex flex-col items-center">
          <Image src="/brand/symbol.png" alt="" width={260} height={260} className="animate-float drop-shadow-[0_24px_30px_rgb(52_64_84/0.12)]" priority />
          <h2 className="mt-10 max-w-md text-center text-[2.5rem] leading-[1.1] font-extrabold text-ink-strong">
            Cada jornada merece cuidado, conexão e respeito.
          </h2>
          <p className="mt-4 max-w-md text-center text-headline text-ink-muted">
            Uma visão única e segura da rede de cuidado de pessoas com TEA em Crateús.
          </p>
        </div>
        <div className="relative flex items-center gap-3 text-footnote text-ink-muted">
          <Image src="/brand/crateus.jpg" alt="" width={40} height={40} className="rounded-lg" />
          Prefeitura Municipal de Crateús · IntegraTEA
        </div>
      </section>

      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <Blob tone="mint" variant={1} className="-top-20 -right-20 size-72 lg:hidden" opacity={0.35} />
        <Blob tone="peach" variant={0} className="-bottom-24 -left-16 size-72 lg:hidden" opacity={0.35} />
        <div className="relative w-full max-w-[420px]">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-large-title">Que bom ver você!</h1>
          <p className="mt-2 text-headline text-ink-muted">Entre com seu e-mail institucional.</p>
          {erro && <p role="alert" className="mt-5 rounded-lg bg-rose-soft px-4 py-3 text-callout font-semibold text-rose-ink">{erro}</p>}
          <LoginForm next={next} />
        </div>
      </section>
    </div>
  );
}
