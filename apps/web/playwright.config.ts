import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';

// Playwright config roda antes do Next.js — precisa carregar .env manualmente.
// Precedência (última chamada override):
//   1. .env.local (dev default)
//   2. .env.staging (se PLAYWRIGHT_ENV=staging — Fase 15)
// Tentamos apps/web/ primeiro (padrão vercel env pull), depois root.
const useStaging = process.env.PLAYWRIGHT_ENV === 'staging';
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });
if (useStaging) {
  dotenv.config({
    path: path.resolve(__dirname, '..', '..', '.env.staging'),
    override: true,
  });
}

/**
 * Playwright config para CRM Nogma-Cavalcanti.
 *
 * Estratégia de isolamento (importante — o projeto usa 1 único banco
 * Supabase, dev = prod):
 *   1. Todos os dados criados pelos testes têm prefixo `e2e_test_` no
 *      nome + suffix único (`Date.now() + random`).
 *   2. Cada teste é responsável por seu próprio cleanup em `afterEach`
 *      ou `afterAll`.
 *   3. Script de emergência `pnpm e2e:cleanup` (root package.json) faz
 *      DELETE ... WHERE nome LIKE 'e2e_test_%' pra recuperar de falhas.
 *
 * Base URL:
 *   - Default: http://localhost:3000 (Playwright inicia dev server)
 *   - Override: PLAYWRIGHT_BASE_URL=https://... (ex: preview Vercel)
 */

const isCI = !!process.env.CI;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // single worker — evita race em RLS/dados
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  timeout: 60_000, // 60s por teste (uploads + PDF render podem levar tempo)
  expect: { timeout: 10_000 },
  outputDir: 'e2e-results',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    // Setup project — roda global-setup pra fazer login e salvar storage state
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    // Testes chromium desktop (default) — dependem de setup pra carregar auth
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Auto-start dev server local se baseURL local (não no CI/preview)
  webServer: baseURL.startsWith('http://localhost')
    ? {
        command: 'pnpm dev',
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !isCI,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
