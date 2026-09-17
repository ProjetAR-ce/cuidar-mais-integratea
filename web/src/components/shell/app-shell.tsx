"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { Bell, ChevronDown, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { NAV, type NavItem } from "./nav";
import { SearchCommand } from "./search-command";
import { Logo, Blob } from "@/components/ui/brand";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { TONE } from "@/components/ui/tone";
import { can } from "@/lib/auth/permissions";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type Profile } from "@/types/domain";

export type ShellCounts = { alerts: number; referrals: number; duplicates: number };

export function AppShell({ profile, counts, children }: { profile: Profile; counts: ShellCounts; children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const items = NAV.filter((i) => !i.permission || can(profile.role, i.permission));
  const canSearch = can(profile.role, "patients.read");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && canSearch) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSearch]);

  const [prevPath, setPrevPath] = React.useState(pathname);
  if (pathname !== prevPath) { setPrevPath(pathname); setDrawer(false); }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="relative min-h-dvh">
      <a href="#conteudo" className="sr-only z-[70] rounded-md bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>

      {/* Ambientação orgânica discreta */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <Blob tone="rose" variant={2} className="-top-24 -left-24 size-72" opacity={0.28} />
        <Blob tone="mint" variant={1} className="top-1/3 -right-28 size-80" opacity={0.2} />
        <Blob tone="sun" variant={0} className="-bottom-32 left-1/4 size-80" opacity={0.18} />
      </div>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col p-3 lg:flex" aria-label="Navegação principal">
        <div className="glass flex h-full flex-col overflow-hidden rounded-[28px] border border-white/70 shadow-card">
          <Link href="/inicio" className="px-5 pt-6 pb-5 [@media(max-height:700px)]:pt-4 [@media(max-height:700px)]:pb-3" aria-label="Cuidar+ início">
            <Logo />
          </Link>
          <SidebarNav items={items} counts={counts} isActive={isActive} />
          <div className="relative mx-3 mb-3 overflow-hidden rounded-[20px] bg-lilac-soft/70 p-4 [@media(max-height:820px)]:hidden">
            <Blob tone="lilac" variant={1} className="-right-6 -bottom-8 size-24" opacity={0.5} />
            <p className="relative text-footnote font-semibold text-lilac-ink">Cada jornada importa.</p>
            <p className="relative text-caption text-ink-muted">Prefeitura Municipal de Crateús</p>
          </div>
        </div>
      </aside>

      {/* Drawer (tablet/celular) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink-strong/30 backdrop-blur-[2px]" aria-label="Fechar menu" onClick={() => setDrawer(false)} />
          <motion.aside
            initial={{ x: -320 }} animate={{ x: 0 }} transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="relative flex h-full w-[290px] flex-col bg-surface shadow-float"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between px-5 pt-6 pb-4">
              <Logo />
              <button onClick={() => setDrawer(false)} className="flex size-9 items-center justify-center rounded-full bg-surface-2" aria-label="Fechar menu">
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav items={items} counts={counts} isActive={isActive} />
          </motion.aside>
        </div>
      )}

      <div className="relative lg:pl-[264px]">
        {/* Cabeçalho de vidro */}
        <header className="glass sticky top-0 z-20 border-b border-line/60">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
            <button className="flex size-10 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Abrir menu">
              <Menu className="size-6" />
            </button>
            <Link href="/inicio" className="lg:hidden" aria-label="Início">
              <Image src="/brand/symbol.png" alt="" width={34} height={34} />
            </Link>

            {canSearch ? (
              <button
                onClick={() => setSearchOpen(true)}
                className="glass group flex h-11 flex-1 items-center gap-3 rounded-full border border-line px-4 text-left text-callout text-ink-muted shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition hover:border-line-strong sm:max-w-[520px] lg:bg-surface"
              >
                <Search className="size-5 text-ink-muted" aria-hidden />
                <span className="flex-1 truncate">
                  <span className="sm:hidden">Buscar paciente</span>
                  <span className="hidden sm:inline">Buscar paciente por nome, CNS, CPF ou mãe…</span>
                </span>
                <span className="hidden sm:inline"><Kbd>Ctrl K</Kbd></span>
              </button>
            ) : (
              <div className="flex-1" />
            )}

            <div className="ml-auto flex items-center gap-2">
              {can(profile.role, "alerts.review") && (
                <Link href="/alertas" className="relative flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Alertas: ${counts.alerts} pendentes`}>
                  <Bell className="size-6 text-ink" />
                  {counts.alerts > 0 && (
                    <span className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-ink px-1 text-[0.6875rem] font-bold text-white ring-2 ring-surface tabular">
                      {counts.alerts > 99 ? "99+" : counts.alerts}
                    </span>
                  )}
                </Link>
              )}
              <UserMenu profile={profile} />
            </div>
          </div>
        </header>

        <main id="conteudo" className="relative mx-auto max-w-[1400px] px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>

        <footer className="relative mx-auto hidden max-w-[1400px] items-center justify-between gap-4 px-8 pb-8 text-caption text-ink-muted lg:flex">
          <div className="flex items-center gap-3">
            <Image src="/brand/crateus.jpg" alt="Prefeitura de Crateús" width={36} height={36} className="rounded-md" />
            <span>Prefeitura Municipal de Crateús · IntegraTEA</span>
          </div>
          <span>Cuidar+ · Dados fictícios para demonstração · v1.0</span>
        </footer>
      </div>

      {/* Tab bar celular (Apple) */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line/70 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navegação rápida">
        <ul className="mx-auto flex max-w-lg">
          {items.filter((i) => i.mobile).slice(0, 4).map((i) => {
            const active = isActive(i.href);
            return (
              <li key={i.href} className="flex-1">
                <Link href={i.href} aria-current={active ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold", active ? "text-ink-strong" : "text-ink-muted")}>
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition", active && TONE[i.tone].soft)}>
                    <i.icon className={cn("size-[22px]", active && TONE[i.tone].ink)} strokeWidth={active ? 2.5 : 2} aria-hidden />
                  </span>
                  {i.label.split(" ")[0]}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button onClick={() => setDrawer(true)} className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold text-ink-muted">
              <span className="flex h-7 w-12 items-center justify-center"><Menu className="size-[22px]" aria-hidden /></span>
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {canSearch && <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}

function SidebarNav({ items, counts, isActive }: { items: NavItem[]; counts: ShellCounts; isActive: (h: string) => boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 scrollbar-none">
      <ul className="space-y-1">
        {items.map((i) => {
          const active = isActive(i.href);
          const count = i.badge ? counts[i.badge] : 0;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-12 items-center gap-3 rounded-[16px] px-3 text-callout font-semibold transition-colors",
                  active ? "text-ink-strong" : "text-ink hover:bg-surface-2/80"
                )}
              >
                {active && (
                  <motion.span layoutId="nav-active" className={cn("absolute inset-0 rounded-[16px]", TONE[i.tone].soft)} transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <span className={cn("relative flex size-8 items-center justify-center rounded-[10px] transition", active ? cn(TONE[i.tone].bg, "text-ink-strong") : "text-ink-muted")}>
                  <i.icon className="size-[19px]" strokeWidth={2.3} aria-hidden />
                </span>
                <span className="relative flex-1 truncate">{i.label}</span>
                {count > 0 && (
                  <span className="relative flex h-6 min-w-6 items-center justify-center rounded-full bg-rose px-1.5 text-caption font-bold text-ink-strong tabular" aria-label={`${count} pendentes`}>
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserMenu({ profile }: { profile: Profile }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger aria-label={`Menu de ${profile.full_name}`} className="glass flex h-12 items-center gap-2.5 rounded-full border border-line py-1 pr-3 pl-1 text-left hover:border-line-strong lg:bg-surface">
        <Avatar name={profile.full_name} />
        <span className="hidden leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-callout font-bold text-ink-strong">{profile.full_name}</span>
          <span className="block max-w-[160px] truncate text-caption text-ink-muted">
            {ROLE_LABEL[profile.role]}{profile.service ? ` · ${profile.service.name}` : ""}
          </span>
        </span>
        <ChevronDown className="hidden size-4 text-ink-muted sm:block" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-[20px] border border-line bg-surface p-2 shadow-float">
          <div className="px-3 py-2">
            <p className="font-bold text-ink-strong">{profile.full_name}</p>
            <p className="text-footnote text-ink-muted">{profile.job_title ?? ROLE_LABEL[profile.role]}</p>
            <p className="truncate text-caption text-ink-muted">{profile.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link href="/perfil" className="flex h-10 cursor-pointer items-center gap-2 rounded-[12px] px-3 text-callout outline-none data-[highlighted]:bg-surface-2">
              <UserRound className="size-4" /> Meu perfil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => { void signOut(); }}
            className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-[12px] px-3 text-callout text-rose-ink outline-none data-[highlighted]:bg-rose-soft"
          >
            <LogOut className="size-4" /> Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
