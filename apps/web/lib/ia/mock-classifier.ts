import 'server-only';
import type { Classifier, ClassifierInput, ClassifierOutput } from './classifier';

/**
 * MockClassifier — heurística determinística para dev/testes.
 *
 * Regras:
 *  - Texto sem mídia com padrão "R$ 1.234,56" ou "1.234,56" → pagamento_parcial
 *    (extrai valor via regex, tenta casar obra e fornecedor por nome/apelido).
 *  - Mídia (imagem/pdf) → documento_apenas (não sabemos ler sem OCR real).
 *  - Sem valor e sem mídia → nao_identificado.
 *
 * Sempre confidence baixo (<0.7) pra forçar fluxo de confirmação — em prod
 * um LLM real vai bater >0.9 nos casos claros e a mensagem vai direto pra
 * Pagamento/Documento sem passar por `confirmacoes_pendentes`.
 *
 * Objetivo: exercitar o pipeline end-to-end sem depender de API externa.
 * Ao trocar por real, este arquivo continua útil pra testes unitários.
 */
export class MockClassifier implements Classifier {
  async classify(input: ClassifierInput): Promise<ClassifierOutput> {
    const { texto, midiaMime, contexto } = input;

    // Documento (imagem ou PDF) — não tenta OCR no mock
    if (midiaMime && (midiaMime.startsWith('image/') || midiaMime === 'application/pdf')) {
      return {
        kind: 'documento_apenas',
        confidence: 0.5,
        extracted: {
          tipo_documento: midiaMime === 'application/pdf' ? 'nota_fiscal' : 'comprovante',
          descricao: texto ?? undefined,
          raciocinio: 'MockClassifier: mídia detectada; OCR desabilitado no mock',
        },
        perguntaConfirmacao: 'Recebi um documento. Confirma cadastro?',
      };
    }

    if (!texto) {
      return {
        kind: 'nao_identificado',
        confidence: 0.9,
        extracted: { raciocinio: 'MockClassifier: sem texto e sem mídia relevante' },
      };
    }

    // Regex simples pra valor em reais: "R$ 1.234,56" ou "1234,56" ou "R$ 500"
    const valorMatch = texto.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/u);
    const valor = valorMatch ? parseValor(valorMatch[1]!) : undefined;

    if (valor == null) {
      return {
        kind: 'nao_identificado',
        confidence: 0.6,
        extracted: {
          descricao: texto,
          raciocinio: 'MockClassifier: texto sem padrão de valor R$',
        },
      };
    }

    const textoNorm = normalize(texto);
    const obra = contexto.obrasAtivas.find((o) => textoNorm.includes(normalize(o.nome)));
    const forn = contexto.fornecedoresConhecidos.find(
      (f) =>
        textoNorm.includes(normalize(f.nome)) ||
        (f.apelidos ?? []).some((a) => textoNorm.includes(normalize(a))),
    );

    return {
      kind: 'pagamento_parcial',
      confidence: obra && forn ? 0.65 : 0.4,
      extracted: {
        valor,
        data_pagamento: new Date().toISOString().slice(0, 10),
        obra_id: obra?.id,
        fornecedor_id: forn?.id,
        fornecedor_nome_novo: !forn ? extractFornecedorNovo(texto) : undefined,
        descricao: texto,
        raciocinio: `MockClassifier: valor=${valor}, obra=${obra?.nome ?? '?'}, fornecedor=${forn?.nome ?? '?'}`,
      },
      perguntaConfirmacao:
        `Achei pagamento de R$ ${valor.toFixed(2)} ${obra ? `para obra ${obra.nome}` : ''} ${forn ? `com ${forn.nome}` : ''}. Confirma? [S/N]`
          .replace(/\s+/gu, ' ')
          .trim(),
    };
  }
}

function parseValor(s: string): number | undefined {
  // "1.234,56" → 1234.56 ; "500" → 500 ; "500,00" → 500
  const cleaned = s.replace(/\./gu, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^\w\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function extractFornecedorNovo(texto: string): string | undefined {
  // Heurística mínima: pega palavras entre "no/na/em/pra" e valor
  const m = texto.match(/(?:no|na|em|pra|para|do|da)\s+([A-Z][\w\s&]+?)(?=\s+R\$|\s+\d|,|$)/u);
  return m?.[1]?.trim() || undefined;
}
