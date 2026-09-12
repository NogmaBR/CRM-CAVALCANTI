import 'server-only';

/**
 * Interface do classificador IA para mensagens de WhatsApp.
 *
 * Um `Classifier` recebe o contexto de uma mensagem (texto + opcional mídia)
 * mais o contexto do negócio (obras ativas, fornecedores conhecidos) e
 * retorna uma classificação estruturada + confidence.
 *
 * Implementações:
 *   - `MockClassifier` (default): heurística determinística para dev/testes.
 *   - `AnthropicClassifier`: produção, via Claude com structured outputs.
 *
 * Troca de implementação: um único ponto — factory `getClassifier()`.
 */

export type ClassifierKind =
  | 'pagamento_completo' // tem valor + fornecedor + obra hint
  | 'pagamento_parcial' // tem alguns campos, precisa confirmação humana
  | 'documento_apenas' // NF/comprovante sem contexto de pagamento
  | 'nao_identificado'; // não é operacional (ex: "bom dia", audio, etc.)

export interface ClassifierInput {
  texto: string | null;
  /**
   * Caminho da mídia no bucket `documents` (prefixo `whatsapp/`), já baixada
   * pelo inbound enquanto a URL do provider valia. O classificador real lê
   * daqui para enxergar a foto da nota; o mock ignora.
   */
  midiaStoragePath: string | null;
  midiaMime: string | null;
  telefone: string; // já normalizado, só dígitos
  contexto: {
    obrasAtivas: Array<{ id: string; nome: string; apelidos?: string[] }>;
    fornecedoresConhecidos: Array<{ id: string; nome: string; apelidos?: string[] }>;
  };
}

export interface ClassifierOutput {
  kind: ClassifierKind;
  confidence: number; // 0..1
  extracted: {
    valor?: number; // reais, sempre positivo
    data_pagamento?: string; // ISO date (YYYY-MM-DD)
    obra_id?: string; // se casou 1:1 com contexto.obrasAtivas
    fornecedor_id?: string; // se casou com contexto.fornecedoresConhecidos
    fornecedor_nome_novo?: string; // se detectou fornecedor mas não bateu com conhecidos
    tipo_documento?: 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro';
    numero_nf?: string;
    descricao?: string;
    raciocinio?: string; // explicação humana pra revisor
  };
  perguntaConfirmacao?: string; // texto pra enviar via WhatsApp se pagamento_parcial
}

export interface Classifier {
  classify(input: ClassifierInput): Promise<ClassifierOutput>;
}

/**
 * Factory. Escolha do provider vem de env var — troca sem tocar em código chamador.
 *   - `IA_PROVIDER=mock` (default): MockClassifier determinístico, sem custo.
 *   - `IA_PROVIDER=anthropic`: Claude com structured outputs. Modelo em
 *     `IA_MODEL` (default `claude-opus-5`).
 *
 * O import é dinâmico pra que o SDK da Anthropic só entre no bundle da
 * function quando o provider real estiver ligado.
 */
export async function getClassifier(): Promise<Classifier> {
  const provider = process.env.IA_PROVIDER ?? 'mock';

  if (provider === 'mock') {
    const { MockClassifier } = await import('./mock-classifier');
    return new MockClassifier();
  }

  if (provider === 'anthropic') {
    const { AnthropicClassifier } = await import('./anthropic-classifier');
    return new AnthropicClassifier();
  }

  throw new Error(`IA_PROVIDER desconhecido: ${provider}. Suportados: mock, anthropic`);
}
