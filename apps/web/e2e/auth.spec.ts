/**
 * Suite: Auth
 *
 * Testa fluxo de autenticação isolado — cada teste desabilita o storage
 * state salvo (admin.json) para simular sessão limpa.
 *
 * NOTA hCaptcha: quando NEXT_PUBLIC_HCAPTCHA_SITE_KEY está presente no
 * env, o botão "Entrar" só fica enabled após o widget ser resolvido.
 * Playwright não consegue interagir com o hCaptcha real, portanto os
 * testes b) e c) são skippados automaticamente nesse cenário. Para
 * executá-los desabilite o hCaptcha no Supabase Auth dashboard (ou
 * configure uma site-key de teste que retorna sempre válido).
 */

import { test, expect } from '@playwright/test';

// Detecta presença de hCaptcha via env (disponível no processo Node do runner)
const hCaptchaActive = !!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

// ── Configuração de suite — sem storage state (sessão limpa) ──────────────────
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth', () => {
  // ── a) Redirect pra /login quando não autenticado ─────────────────────────
  test('redireciona pra /login quando não autenticado', async ({ page }) => {
    // Navega pra rota protegida sem sessão ativa
    await page.goto('/painel');

    // Middleware deve redirecionar — aguarda URL conter /login
    await page.waitForURL(/\/login/u, { timeout: 15_000 });

    expect(page.url()).toMatch(/\/login/u);
  });

  // ── b) Login válido leva pra /painel ──────────────────────────────────────
  test('login com credenciais válidas leva pra /painel', async ({ page }) => {
    // hCaptcha bypass não implementado; roda quando desabilitado pra E2E
    test.skip(hCaptchaActive, 'hCaptcha ativo — bypass não implementado; desabilite pra E2E');

    const email = process.env.AUTH_TEST_EMAIL ?? 'admin@nogmacorp.com.br';
    const password = process.env.AUTH_TEST_PASSWORD ?? '';

    await page.goto('/login');

    // Labels confirmados em login-form.tsx: label="E-mail" e label="Senha"
    await page.getByLabel(/e-mail/iu).fill(email);
    await page.getByLabel(/senha/iu).fill(password);

    // Botão confirmado em login-form.tsx: children="Entrar"
    await page.getByRole('button', { name: /entrar/iu }).click();

    // Aguarda redirect pra /painel (igual ao global.setup.ts)
    await page.waitForURL(/\/painel/u, { timeout: 20_000 });

    expect(page.url()).toMatch(/\/painel/u);

    // TopBar renderiza <h1 class="nos-topbar__title">Painel</h1>
    await expect(page.getByRole('heading', { name: /painel/iu, level: 1 })).toBeVisible();
  });

  // ── c) Credenciais inválidas mostram erro ────────────────────────────────
  test('login com credenciais inválidas mostra erro', async ({ page }) => {
    // hCaptcha bypass não implementado; roda quando desabilitado pra E2E
    test.skip(hCaptchaActive, 'hCaptcha ativo — bypass não implementado; desabilite pra E2E');

    await page.goto('/login');

    await page.getByLabel(/e-mail/iu).fill('wrong@example.com');
    await page.getByLabel(/senha/iu).fill('senha_errada');

    await page.getByRole('button', { name: /entrar/iu }).click();

    // Aguarda resposta do servidor (redirect de erro ou elemento de alerta)
    // A Server Action de login redireciona para /login?error=... em caso de falha
    await page.waitForURL(/\/login/u, { timeout: 15_000 });

    // Deve permanecer em /login — não deve redirecionar pra rota autenticada
    expect(page.url()).toMatch(/\/login/u);
    expect(page.url()).not.toMatch(/\/painel|\/obras|\/pagamentos/u);

    // Verifica mensagem de erro — role="alert" (form-layout__error) ou texto
    // com palavras-chave comuns de erro de credenciais
    const alertEl = page.locator('[role="alert"]');
    const errorVisible = await alertEl.isVisible().catch(() => false);

    if (errorVisible) {
      await expect(alertEl).toBeVisible();
    } else {
      // Fallback: verifica texto na página
      const bodyText = await page.locator('body').textContent();
      const hasErrorText = /credenciais|inválidas|inválido|incorretas|erro/iu.test(bodyText ?? '');
      expect(hasErrorText, 'Esperava mensagem de erro após credenciais inválidas').toBe(true);
    }
  });
});
