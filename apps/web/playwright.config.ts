import { defineConfig, devices } from "@playwright/test";

const PUERTO = 3100;

/**
 * Tests E2E del flujo de voto. Las API se simulan con page.route, así que
 * no hacen falta nodo Hardhat, base de datos ni Autofirma.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: "es-ES",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "movil", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
  webServer: {
    // Se prueba la build real: su CSP es la de producción (sin 'unsafe-eval').
    command: `pnpm exec next build && pnpm exec next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/votar`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
