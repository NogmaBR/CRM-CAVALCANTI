/**
 * Catálogo de filas.
 *
 * Mesma disciplina de `lib/events/tipos.ts`, e pelo mesmo motivo: se a fila
 * não está declarada aqui, o TypeScript recusa enfileirar. A whitelist do
 * banco (`fila_valida`) é a trava de verdade; esta é a que avisa antes de
 * chegar lá.
 *
 * ## Fila e evento não são a mesma coisa
 *
 * Vale distinguir, porque a semelhança confunde:
 *
 *   **Evento** é um fato que aconteceu. Quem emite não sabe nem se importa
 *   com quem reage — pode não haver ninguém. `pagamento.criado`.
 *
 *   **Job** é trabalho a fazer. Tem exatamente um dono, e se ninguém fizer,
 *   ficou por fazer. `baixar a mídia da mensagem X`.
 *
 * Por isso os nomes são diferentes: evento no particípio (`documento.anexado`),
 * job no imperativo implícito (`midia` = baixe a mídia).
 *
 * ## Payload carrega id, não objeto
 *
 * O corpo fica em `pgmq.q_*` até ser consumido, e pode esperar minutos. Entre
 * enfileirar e processar, o estado muda — quem consome busca o dado fresco
 * pelo id. Além disso: **nunca coloque credencial nem telefone completo
 * aqui.** A tabela é legível por quem tem acesso ao banco.
 */

export interface MapaDeFilas {
  /** Mensagem chegou pelo webhook; decidir o que fazer com ela. */
  whatsapp_inbound: { mensagemId: string };

  /**
   * Baixar o anexo antes que a URL do provider expire.
   *
   * É a primeira da cadeia por um motivo concreto: a URL da UAZAPI tem prazo,
   * e transcrever ou classificar antes de garantir o arquivo é arriscar
   * perder o anexo para sempre por causa de uma chamada de IA lenta.
   */
  midia: { mensagemId: string };

  /** Transcrever áudio e classificar o conteúdo. A etapa mais lenta. */
  ia_classificacao: { mensagemId: string };

  /** Responder ao remetente. */
  whatsapp_outbound: {
    telefone: string;
    texto: string;
    /** Só para o log: de onde veio esta resposta. */
    origem: 'confirmacao' | 'comando' | 'automacao' | 'erro';
  };
}

export type NomeFila = keyof MapaDeFilas;

export type PayloadDe<F extends NomeFila> = MapaDeFilas[F];

/** Uma mensagem lida da fila, como chega ao handler. */
export interface JobLido<F extends NomeFila = NomeFila> {
  fila: F;
  msgId: number;
  /**
   * Quantas vezes esta mensagem já foi entregue — **contando esta**. Começa em
   * 1, não em 0.
   *
   * É o contador de tentativas: uma mensagem só volta a ser lida se o
   * consumidor anterior não a concluiu, seja porque falhou, seja porque
   * morreu. É com ele que se decide arquivar em vez de tentar para sempre.
   */
  tentativa: number;
  enfileiradoEm: string;
  payload: PayloadDe<F>;
}

/**
 * Depois de quantas tentativas uma mensagem vai para o arquivo.
 *
 * Três é o número que separa "deu azar" de "está quebrado". Falha transitória
 * — rate limit, provider fora do ar por um instante — costuma passar na
 * segunda ou terceira. O que falha três vezes seguidas geralmente falha
 * sempre, e insistir só enche a fila e esconde o problema real.
 */
export const MAX_TENTATIVAS = 3;

/**
 * Por quanto tempo a mensagem some da fila depois de lida, por fila.
 *
 * Precisa ser maior que o pior tempo de processamento esperado. Curto demais
 * e a mensagem volta a ser visível enquanto ainda está sendo processada — e
 * aí duas invocações fazem o mesmo trabalho ao mesmo tempo.
 *
 * A da IA é a mais folgada porque transcrição de áudio longo é o pior caso
 * conhecido do sistema.
 */
export const VISIBILITY_TIMEOUT: Record<NomeFila, number> = {
  whatsapp_inbound: 30,
  midia: 120,
  ia_classificacao: 180,
  whatsapp_outbound: 60,
};
