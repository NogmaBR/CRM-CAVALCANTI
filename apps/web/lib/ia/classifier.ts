import 'server-only';
import type { DocCategoria } from '@/lib/status-labels';

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
  | 'documento_obra' // arquivo de obra que não é nota/comprovante: foto, projeto, proposta… (arquiva em obra+pasta)
  | 'registro_obra' // informação do dia a dia sem valor a lançar (vira diário de obra)
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
    /** Plano de contas (categorias vivas). Opcional: sem ele o pagamento entra sem categoria. */
    categorias?: Array<{ id: string; nome: string }>;
    /**
     * Obra do grupo de WhatsApp de onde a mensagem veio, quando o grupo é
     * dedicado a uma obra. É o default quando a mensagem não cita nenhuma.
     */
    grupoObraId?: string | null;
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
    categoria_id?: string; // se casou com contexto.categorias
    tipo_documento?: 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro';
    numero_nf?: string;
    descricao?: string;
    raciocinio?: string; // explicação humana pra revisor
    /** Pasta de destino quando kind = documento_obra. */
    categoria?: DocCategoria;
    /** Uma linha para o diário quando kind = registro_obra. */
    resumo?: string;
  };
  perguntaConfirmacao?: string; // texto pra enviar via WhatsApp se pagamento_parcial
}

export interface Classifier {
  classify(input: ClassifierInput): Promise<ClassifierOutput>;
}

/**
 * Factory. Escolha do provider vem de env var — troca sem tocar em código chamador.
 *   - `IA_PROVIDER=mock` (default): MockClassifier determinístico, sem custo.
 *   - `IA_PROVIDER=openai`: **o padrão do projeto desde 2026-09-15.** Chat
 *     Completions com `json_schema` estrito e visão. Modelo em `IA_MODEL`
 *     (default `gpt-5.4-mini`).
 *   - `IA_PROVIDER=anthropic`: Claude com structured outputs (alternativo).
 *
 * O import é dinâmico pra que o SDK da Anthropic só entre no bundle da
 * function quando esse provider estiver ligado.
 */
export async function getClassifier(): Promise<Classifier> {
  const provider = process.env.IA_PROVIDER ?? 'mock';

  if (provider === 'mock') {
    const { MockClassifier } = await import('./mock-classifier');
    return new MockClassifier();
  }

  if (provider === 'openai') {
    const { OpenAIClassifier } = await import('./openai-classifier');
    return new OpenAIClassifier();
  }

  if (provider === 'anthropic') {
    const { AnthropicClassifier } = await import('./anthropic-classifier');
    return new AnthropicClassifier();
  }

  throw new Error(`IA_PROVIDER desconhecido: ${provider}. Suportados: mock, openai, anthropic`);
}
