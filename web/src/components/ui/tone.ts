import type { Tone } from "@/types/domain";

/** Classes completas por tom (o Tailwind precisa das strings literais). */
export const TONE = {
  mint: { bg: "bg-mint", soft: "bg-mint-soft", ink: "text-mint-ink", edge: "border-mint-edge", ring: "ring-mint/60", fill: "var(--color-mint)", strong: "var(--color-mint-edge)" },
  peach: { bg: "bg-peach", soft: "bg-peach-soft", ink: "text-peach-ink", edge: "border-peach-edge", ring: "ring-peach/60", fill: "var(--color-peach)", strong: "var(--color-peach-edge)" },
  lilac: { bg: "bg-lilac", soft: "bg-lilac-soft", ink: "text-lilac-ink", edge: "border-lilac-edge", ring: "ring-lilac/60", fill: "var(--color-lilac)", strong: "var(--color-lilac-edge)" },
  sun: { bg: "bg-sun", soft: "bg-sun-soft", ink: "text-sun-ink", edge: "border-sun-edge", ring: "ring-sun/60", fill: "var(--color-sun)", strong: "var(--color-sun-edge)" },
  rose: { bg: "bg-rose", soft: "bg-rose-soft", ink: "text-rose-ink", edge: "border-rose-edge", ring: "ring-rose/60", fill: "var(--color-rose)", strong: "var(--color-rose-edge)" },
  ink: { bg: "bg-ink", soft: "bg-surface-2", ink: "text-ink", edge: "border-line-strong", ring: "ring-line", fill: "var(--color-ink-faint)", strong: "var(--color-ink)" },
} satisfies Record<Tone, Record<string, string>>;

export function toneOf(value?: string | null): Tone {
  return value && value in TONE ? (value as Tone) : "ink";
}

export function toneFromText(text: string): Tone {
  const tones: Tone[] = ["mint", "peach", "lilac", "sun", "rose"];
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[h % tones.length];
}
