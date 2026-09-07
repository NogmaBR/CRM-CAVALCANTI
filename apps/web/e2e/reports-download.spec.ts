/**
 * Suite: Reports Download
 *
 * Verifica que os endpoints /api/exports/* respondem com headers e body
 * corretos — não testa render pixel-perfect, só valida Content-Type,
 * Content-Disposition, status HTTP e tamanho mínimo.
 *
 * Pré-condições (criadas via adminClient em beforeAll):
 *   - 1 obra ativa
 *   - 1 fornecedor
 *   - 1 pagamento vinculado à obra + fornecedor
 *
 * Cleanup garantido em afterAll via cleanupAllE2E().
 *
 * Notas de implementação:
 * - page.request.get() herda o storage state do context (cookie de sessão)
 *   — não é necessário passar auth manualmente.
 * - BOM UTF-8 = U+FEFF. csv.ts define `const BOM = '﻿'` e prepend
 *   em toda saída CSV. Verificamos via charCodeAt(0) === 0xFEFF.
 * - O endpoint /api/exports/[tipo]/route.ts retorna 400 para tipo inválido
 *   quando o user está autenticado; 401 se a sessão não for reconhecida
 *   antes da validação do tipo. Aceitamos ambos.
 * - Para o CSV de fechamento mensal, usamos ano/mês do Date atual (mesmo
 *   que não haja pagamentos nesse mês, a rota retorna 200 com CSV vazio
 *   — apenas o header BOM + linha de cabeçalho).
 * - pagamento_origem é enum: 'whatsapp' | 'manual' | 'importado' (init.sql)
 * - status_pagto é enum: 'confirmado' | 'aguardando' | 'erro' (init.sql)
 */

import { test, expect } from '@playwright/test';
import { testName, adminClient, cleanupAllE2E } from './helpers';

// ── Shared state between tests ───────────────────────────────────────────────
let obraId = '';
let fornecedorId = '';

// ── Date helpers ─────────────────────────────────────────────────────────────
function currentAnoMes(): { ano: number; mes: number } {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

function todayISO(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

test.describe('Reports Download', () => {
  test.beforeAll(async () => {
    const supabase = adminClient();

    // 1. Cria obra ativa
    const obraNome = testName('Report obra');
    const { data: obraData, error: obraErr } = await supabase
      .from('obras')
      .insert({ nome: obraNome, status: 'ativa' })
      .select('id')
      .single();
    if (obraErr) throw new Error('Falha ao criar obra de report: ' + obraErr.message);
    obraId = obraData.id;

    // 2. Cria fornecedor
    const fornNome = testName('Report forn');
    const { data: fornData, error: fornErr } = await supabase
      .from('fornecedores')
      .insert({ nome: fornNome })
      .select('id')
      .single();
    if (fornErr) throw new Error('Falha ao criar fornecedor de report: ' + fornErr.message);
    fornecedorId = fornData.id;

    // 3. Cria pagamento vinculado (campo obrigatório: obra_id, valor, data_pagamento, origem)
    const { error: pagErr } = await supabase.from('pagamentos').insert({
      obra_id: obraId,
      fornecedor_id: fornecedorId,
      valor: 500.0,
      data_pagamento: todayISO(),
      origem: 'manual',
      status_pagto: 'confirmado',
      descricao: 'E2E report test payment',
    });
    if (pagErr) throw new Error('Falha ao criar pagamento de report: ' + pagErr.message);
  });

  test.afterAll(async () => {
    const result = await cleanupAllE2E();
    console.log('[reports-download] Cleanup result:', result);
  });

  // ── a) PDF de obra completa ──────────────────────────────────────────────
  test('baixa PDF de obra completa via /api/exports', async ({ page }) => {
    const res = await page.request.get(
      `/api/exports/obra-completa?format=pdf&obra_id=${obraId}`,
    );

    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers['content-type']).toContain('application/pdf');
    expect(headers['content-disposition']).toContain('attachment');

    // PDF válido tem estrutura mínima — cabeçalho %PDF e tamanho > 1 KB
    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(1000);
    // Primeiros bytes de um PDF: %PDF (hex 25 50 44 46)
    expect(body[0]).toBe(0x25); // '%'
    expect(body[1]).toBe(0x50); // 'P'
    expect(body[2]).toBe(0x44); // 'D'
    expect(body[3]).toBe(0x46); // 'F'
  });

  // ── b) CSV de fechamento mensal com BOM UTF-8 ────────────────────────────
  test('baixa CSV de fechamento mensal com BOM UTF-8', async ({ page }) => {
    const { ano, mes } = currentAnoMes();

    const res = await page.request.get(
      `/api/exports/mes?format=csv&ano=${ano}&mes=${mes}`,
    );

    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers['content-type']).toContain('text/csv');
    expect(headers['content-disposition']).toContain('attachment');

    // csv.ts prepende BOM = '﻿' (U+FEFF) em toda saída CSV
    const text = await res.text();
    expect(
      text.charCodeAt(0),
      'Primeiro caractere deve ser BOM U+FEFF (0xFEFF)',
    ).toBe(0xfeff);
  });

  // ── c) Tipo inválido retorna 400 (ou 401 se auth falha antes) ───────────
  test('rejeita tipo inválido com 400', async ({ page }) => {
    const res = await page.request.get(
      '/api/exports/tipo-que-nao-existe?format=pdf',
    );

    // 400 quando autenticado + tipo inválido; 401 se sessão não reconhecida
    expect([400, 401]).toContain(res.status());

    // Body deve ser JSON com campo error
    const json = await res.json().catch(() => null);
    expect(json, 'Corpo deve ser JSON válido').not.toBeNull();
    expect(json).toHaveProperty('error');
  });
});
