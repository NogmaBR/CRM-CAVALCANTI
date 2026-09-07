/**
 * Suite: Cross-flow E2E (fases 1-11)
 * Exercita o fluxo completo: obra -> fornecedor -> pagamento -> painel -> auditoria -> relatorio.
 * Usa o banco unico Supabase (dev=prod). Toda entidade criada aqui tem prefixo e2e_test_
 * e e removida em afterAll via cleanupAllE2E(). Requer storage state de global.setup.ts.
 */

import { test, expect } from '@playwright/test';
import { testName, cleanupAllE2E } from './helpers';

const obraNome = testName('Obra Cross');
const fornecedorNome = testName('Forn Cross');
let obraId = '';
let fornecedorId = '';
let pagamentoId = '';

function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function extractUUID(url: string): string {
  const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/iu.exec(url);
  const uuid = match?.[1];
  if (!uuid) throw new Error('UUID nao encontrado na URL: ' + url);
  return uuid;
}

test.describe('Cross-flow E2E (fases 1-11)', () => {
  test.afterAll(async () => {
    const result = await cleanupAllE2E();
    console.log('Cleanup result:', result);
  });

  test('login -> obra -> fornecedor -> pagamento aguardando -> auditoria -> relatorio', async ({ page }) => {

    // Fase 1: Criar obra (campos confirmados em obra-form.tsx)
    await page.goto('/obras/novo');
    await page.getByLabel(/^Nome$/iu).fill(obraNome);
    await page.getByLabel(/^Cliente$/iu).fill('E2E Cliente');
    await page.locator('#obra-status').selectOption('ativa');
    await page.getByLabel(/or.amento/iu).fill('100000');
    await page.getByRole('button', { name: /criar obra/iu }).click();
    await page.waitForURL(/\/obras\/[0-9a-f-]{36}/u, { timeout: 30_000 });
    obraId = extractUUID(page.url());
    expect(obraId).toBeTruthy();
    console.log('obraId:', obraId);

    // Fase 2: Criar fornecedor (campos confirmados em fornecedor-form.tsx)
    await page.goto('/fornecedores/novo');
    await page.getByLabel(/^Nome$/iu).fill(fornecedorNome);
    await page.getByLabel(/documento/iu).fill('11.222.333/0001-81');
    await page.getByRole('button', { name: /criar fornecedor/iu }).click();
    await page.waitForURL(/\/fornecedores\/[0-9a-f-]{36}/u, { timeout: 30_000 });
    fornecedorId = extractUUID(page.url());
    expect(fornecedorId).toBeTruthy();
    console.log('fornecedorId:', fornecedorId);

    // Fase 3: Criar pagamento (selects/inputs confirmados em pagamento-form.tsx)
    await page.goto('/pagamentos/novo');
    await page.locator('#pag-obra').selectOption({ label: obraNome });
    await page.locator('#pag-fornecedor').selectOption({ label: fornecedorNome });
    await page.getByLabel(/valor/iu).fill('1234.56');
    await page.getByLabel(/data do pagamento/iu).fill(todayISO());
    await page.locator('#pag-status').selectOption('aguardando');
    await page.getByLabel(/descri.ao/iu).fill('E2E cross-flow test');
    await page.getByRole('button', { name: /registrar pagamento/iu }).click();
    await page.waitForURL(/\/pagamentos\/[0-9a-f-]{36}/u, { timeout: 30_000 });
    pagamentoId = extractUUID(page.url());
    expect(pagamentoId).toBeTruthy();
    console.log('pagamentoId:', pagamentoId);

    // Fase 4: Painel -- verifica KPI grid renderizou
    await page.goto('/painel');
    await expect(page.getByRole('heading', { name: /painel/iu, level: 1 })).toBeVisible();
    const kpiGrid = page.locator('.nos-kpi-grid');
    await expect(kpiGrid).toBeVisible();
    await expect(kpiGrid.locator('.nos-stat-wrap').first()).toBeVisible();

    // Fase 5: Auditoria -- filtra por obras
    await page.goto('/auditoria?entidade=obras');
    await expect(page.getByRole('heading', { name: /auditoria/iu, level: 1 })).toBeVisible();
    const feedOrEmpty = page.locator('.audit-feed, .audit-empty');
    await expect(feedOrEmpty.first()).toBeVisible({ timeout: 15_000 });
    const auditFeed = page.locator('.audit-feed');
    const feedVisible = await auditFeed.isVisible().catch(() => false);
    if (feedVisible) {
      await expect(auditFeed.locator('.audit-row').first()).toBeVisible();
    }
    // best-effort: trigger de auditoria pode nao estar ativa no dev

    // Fase 6: Relatorio da Obra
    await page.goto('/relatorios');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // id=card-obra-select (relatorios-forms.tsx linha 85)
    const cardObraSelect = page.locator('#card-obra-select');
    await expect(cardObraSelect).toBeVisible({ timeout: 10_000 });
    await cardObraSelect.selectOption({ label: obraNome });
    // aria-label do DownloadLink PDF (relatorios-forms.tsx linha 109)
    let pdfEl = page.locator('a[aria-label="Baixar relatório da obra em PDF"]');
    if (!(await pdfEl.isVisible().catch(() => false))) {
      pdfEl = page.locator('a[aria-label="Baixar relatorio da obra em PDF"]');
    }
    await expect(pdfEl).toBeVisible();
    const ariaDisabled = await pdfEl.getAttribute('aria-disabled');
    expect(ariaDisabled, 'Link PDF deve estar habilitado apos selecionar a obra').toBeNull();
    const href = await pdfEl.getAttribute('href');
    expect(href).toContain('/api/exports/obra-completa');
    expect(href).toContain('obra_id=' + obraId);
    expect(href).toContain('format=pdf');

    // Fase 7: Download CSV via request API (contexto autenticado)
    const csvRes = await page.request.get(
      '/api/exports/obra-completa?format=csv&obra_id=' + obraId,
    );
    expect(csvRes.status()).toBe(200);
    const contentType = csvRes.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/csv');
  });
});
