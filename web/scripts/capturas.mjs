/**
 * Captura as telas do sistema para o guia de apresentação.
 *   node scripts/capturas.mjs [baseURL] [pastaDeSaida]
 */
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "capturas";
fs.mkdirSync(OUT, { recursive: true });

const USERS = {
  recepcao: "recepcao@cuidarmais.demo",
  profissional: "profissional@cuidarmais.demo",
  coordenacao: "coordenacao@cuidarmais.demo",
  gestao: "gestao@cuidarmais.demo",
  admin: "admin@cuidarmais.demo",
};

const browser = await chromium.launch({ channel: "chrome" });

async function session(who, mobile = false) {
  const ctx = await browser.newContext(mobile
    ? { ...devices["iPhone 13"], locale: "pt-BR", timezoneId: "America/Fortaleza" }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "pt-BR", timezoneId: "America/Fortaleza" });
  const page = await ctx.newPage();
  if (who) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("E-mail").fill(USERS[who]);
    await page.getByLabel("Senha", { exact: true }).fill("Cuidar+2026");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/inicio", { timeout: 90_000 });
  }
  return { ctx, page };
}

async function shot(page, name, path, prepare) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {});
  if (prepare) await prepare(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("ok", name);
}

// Sem login
{
  const { ctx, page } = await session(null);
  await shot(page, "01-login", "/login");
  await ctx.close();
}

// Recepção
{
  const { ctx, page } = await session("recepcao");
  await shot(page, "02-inicio-recepcao", "/inicio");
  await shot(page, "03-pacientes-busca", "/pacientes", async (p) => {
    await p.getByLabel(/Nome, CNS, CPF/).fill("lucas ferreira silv");
    await p.getByRole("button", { name: "Buscar", exact: true }).click();
    await p.getByText(/resultado/).first().waitFor({ timeout: 30_000 });
  });
  await shot(page, "04-cadastro-duplicidade", "/pacientes/novo?nome=Lucas%20Ferreira%20Silva", async (p) => {
    await p.getByLabel("Data de nascimento").fill("2020-05-20");
    await p.getByLabel("Nome da mãe").fill("Luciana Ferreira da Silva");
    await p.getByLabel("CNS (Cartão SUS)").fill("881262594640455");
    await p.getByText("Esta pessoa já está cadastrada").waitFor({ timeout: 30_000 });
    await p.getByText("Esta pessoa já está cadastrada").scrollIntoViewIfNeeded();
  });
  await shot(page, "05-agenda", "/agenda?data=2026-09-17");
  await shot(page, "06-sem-acesso", "/auditoria");
  await ctx.close();
}

// Profissional
{
  const { ctx, page } = await session("profissional");
  await shot(page, "07-inicio-profissional", "/inicio");
  await shot(page, "08-fila", "/fila", async (p) => {
    await p.getByRole("button", { name: "Por que esta posição?" }).first().click();
  });
  await shot(page, "09-triagem", "/triagem");
  // paciente vitrine
  await page.goto(`${BASE}/pacientes`, { waitUntil: "networkidle" });
  await page.getByLabel(/Nome, CNS, CPF/).fill("lucas ferreira da silva");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("link", { name: /Lucas Ferreira da Silva/ }).first().click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}/);
  const lucas = new URL(page.url()).pathname;
  await shot(page, "10-paciente-resumo", lucas);
  await shot(page, "11-paciente-linha-do-tempo", `${lucas}?aba=jornada`);
  await shot(page, "12-paciente-plano", `${lucas}?aba=plano`);
  await shot(page, "13-encaminhamentos", "/encaminhamentos");
  await ctx.close();
}

// Coordenação
{
  const { ctx, page } = await session("coordenacao");
  await shot(page, "14-alertas", "/alertas");
  await shot(page, "15-duplicidades", "/duplicidades");
  await shot(page, "16-capacidade", "/capacidade");
  await ctx.close();
}

// Gestão
{
  const { ctx, page } = await session("gestao");
  await shot(page, "17-indicadores", "/indicadores");
  await ctx.close();
}

// Administração
{
  const { ctx, page } = await session("admin");
  await shot(page, "18-auditoria", "/auditoria?acao=sensiveis");
  await shot(page, "19-admin-usuarios", "/admin");
  await shot(page, "20-admin-parametros", "/admin?aba=parametros");
  await ctx.close();
}

// Celular
{
  const { ctx, page } = await session("profissional", true);
  await shot(page, "21-celular-inicio", "/inicio");
  await shot(page, "22-celular-fila", "/fila");
  await ctx.close();
}

await browser.close();
