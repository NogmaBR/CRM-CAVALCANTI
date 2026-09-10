import 'server-only';
import type { Evento } from '@/lib/events/tipos';
import { enviarWhatsapp } from '../actions/enviar-whatsapp';
import type { AutomacaoAgendada, ContextoExecucao, ResultadoCondicao } from '../tipos';

/**
 * Cobra do fornecedor a nota fiscal ou o comprovante que não chegou.
 *
 * Esta é a primeira automação real do motor, e não por acaso: ela existia
 * apenas como o workflow **WF5** documentado em `docs/N8N-COMPLETO.md`, que
 * nunca foi provisionado — ou seja, era uma promessa no papel. Aqui ela vira
 * código versionado, com condição explícita, log e teste.
 *
 * Regra: pagamento lançado há mais de N dias, sem nenhum documento vivo
 * anexado, com fornecedor que tenha telefone cadastrado.
 */

const DIAS_PADRAO = 7;

/** Teto por execução: uma varredura não pode virar disparo em massa. */
const LIMITE_POR_RODADA = 25;

export const cobrarDocumentoFornecedor: AutomacaoAgendada = {
  chave: 'cobrar-documento-fornecedor',
  descricao: 'Cobra por WhatsApp a nota ou comprovante de pagamentos sem documento.',
  gatilhos: ['pagamento.sem_documento'],
  apenasAgendada: true,
  efeitoExterno: true,
  configPadrao: { dias_sem_documento: DIAS_PADRAO, limite_por_rodada: LIMITE_POR_RODADA },

  /**
   * Varre pagamentos sem documento e emite um evento sintético por
   * pagamento — cada um passa pela condição e pela ação individualmente.
   */
  async varrer({ supabase, config }): Promise<Evento[]> {
    const dias = numero(config.dias_sem_documento, DIAS_PADRAO);
    const limite = numero(config.limite_por_rodada, LIMITE_POR_RODADA);

    const corte = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('pagamentos')
      .select('id, valor, data_pagamento, fornecedor_id, documentos ( id, deleted_at )')
      .is('deleted_at', null)
      .in('status_pagto', ['confirmado', 'aguardando'])
      .lte('data_pagamento', corte)
      .not('fornecedor_id', 'is', null)
      .order('data_pagamento', { ascending: true })
      .limit(limite * 4); // folga: o filtro "sem documento" é aplicado abaixo

    if (error) throw new Error(`Varredura falhou: ${error.message}`);

    const hoje = Date.now();

    return (data ?? [])
      .filter((p) => {
        // Documento arquivado não conta como entregue.
        const docs = (p.documentos ?? []) as Array<{ id: string; deleted_at: string | null }>;
        return docs.every((d) => d.deleted_at !== null);
      })
      .slice(0, limite)
      .map((p): Evento => {
        const diasCorridos = Math.floor(
          (hoje - new Date(`${p.data_pagamento}T00:00:00`).getTime()) / 86_400_000,
        );
        return {
          nome: 'pagamento.sem_documento',
          payload: { pagamentoId: p.id, dias: diasCorridos, valor: Number(p.valor) },
          em: new Date().toISOString(),
          userId: null,
        };
      });
  },

  /**
   * Barra o que não deve ser cobrado. Cada `motivo` daqui vira a resposta a
   * "por que não cobraram esse?" no log.
   */
  async condicao(ctx: ContextoExecucao): Promise<ResultadoCondicao> {
    const { pagamentoId, dias } = ctx.evento.payload as { pagamentoId: string; dias: number };
    const minimo = numero(ctx.config.dias_sem_documento, DIAS_PADRAO);

    if (dias < minimo) {
      return { passa: false, motivo: `Só ${dias} dia(s) sem documento; mínimo é ${minimo}.` };
    }

    const { data: pagamento } = await ctx.supabase
      .from('pagamentos')
      .select('id, valor, data_pagamento, fornecedor_id, fornecedores ( nome, telefone )')
      .eq('id', pagamentoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!pagamento) {
      return { passa: false, motivo: 'Pagamento não existe mais ou foi arquivado.' };
    }

    const fornecedor = pagamento.fornecedores as { nome: string; telefone: string | null } | null;

    if (!fornecedor) {
      return { passa: false, motivo: 'Pagamento sem fornecedor vinculado.' };
    }
    if (!fornecedor.telefone) {
      return {
        passa: false,
        motivo: `Fornecedor "${fornecedor.nome}" não tem telefone cadastrado.`,
      };
    }

    // Recheca o documento no momento da ação: entre a varredura e agora, a
    // nota pode ter chegado. Sem isto, cobraríamos quem acabou de mandar.
    const { count } = await ctx.supabase
      .from('documentos')
      .select('*', { count: 'exact', head: true })
      .eq('pagamento_id', pagamentoId)
      .is('deleted_at', null);

    if ((count ?? 0) > 0) {
      return { passa: false, motivo: 'Documento chegou entre a varredura e a execução.' };
    }

    return { passa: true };
  },

  async acao(ctx: ContextoExecucao): Promise<{ resumo: string }> {
    const { pagamentoId, dias, valor } = ctx.evento.payload as {
      pagamentoId: string;
      dias: number;
      valor: number;
    };

    const { data: pagamento } = await ctx.supabase
      .from('pagamentos')
      .select('data_pagamento, descricao, fornecedores ( nome, telefone )')
      .eq('id', pagamentoId)
      .maybeSingle();

    const fornecedor = pagamento?.fornecedores as { nome: string; telefone: string | null } | null;
    if (!fornecedor?.telefone) {
      throw new Error('Fornecedor perdeu o telefone entre a condição e a ação.');
    }

    const texto = montarCobranca({
      fornecedor: fornecedor.nome,
      valor,
      data: pagamento?.data_pagamento ?? '',
      descricao: pagamento?.descricao ?? null,
      dias,
    });

    return enviarWhatsapp(ctx, fornecedor.telefone, texto);
  },
};

/**
 * Texto da cobrança.
 *
 * Curto, cordial e com os dados que permitem identificar o pagamento sem
 * abrir nada. Quem recebe está no celular, no meio do dia.
 */
function montarCobranca(dados: {
  fornecedor: string;
  valor: number;
  data: string;
  descricao: string | null;
  dias: number;
}): string {
  const valorBr = dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const [ano, mes, dia] = dados.data.slice(0, 10).split('-');
  const dataBr = ano && mes && dia ? `${dia}/${mes}/${ano}` : dados.data;

  return [
    `Olá, ${dados.fornecedor}!`,
    '',
    `Estamos sem a nota fiscal ou o comprovante do pagamento de ${valorBr} do dia ${dataBr}${dados.descricao ? ` (${dados.descricao})` : ''}.`,
    '',
    `Já se passaram ${dados.dias} dias. Pode nos enviar por aqui mesmo?`,
    '',
    'Obrigado!',
  ].join('\n');
}

function numero(v: unknown, padrao: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : padrao;
}
