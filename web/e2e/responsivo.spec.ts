import { expect, test } from "@playwright/test";
import { expectAccessible, login } from "./helpers";

// CA-10 / RNF-007: uso no celular sem rolagem horizontal
test.describe("Celular", () => {
  for (const path of ["/inicio", "/pacientes", "/fila", "/agenda"]) {
    test(`sem rolagem horizontal em ${path}`, async ({ page }) => {
      await login(page, "recepcao");
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await expect(page.getByRole("navigation", { name: "Navegação rápida" })).toBeVisible();
    });
  }

  test("página do paciente no celular", async ({ page }) => {
    await login(page, "profissional");
    await page.goto("/pacientes");
    await page.getByLabel(/Nome, CNS, CPF/).fill("lucas ferreira da silva");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.getByRole("link", { name: /Lucas Ferreira da Silva/ }).first().click();
    await expect(page.getByRole("heading", { name: "Lucas Ferreira da Silva" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expectAccessible(page, "paciente no celular");
  });
});
