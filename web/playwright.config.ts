import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de aceite (CA-01 a CA-10) e acessibilidade.
 * Rode com o servidor já no ar:  npm run dev -- -p 3100  e  npm run test:e2e
 * Usa o Google Chrome instalado na máquina (sem baixar navegadores).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Fortaleza",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } }, testIgnore: /responsivo.spec.ts/ },
    { name: "celular", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /responsivo\.spec\.ts/ },
  ],
});
