import { expect, test } from "@playwright/test";
import { expectAccessible, login } from "./helpers";

// Os testes que gravam dados usam nomes com "E2E" para ficarem fáceis de identificar.
const stamp = Date.now().toString().slice(-6);

test.describe("Critérios de aceite do MVP", () => {
  test("CA-01 · busca antes do cadastro e CNS não duplica", async ({ page }) => {
    await login(page, "recepcao");
    await page.goto("/pacientes");
    await page.getByLabel(/Nome, CNS, CPF/).fill("lucas ferreira");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByRole("link", { name: /Lucas Ferreira da Silva/ }).first()).toBeVisible();
    await expectAccessible(page, "busca de pacientes");

    await page.goto("/pacientes/novo?nome=Lucas%20Ferreira%20Silva");
    await page.getByLabel("Data de nascimento").fill("2020-05-20");
    await page.getByLabel("Nome da mãe").fill("Luciana Ferreira da Silva");
    await page.getByLabel("CNS (Cartão SUS)").fill("881262594640455");
    await expect(page.getByText("Esta pessoa já está cadastrada")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuar/ })).toBeDisabled();
  });

  test("Digitalização de ficha em papel · acesso, atalho e acessibilidade", async ({ page }) => {
    await login(page, "recepcao");
    await page.goto("/pacientes");
    await page.getByRole("link", { name: /Digitalizar ficha em papel/ }).click();
    await expect(page).toHaveURL(/\/pacientes\/digitalizar/);
    await expect(page.getByRole("heading", { name: "Digitalizar ficha" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tirar foto", exact: true })).toBeVisible();
    await expect(page.getByLabel("Escolher arquivo da ficha")).toBeAttached();
    await expect(page.getByText("Foto não é guardada")).toBeVisible();
    await expectAccessible(page, "digitalizar ficha");
  });

  test("Digitalização de ficha · gestão não acessa", async ({ page }) => {
    await login(page, "gestao");
    await page.goto("/pacientes/digitalizar");
    await expect(page).toHaveURL(/sem-acesso/);
  });

  test("CA-02 · fila priorizada e explicável", async ({ page }) => {
    await login(page, "profissional");
    await page.goto("/fila");
    const first = page.getByRole("button", { name: "Por que esta posição?" }).first();
    await first.click();
    await expect(page.getByText(/Prioridade P\d vale \d+ pontos/).first()).toBeVisible();
    await expectAccessible(page, "fila");
  });

  test("CA-03 · agenda com presença e registro", async ({ page }) => {
    await login(page, "profissional");
    await page.goto("/agenda?data=2026-09-16");
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await expect(page.getByText("Presença registrada")).toBeVisible();
    await expectAccessible(page, "agenda");
  });

  test("CA-04 · linha do tempo com mais de um serviço", async ({ page }) => {
    await login(page, "profissional");
    await page.goto("/pacientes");
    await page.getByLabel(/Nome, CNS, CPF/).fill("lucas ferreira da silva");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.getByRole("link", { name: /Lucas Ferreira da Silva/ }).first().click();
    await page.getByRole("link", { name: /Linha do tempo/ }).click();
    const filters = page.getByRole("group", { name: "Filtrar por serviço" });
    await expect(filters).toBeVisible();
    await expect.poll(() => filters.getByRole("link").count()).toBeGreaterThanOrEqual(3);
    await expectAccessible(page, "linha do tempo");
  });

  test("CA-05 · encaminhamentos recebidos e enviados", async ({ page }) => {
    await login(page, "creaes");
    await page.goto("/encaminhamentos");
    await expect(page.getByRole("tab", { name: /Aguardando resposta/ })).toBeVisible();
    await page.getByRole("tab", { name: /Enviados/ }).click();
    await expect(page).toHaveURL(/direcao=enviados/);
    await expectAccessible(page, "encaminhamentos");
  });

  test("CA-06 · alertas de cuidado fragmentado com motivo e ação", async ({ page }) => {
    await login(page, "coordenacao");
    await page.goto("/alertas");
    await expect(page.getByText("Ação recomendada:").first()).toBeVisible();
    for (const label of ["Possível duplicidade", "Sobreposição", "Encaminhamento parado", "Faltas consecutivas"]) {
      await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
    }
    await expectAccessible(page, "alertas");
  });

  test("CA-07 · capacidade e espera por serviço", async ({ page }) => {
    await login(page, "gestao");
    await page.goto("/capacidade");
    await expect(page.getByText("Onde a fila supera a capacidade")).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
    await expectAccessible(page, "capacidade");
  });

  test("CA-08 · perfil sem permissão é bloqueado", async ({ page }) => {
    await login(page, "recepcao");
    for (const path of ["/auditoria", "/indicadores", "/admin", "/triagem"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/sem-acesso/);
    }
    await login(page, "gestao");
    await page.goto("/pacientes");
    await expect(page).toHaveURL(/sem-acesso/);
  });

  test("CA-09 · auditoria registra acesso negado e consultas sensíveis", async ({ browser }) => {
    const ctxA = await browser.newContext({ baseURL: "http://localhost:3100", locale: "pt-BR", timezoneId: "America/Fortaleza" }); const recepcao = await ctxA.newPage();
    await login(recepcao, "recepcao");
    await recepcao.goto(`/admin?e2e=${stamp}`);
    await expect(recepcao).toHaveURL(/sem-acesso/);
    await ctxA.close();

    const ctxB = await browser.newContext({ baseURL: "http://localhost:3100", locale: "pt-BR", timezoneId: "America/Fortaleza" }); const admin = await ctxB.newPage();
    await login(admin, "admin");
    await admin.goto("/auditoria?acao=sensiveis");
    const log = admin.getByRole("table", { name: "Registros de auditoria" });
    await expect(log.getByText("Acesso negado").first()).toBeVisible();
    await expect(log.getByText("Consulta sensível").first()).toBeVisible();
    await expectAccessible(admin, "auditoria");
    await ctxB.close();
  });

  test("CA-10 · navegação por teclado", async ({ page }) => {
    await login(page, "recepcao");
    await page.goto("/inicio");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Buscar paciente" })).toBeVisible();
    await page.keyboard.type("heitor");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expectAccessible(page, "início");
  });
});

test("Login acessível", async ({ page }) => {
  await page.goto("/login");
  await expectAccessible(page, "login");
});
