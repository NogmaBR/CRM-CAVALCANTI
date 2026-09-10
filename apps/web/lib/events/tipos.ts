/**
 * Catálogo de eventos de domínio.
 *
 * Este arquivo é o contrato entre quem **emite** (services, server actions) e
 * quem **reage** (automações). É de propósito o único lugar onde um evento
 * pode ser declarado: se não está aqui, o TypeScript recusa emitir.
 *
 * ## Convenção de nome
 *
 * `entidade.acao`, entidade no singular, ação no particípio. `pagamento.criado`,
 * não `criarPagamento` nem `PAYMENT_CREATED`. O nome vira chave em banco e em
 * log — mudar depois custa migração, então vale acertar agora.
 *
 * ## Sobre o payload
 *
 * Carregue **ids e o mínimo de contexto**, não a entidade inteira. Duas razões:
 * o payload é persistido em `automation_executions` (entidade inteira incha o
 * log), e o estado pode ter mudado entre a emissão e a reação — quem reage
 * deve buscar o dado fresco pelo id.
 *
 * **Nunca coloque credencial, telefone completo ou dado sensível aqui.** O log
 * de execução é lido por `gestor` e `financeiro`.
 */

// ---------------------------------------------------------------------------
// Domínio atual: gestão de despesa de obra
// ---------------------------------------------------------------------------

export interface EventosObra {
  'obra.criada': { obraId: string; nome: string };
  'obra.arquivada': { obraId: string };
  /** Emitido quando o gasto cruza um limiar do orçamento (80%, 100%). */
  'obra.orcamento_em_risco': { obraId: string; percentual: number; totalGasto: number };
}

export interface EventosFornecedor {
  'fornecedor.criado': {
    fornecedorId: string;
    nome: string;
    origem: 'painel' | 'whatsapp' | 'import';
  };
  'fornecedor.duplicata_detectada': { fornecedorId: string; possivelDuplicataId: string };
}

export interface EventosPagamento {
  'pagamento.criado': {
    pagamentoId: string;
    obraId: string;
    fornecedorId: string | null;
    valor: number;
    origem: string;
  };
  'pagamento.confirmado': { pagamentoId: string; via: 'painel' | 'whatsapp' };
  'pagamento.recusado': { pagamentoId: string; via: 'painel' | 'whatsapp'; motivo: string | null };
  /** Disparado pelo cron, não por ação humana. */
  'pagamento.sem_documento': { pagamentoId: string; dias: number; valor: number };
}

export interface EventosDocumento {
  'documento.anexado': {
    documentoId: string;
    pagamentoId: string | null;
    obraId: string | null;
    tipo: string;
  };
}

export interface EventosWhatsapp {
  'mensagem.recebida': { mensagemId: string; tipo: string; autorizadoId: string };
  'confirmacao.aberta': { confirmacaoId: string; mensagemId: string };
  'confirmacao.resolvida': {
    confirmacaoId: string;
    resultado: 'confirmada' | 'recusada';
    via: 'painel' | 'whatsapp' | 'expiracao';
    pagamentoId: string | null;
  };
}

// ---------------------------------------------------------------------------
// Domínio de expansão: vendas imobiliárias
// ---------------------------------------------------------------------------
// Declarados agora, sem emissor, para que o desenho do motor já contemple o
// que vem — e para que a decisão de nomenclatura seja tomada uma vez só.
// Enquanto as tabelas não existirem, nenhuma automação os assina; o TypeScript
// aceita a declaração sem exigir implementação.
//
// A ponte com o domínio atual é `obra ↔ empreendimento`: a obra que se
// constrói é o empreendimento que se vende. Por isso `empreendimentoId`
// aparece ao lado de `obraId` e não no lugar dele.

export interface EventosVendas {
  'lead.criado': { leadId: string; origem: string; empreendimentoId: string | null };
  'lead.atribuido': { leadId: string; corretorId: string };
  'lead.sem_resposta': { leadId: string; horas: number };
  'visita.agendada': { visitaId: string; leadId: string; unidadeId: string | null; quando: string };
  'proposta.enviada': { propostaId: string; leadId: string; valor: number };
  'proposta.aprovada': { propostaId: string; valor: number };
  'venda.criada': { vendaId: string; unidadeId: string; valor: number };
  'contrato.assinado': { contratoId: string; vendaId: string };
}

// ---------------------------------------------------------------------------
// União
// ---------------------------------------------------------------------------

export interface MapaDeEventos
  extends EventosObra,
    EventosFornecedor,
    EventosPagamento,
    EventosDocumento,
    EventosWhatsapp,
    EventosVendas {}

export type NomeEvento = keyof MapaDeEventos;

export type PayloadDe<E extends NomeEvento> = MapaDeEventos[E];

/** Evento já materializado, como chega em quem reage e como vai pro log. */
export interface Evento<E extends NomeEvento = NomeEvento> {
  nome: E;
  payload: PayloadDe<E>;
  /** ISO. Quando o fato aconteceu, não quando a automação rodou. */
  em: string;
  /** Quem causou. `null` quando veio de cron ou de webhook sem sessão. */
  userId: string | null;
}

/**
 * Id da entidade principal do evento, para o log e para a trava de
 * idempotência. Centralizado aqui para que a extração não fique espalhada
 * em cada automação — e para que um evento novo sem entidade seja um caso
 * explícito (`null`), não um esquecimento.
 */
export function entidadeDoEvento(evento: Evento): string | null {
  const p = evento.payload as Record<string, unknown>;
  const candidatos = [
    'pagamentoId',
    'documentoId',
    'confirmacaoId',
    'mensagemId',
    'obraId',
    'fornecedorId',
    'leadId',
    'propostaId',
    'vendaId',
    'contratoId',
    'visitaId',
  ];
  for (const chave of candidatos) {
    const v = p[chave];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}
