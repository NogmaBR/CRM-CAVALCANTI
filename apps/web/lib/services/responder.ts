import 'server-only';
import { logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type ResultadoEnvio, enviarTexto } from './uazapi';

type Client = SupabaseClient<Database>;

const log = logger('responder');

/** O que a resposta é — vai para `mensagens_enviadas.tipo` e para a tela. */
export type TipoDeResposta =
  | 'pergunta_pendencia'
  | 'lancado'
  | 'arquivado'
  | 'anotado'
  | 'acao_executada'
  | 'resposta'
  | 'aviso';

export interface Rastro {
  tipo: TipoDeResposta;
  /** A mensagem da pessoa que motivou esta resposta. */
  emRespostaA?: string | null;
  confirmacaoId?: string | null;
  pagamentoId?: string | null;
  documentoId?: string | null;
  registroId?: string | null;
  loteId?: string | null;
}

/**
 * Manda a resposta no WhatsApp E deixa o rastro em `mensagens_enviadas`.
 *
 * Todo texto que o agente envia passa por aqui — nunca por `enviarTexto`
 * direto — porque a linha gravada é o que permite:
 *
 *   - "sim" ou 👍 EM CIMA de uma pergunta resolver aquela pendência (o
 *     provider manda o id da mensagem citada/reagida; ele só aponta para algo
 *     se a pergunta ficou gravada com o id que o provider devolveu no envio);
 *   - "desfaz isso" citando o "📁 Guardei…" saber que documento é "isso";
 *   - a memória do assistente incluir o que o próprio agente disse;
 *   - a tela /whatsapp mostrar a conversa dos dois lados.
 *
 * O rastro é best-effort: falha ao gravar vira aviso no log, a resposta já
 * saiu. E o envio sem credencial continua devolvendo `nao_configurado` sem
 * lançar — mas a linha é gravada mesmo assim (sem id), para a conversa no
 * painel não ficar com buraco.
 */
export async function responder(
  supabase: Client,
  destino: string,
  texto: string,
  rastro: Rastro,
): Promise<ResultadoEnvio> {
  const envio = await enviarTexto(destino, texto);
  const msgId = envio.ok ? envio.msgId : null;

  try {
    const { error } = await supabase.from('mensagens_enviadas').insert({
      chat_id: destino,
      msg_id_uazapi: msgId,
      texto,
      tipo: rastro.tipo,
      em_resposta_a: rastro.emRespostaA ?? null,
      confirmacao_id: rastro.confirmacaoId ?? null,
      pagamento_id: rastro.pagamentoId ?? null,
      documento_id: rastro.documentoId ?? null,
      registro_id: rastro.registroId ?? null,
      lote_id: rastro.loteId ?? null,
    });
    if (error) log.aviso('rastro_nao_gravado', { tipo: rastro.tipo, erro: error.message });
  } catch (err) {
    log.aviso('rastro_nao_gravado', { tipo: rastro.tipo, err });
  }

  // Compatibilidade: a pendência guarda o id da própria pergunta (é o que o
  // painel e os testes antigos leem). A fonte de verdade passa a ser a
  // tabela de enviadas, mas ninguém precisa mudar de uma vez.
  if (msgId && rastro.confirmacaoId) {
    await supabase
      .from('confirmacoes_pendentes')
      .update({ msg_id_pergunta_uazapi: msgId })
      .eq('id', rastro.confirmacaoId);
  }

  return envio;
}

/** O que uma citação ou reação aponta, quando aponta para algo do CRM. */
export interface AlvoDaMensagem {
  /** Resposta do bot citada/reagida (linha de `mensagens_enviadas`). */
  enviadaId: string | null;
  tipoDaEnviada: TipoDeResposta | null;
  /** Mensagem da pessoa citada (linha de `mensagens_whats`). */
  mensagemId: string | null;
  confirmacaoId: string | null;
  pagamentoId: string | null;
  documentoId: string | null;
  registroId: string | null;
}

/**
 * Resolve o id de uma mensagem do provider (citada ou reagida) para o que ela
 * é no CRM: primeiro uma resposta do bot, depois uma mensagem da pessoa.
 * `null` quando não é nada nosso (a pessoa citou uma conversa qualquer do
 * grupo) — e aí a citação é só contexto, não um alvo.
 */
export async function resolverAlvo(
  supabase: Client,
  msgIdUazapi: string | null | undefined,
): Promise<AlvoDaMensagem | null> {
  if (!msgIdUazapi) return null;
  try {
    const { data: enviada } = await supabase
      .from('mensagens_enviadas')
      .select('id, tipo, em_resposta_a, confirmacao_id, pagamento_id, documento_id, registro_id')
      .eq('msg_id_uazapi', msgIdUazapi)
      .maybeSingle();
    if (enviada) {
      return {
        enviadaId: enviada.id,
        tipoDaEnviada: enviada.tipo as TipoDeResposta,
        mensagemId: enviada.em_resposta_a,
        confirmacaoId: enviada.confirmacao_id,
        pagamentoId: enviada.pagamento_id,
        documentoId: enviada.documento_id,
        registroId: enviada.registro_id,
      };
    }

    const { data: recebida } = await supabase
      .from('mensagens_whats')
      .select('id, pagamento_id, documento_id, registro_id')
      .eq('msg_id_uazapi', msgIdUazapi)
      .maybeSingle();
    if (!recebida) return null;

    // A pessoa citou a própria mensagem (o PDF que mandou): a pendência que
    // essa mensagem abriu, se ainda está aberta, é o alvo.
    const { data: pend } = await supabase
      .from('confirmacoes_pendentes')
      .select('id')
      .eq('mensagem_id', recebida.id)
      .eq('resolvida', false)
      .limit(1)
      .maybeSingle();

    return {
      enviadaId: null,
      tipoDaEnviada: null,
      mensagemId: recebida.id,
      confirmacaoId: pend?.id ?? null,
      pagamentoId: recebida.pagamento_id,
      documentoId: recebida.documento_id,
      registroId: recebida.registro_id,
    };
  } catch (err) {
    log.aviso('resolver_alvo_falhou', { err });
    return null;
  }
}
