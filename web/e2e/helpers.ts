import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const PASSWORD = "Cuidar+2026";
export const USERS = {
  recepcao: "recepcao@cuidarmais.demo",
  profissional: "profissional@cuidarmais.demo",
  creaes: "creaes@cuidarmais.demo",
  coordenacao: "coordenacao@cuidarmais.demo",
  gestao: "gestao@cuidarmais.demo",
  admin: "admin@cuidarmais.demo",
} as const;

export async function login(page: Page, who: keyof typeof USERS) {
  await page.waitForLoadState("load").catch(() => {});
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(USERS[who]);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio", { timeout: 60_000 });
}

/** Falha em violações graves ou críticas do WCAG 2.2 AA */
export async function expectAccessible(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal")
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `Acessibilidade em ${context}`).toEqual([]);
}
