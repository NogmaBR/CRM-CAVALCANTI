import { cobrarDocumentoFornecedor } from './definitions/cobrar-documento-fornecedor';
import { orcamentoEmRisco } from './definitions/orcamento-em-risco';
import type { Automacao } from './tipos';

/**
 * Registro de automações.
 *
 * Toda automação precisa estar aqui para existir — é o equivalente a "publicar
 * o workflow" no n8n, só que explícito e revisável em diff.
 *
 * Estar registrada **não** significa estar ligada: o engine só age se houver
 * linha correspondente em `automation_rules` com `ativo = true`. Regra nova
 * nasce desligada de propósito; automação que começa a mandar mensagem para
 * cliente sozinha no deploy é o tipo de surpresa que não se quer.
 */
export const AUTOMACOES: Automacao[] = [cobrarDocumentoFornecedor, orcamentoEmRisco];

export function buscarAutomacao(chave: string): Automacao | undefined {
  return AUTOMACOES.find((a) => a.chave === chave);
}

export interface AutomacaoListada {
  chave: string;
  descricao: string;
  gatilhos: string[];
  agendada: boolean;
  /** A ação alcança alguém de fora (WhatsApp, e-mail). O painel avisa antes de ligar. */
  efeitoExterno: boolean;
  configPadrao: Record<string, unknown>;
}

/** Usado pelo painel e pelo seed para listar o que existe. */
export function listarAutomacoes(): AutomacaoListada[] {
  return AUTOMACOES.map((a) => ({
    chave: a.chave,
    descricao: a.descricao,
    gatilhos: [...a.gatilhos],
    agendada: typeof (a as { varrer?: unknown }).varrer === 'function',
    efeitoExterno: a.efeitoExterno === true,
    configPadrao: a.configPadrao ?? {},
  }));
}
