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
  /**
   * Uma mensagem chegou pelo webhook. Processá-la ponta a ponta.
   *
   * ## A exceção à regra do "só ids"
   *
   * Esta fila carrega o **payload cru do provider**, e não um id. É a única, e
   * tem motivo: quando a mensagem é enfileirada, não existe id nenhum — nada
   * foi persistido ainda. E não pode ser: `processarInbound` decide, na ordem,
   * se aquilo é resposta a uma pendência, se é comando de consulta, ou se é
   * lançamento novo — e **só o terceiro caso vira linha em `mensagens_whats`**.
   * Consulta ("quanto gastei em X") não é registro, é pergunta.
   *
   * Persistir antes só para ter um id inverteria essa decisão e encheria a
   * fila do gestor de coisa que já foi respondida.
   */
  whatsapp_inbound: { payload: unknown };

  /**
   * Reservada. Baixar o anexo separadamente.
   *
   * Hoje o download acontece dentro do `whatsapp_inbound`, porque a ordem das
   * etapas em `processarInbound` é deliberada: a transcrição do áudio precisa
   * estar pronta antes de decidir se a mensagem é um "SIM". Separar exigiria
   * reordenar o fluxo, e a ordem está comentada caso a caso lá.
   *
   * Fica declarada para quando o download provar precisar de política de
   * retentativa própria — o caso concreto seria a URL do provider expirar com
   * frequência.
   */
  midia: { mensagemId: string };

  /** Reservada, pelo mesmo motivo de `midia`. */
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

/**
 * As filas, em valor e não só em tipo.
 *
 * Existe para poder ser percorrida em runtime — um teste consegue afirmar que
 * toda fila declarada tem visibility timeout, coisa que um tipo sozinho não
 * garante. O `satisfies` faz o TypeScript recusar a lista se ela divergir do
 * mapa, então as duas não podem sair de sincronia em silêncio.
 *
 * **Esta lista precisa espelhar `fila_valida` no banco.** Acrescentar fila é
 * mexer aqui e numa migration; a do banco é a trava de verdade.
 */
export const FILAS = [
  'whatsapp_inbound',
  'midia',
  'ia_classificacao',
  'whatsapp_outbound',
] as const satisfies readonly (keyof MapaDeFilas)[];

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
