import { saudeDoCadastro } from '@/lib/data/completude';
import { alertasDoEmpresario } from '@/lib/data/painel-empresario';
import type { Database } from '@nogma/db';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { resumoDiarioSemaforo } from './resumo-diario-semaforo';
import { montarResumoDiario } from './resumo-diario-texto';

/**
 * Prova contra o banco de PRODUÇÃO com o service role — sem enviar nada
 * (`simular: true`): a regra lê a saúde do cadastro e os alertas com o
 * cliente de serviço (é o que o cron faz) e monta o texto. O texto sai em
 * stderr para conferência.
 *
 *   node --env-file=.env.local scripts/vitest-real.mjs lib/automations/definitions/resumo-diario-semaforo.real.test.ts
 */
const REAL =
  process.env.TESTE_REAL === '1' &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!REAL)('resumo-diario-semaforo (produção, simulado)', () => {
  it('condição passa e a ação em simulação descreve o envio sem sair', async () => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const ctx = {
      supabase,
      evento: {
        nome: 'sistema.resumo_diario' as const,
        payload: { dia: '2026-09-18' },
        em: new Date().toISOString(),
        userId: null,
      },
      config: { telefones: '5573998489747', enviar_quando_tudo_ok: false },
      simular: true,
    };
    const cond = await resumoDiarioSemaforo.condicao(ctx);
    expect(cond).toEqual({ passa: true });
    const r = await resumoDiarioSemaforo.acao(ctx);
    process.stderr.write(`\n${r.resumo}\n`);
    expect(r.resumo).toContain('enviado a 1 telefone');

    // O texto inteiro, como chegaria no WhatsApp.
    const [saude, alertas] = await Promise.all([
      saudeDoCadastro(supabase),
      alertasDoEmpresario(supabase),
    ]);
    const texto = montarResumoDiario({
      hoje: '2026-09-18',
      saude,
      alertas,
      appUrl: 'https://crm-cavalcanti.vercel.app',
    });
    process.stderr.write(`\n----- mensagem -----\n${texto}\n--------------------\n`);
    expect(texto).toContain('Resumo do CRM');
  }, 60_000);
});
