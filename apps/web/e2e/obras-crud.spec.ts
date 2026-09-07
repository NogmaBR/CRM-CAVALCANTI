/**
 * Suite: Obras CRUD
 *
 * Testa criação via UI, edição via UI, archive via UI e listagem filtrada.
 * Toda entidade criada tem prefixo `e2e_test_` e é removida em afterAll.
 * Requer storage state de global.setup.ts (admin autenticado).
 *
 * Notas de implementação:
 * - Pré-criação via adminClient() bypassa RLS (service role).
 * - Nunca waitForTimeout — usa waitForURL ou expects com locators.
 * - archiveObra (actions.ts) seta status='arquivada' + deleted_at=now()
 *   e redireciona de volta a /obras/{id}, então badge "Arquivada" deve
 *   aparecer na mesma página após o redirect.
 * - Listagem /obras sem ?status= filtra deleted_at IS NULL por default
 *   (listObras sem status nem includeArchived aplica is(deleted_at, null)).
 */

import { test, expect } from '@playwright/test';
import { testName, adminClient, cleanupAllE2E } from './helpers';

// ── UUID helper (mesmo pattern de cross-flow.spec.ts) ───────────────────────
function uuidFromUrl(url: string): string {
  const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/iu.exec(url);
  const uuid = match?.[1];
  if (!uuid) throw new Error('UUID não encontrado na URL: ' + url);
  return uuid;
}

test.describe('Obras CRUD', () => {
  test.afterAll(async () => {
    const result = await cleanupAllE2E();
    console.log('[obras-crud] Cleanup result:', result);
  });

  // ── a) Cria obra ativa via form ──────────────────────────────────────────
  test('cria obra ativa via form', async ({ page }) => {
    const nome = testName('CRUD create');

    await page.goto('/obras/novo');

    // Campos confirmados em obra-form.tsx
    await page.getByLabel(/^Nome$/iu).fill(nome);
    await page.getByLabel(/^Cliente$/iu).fill('E2E Cliente');
    await page.locator('#obra-status').selectOption('ativa');

    // Botão "Criar obra" (mode=create → submitLabel = 'Criar obra')
    await page.getByRole('button', { name: /criar obra/iu }).click();

    // createObra redirect → /obras/{uuid}
    await page.waitForURL(/\/obras\/[0-9a-f-]{36}/u, { timeout: 30_000 });

    // Nome deve aparecer na detail page (renderizado como heading ou row)
    await expect(page.getByText(nome)).toBeVisible();
  });

  // ── b) Edita obra existente ──────────────────────────────────────────────
  test('edita obra existente', async ({ page }) => {
    const nome = testName('CRUD edit');
    const supabase = adminClient();

    // Pré-cria via API (bypassa RLS)
    const { data, error } = await supabase
      .from('obras')
      .insert({ nome, status: 'ativa' })
      .select('id')
      .single();
    if (error) throw new Error('Falha ao pré-criar obra: ' + error.message);
    const id = data.id;

    await page.goto(`/obras/${id}/editar`);

    // Limpa o campo Cliente e preenche o novo valor
    const clienteInput = page.getByLabel(/^Cliente$/iu);
    await clienteInput.clear();
    await clienteInput.fill('E2E Cliente Editado');

    // Botão "Salvar alterações" (mode=edit → submitLabel = 'Salvar alterações')
    await page.getByRole('button', { name: /salvar alterações/iu }).click();

    // updateObra redirect → /obras/{id}
    await page.waitForURL(new RegExp(`/obras/${id}$`, 'u'), { timeout: 30_000 });

    // Valor editado deve aparecer na detail page
    await expect(page.getByText('E2E Cliente Editado')).toBeVisible();
  });

  // ── c) Arquiva obra (soft-delete) ────────────────────────────────────────
  test('arquiva obra (soft-delete)', async ({ page }) => {
    const nome = testName('CRUD archive');
    const supabase = adminClient();

    // Pré-cria via API
    const { data, error } = await supabase
      .from('obras')
      .insert({ nome, status: 'ativa' })
      .select('id')
      .single();
    if (error) throw new Error('Falha ao pré-criar obra: ' + error.message);
    const id = data.id;

    await page.goto(`/obras/${id}`);

    // Botão "Arquivar" — form action=archiveObra (obra-detail page.tsx)
    await page.getByRole('button', { name: /arquivar/iu }).click();

    // archiveObra redireciona de volta a /obras/{id} após update
    await page.waitForURL(new RegExp(`/obras/${id}`, 'u'), { timeout: 30_000 });

    // Badge "Arquivada" deve aparecer (STATUS_LABEL['arquivada'] = 'Arquivada')
    await expect(page.getByText('Arquivada')).toBeVisible();

    // Verifica via API que deleted_at foi setado
    const { data: row } = await supabase
      .from('obras')
      .select('deleted_at')
      .eq('id', id)
      .single();
    expect(row?.deleted_at, 'deleted_at deve ser não-nulo após arquivar').not.toBeNull();
  });

  // ── d) Lista mostra obras ativas em /obras ───────────────────────────────
  test('lista mostra obras ativas em /obras', async ({ page }) => {
    const supabase = adminClient();

    // Pré-cria 3 obras ativas via API
    const nomes = [
      testName('CRUD list A'),
      testName('CRUD list B'),
      testName('CRUD list C'),
    ] as const;

    for (const nome of nomes) {
      const { error } = await supabase
        .from('obras')
        .insert({ nome, status: 'ativa' });
      if (error) throw new Error('Falha ao pré-criar obra: ' + error.message);
    }

    // /obras sem ?status= → default = ativas (deleted_at IS NULL)
    await page.goto('/obras');

    for (const nome of nomes) {
      await expect(page.getByText(nome)).toBeVisible();
    }

    // Filtra por status=arquivada — as 3 obras ativas não devem aparecer
    await page.goto('/obras?status=arquivada');

    for (const nome of nomes) {
      await expect(page.getByText(nome)).not.toBeVisible();
    }
  });
});
