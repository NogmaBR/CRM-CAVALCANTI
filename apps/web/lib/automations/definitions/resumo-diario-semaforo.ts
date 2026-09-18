import 'server-only';
import { saudeDoCadastro } from '@/lib/data/completude';
import { alertasDoEmpresario } from '@/lib/data/painel-empresario';
import type { Evento } from '@/lib/events/tipos';
import { hojeBR } from '@/lib/util/datas';
import { z } from 'zod';
import { enviarWhatsapp } from '../actions/enviar-whatsapp';
import type { AutomacaoAgendada, ContextoExecucao, ResultadoCondicao } from '../tipos';
import { lerTelefones, montarResumoDiario, totalDePendencias } from './resumo-diario-texto';

/**
 * PM4 — o resumo diário do semáforo no WhatsApp do gestor.
 *
 * Todo dia (o cron `/api/cron/automacoes` roda às 9h de Brasília) manda
 * para os telefones configurados o que o painel mostraria: quantos
 * pagamentos/obras/fornecedores/documentos estão com pendência, os alertas
 * que precisam de ação e o link. Reaproveita `saudeDoCadastro()` e
 * `montarAlertas()` — a mesma conta da tela, com o service role do cron.
 *
 * Nasce DESLIGADA (seed da migration 20260918150000). Ligar é decisão do
 * gestor em `/config/automacoes`, informando os telefones.
 *
 * Idempotência: a entidade do evento é o dia (`entidadeDoEvento`), então
 * duas rodadas do cron no mesmo dia não mandam duas vezes.
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app').replace(
  /\/+$/u,
  '',
);

export const resumoDiarioSemaforo: AutomacaoAgendada = {
  chave: 'resumo-diario-semaforo',
  descricao:
    'Manda todo dia, por WhatsApp, o resumo do que está faltando (semáforo) e os alertas do painel.',
  gatilhos: ['sistema.resumo_diario'],
  apenasAgendada: true,
  efeitoExterno: true,
  configPadrao: { telefones: '', enviar_quando_tudo_ok: false },
  configSchema: z.object({
    // Vírgula separa; "(55) 32 98806-8174" é aceito e limpo na leitura.
    telefones: z.string().max(300),
    enviar_quando_tudo_ok: z.boolean(),
  }),

  async varrer(): Promise<Evento[]> {
    return [
      {
        nome: 'sistema.resumo_diario',
        payload: { dia: hojeBR() },
        em: new Date().toISOString(),
        userId: null,
      },
    ];
  },

  async condicao(ctx: ContextoExecucao): Promise<ResultadoCondicao> {
    const telefones = lerTelefones(ctx.config.telefones);
    if (telefones.length === 0) {
      return {
        passa: false,
        motivo: 'Nenhum telefone válido em "telefones" (DDD + número, separados por vírgula).',
      };
    }
    if (ctx.config.enviar_quando_tudo_ok === true) return { passa: true };
    const [saude, alertas] = await Promise.all([
      saudeDoCadastro(ctx.supabase),
      alertasDoEmpresario(ctx.supabase),
    ]);
    if (totalDePendencias(saude) === 0 && alertas.length === 0) {
      return { passa: false, motivo: 'Tudo em dia e "enviar quando tudo ok" está desligado.' };
    }
    return { passa: true };
  },

  async acao(ctx: ContextoExecucao): Promise<{ resumo: string }> {
    const telefones = lerTelefones(ctx.config.telefones);
    const [saude, alertas] = await Promise.all([
      saudeDoCadastro(ctx.supabase),
      alertasDoEmpresario(ctx.supabase),
    ]);
    const texto = montarResumoDiario({ hoje: hojeBR(), saude, alertas, appUrl: APP_URL });

    const resultados: string[] = [];
    const falhas: string[] = [];
    for (const telefone of telefones) {
      try {
        const r = await enviarWhatsapp(ctx, telefone, texto);
        resultados.push(r.resumo);
      } catch (err) {
        falhas.push(
          `***${telefone.slice(-4)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // Um número que falhou não pode esconder os que receberam — mas se
    // TODOS falharam, a execução é falha, não sucesso.
    if (resultados.length === 0) {
      throw new Error(`Nenhum envio deu certo: ${falhas.join(' | ')}`);
    }
    const pendencias = totalDePendencias(saude);
    return {
      resumo: `Resumo (${pendencias} pendência${pendencias === 1 ? '' : 's'}, ${alertas.length} alerta${alertas.length === 1 ? '' : 's'}) enviado a ${resultados.length} telefone(s)${falhas.length ? `; falhou: ${falhas.join(' | ')}` : ''}`,
    };
  },
};
