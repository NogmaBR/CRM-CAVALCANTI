import { test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Global setup — roda 1x antes de qualquer teste do project chromium.
 * Faz login com AUTH_TEST_EMAIL e salva storage state (cookies + localStorage)
 * em `.auth/admin.json`. Todos os testes chromium começam já autenticados.
 *
 * Vars obrigatórias em `.env.local`:
 *   - AUTH_TEST_EMAIL (default admin@nogmacorp.com.br)
 *   - AUTH_TEST_PASSWORD
 *
 * Se hCaptcha estiver ativo em /login, o teste vai falhar visualmente
 * — hoje o hCaptcha é opt-in via env do Supabase Auth. Se necessário,
 * desabilite temporariamente pro run ou use Playwright bypass (setar
 * hCaptcha em test mode via Supabase dashboard).
 */

const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json');

setup('authenticate admin', async ({ page }) => {
  const email = process.env.AUTH_TEST_EMAIL ?? 'admin@nogmacorp.com.br';
  const password = process.env.AUTH_TEST_PASSWORD;
  if (!password) throw new Error('AUTH_TEST_PASSWORD não definido em .env.local');

  const hCaptchaActive = !!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  if (hCaptchaActive && !process.env.PLAYWRIGHT_ALLOW_HCAPTCHA) {
    throw new Error(
      [
        'hCaptcha está ativo (NEXT_PUBLIC_HCAPTCHA_SITE_KEY setada).',
        'Playwright não consegue resolver o widget automaticamente.',
        '',
        'Para rodar E2E, escolha uma opção:',
        "  a) Setar NEXT_PUBLIC_HCAPTCHA_SITE_KEY= vazio no .env.local (temp)",
        "  b) Trocar por hCaptcha test key '10000000-ffff-ffff-ffff-000000000001'",
        "     (widget aparece mas qualquer click passa)",
        "  c) Setar PLAYWRIGHT_ALLOW_HCAPTCHA=1 pra tentar login mesmo assim",
        '',
        'Ver docs/operacao/fase-12-e2e.md pra detalhes.',
      ].join('\n'),
    );
  }

  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await page.goto('/login');
  await page.getByLabel(/e-?mail/iu).fill(email);
  await page.getByLabel(/senha/iu).fill(password);
  await page.getByRole('button', { name: /entrar/iu }).click();
  await page.waitForURL(/\/(painel|obras|pagamentos)/u, { timeout: 20_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
