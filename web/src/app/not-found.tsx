import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Blob } from "@/components/ui/brand";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-6">
      <Blob tone="sun" variant={1} className="-top-16 -right-16 size-80" opacity={0.4} />
      <Blob tone="mint" variant={0} className="-bottom-20 -left-16 size-96" opacity={0.35} />
      <div className="relative max-w-md text-center">
        <Image src="/brand/symbol.png" alt="" width={120} height={120} className="mx-auto animate-float" />
        <h1 className="mt-6 text-large-title">Página não encontrada</h1>
        <p className="mt-2 text-headline text-ink-muted">O endereço pode ter mudado ou ainda não existe.</p>
        <Button asChild size="lg" className="mt-8"><Link href="/inicio">Voltar ao início</Link></Button>
      </div>
    </div>
  );
}
