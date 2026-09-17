import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Blob } from "@/components/ui/brand";

export const metadata = { title: "Acesso restrito" };

export default function SemAcesso() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <Blob tone="rose" variant={0} className="-top-20 -left-20 size-80" opacity={0.35} />
      <Blob tone="lilac" variant={2} className="-right-20 -bottom-20 size-96" opacity={0.3} />
      <div className="card relative max-w-md p-8 text-center">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-rose text-ink-strong shadow-[0_5px_0_var(--color-rose-edge)]">
          <ShieldAlert className="size-10" strokeWidth={2.4} />
        </span>
        <h1 className="mt-6 text-title-1">Acesso restrito</h1>
        <p className="mt-2 text-callout text-ink-muted">
          Esta área não faz parte das atribuições do seu perfil. Cada pessoa vê apenas o necessário para a sua função. A tentativa foi registrada na auditoria.
        </p>
        <Button asChild className="mt-6" size="lg"><Link href="/inicio">Voltar ao início</Link></Button>
      </div>
    </div>
  );
}
