import 'server-only';
import { categoriaDaPasta, tipoDoNome } from '@/lib/acervo/categoria';
import { hojeBR } from '@/lib/util/datas';
import type { Classifier, ClassifierInput, ClassifierOutput } from './classifier';

/**
 * MockClassifier — heurística determinística para dev/testes.
 *
 * Regras (a ordem é a regra "pagamento vence"):
 *  - Qualquer coisa com padrão de valor ("R$ 1.234,56", "1200") → pagamento_parcial
 *    (extrai valor via regex, tenta casar obra e fornecedor por nome/apelido).
 *  - Mídia sem valor, cuja legenda/nome cheira a nota/comprovante/boleto →
 *    documento_apenas (o fluxo de pagamento pergunta, como sempre).
 *  - Mídia sem valor e sem cheiro de pagamento → documento_obra: a categoria
 *    vem de palavra-chave na legenda (foto, proposta, projeto…); PDF sem pista
 *    é `outro`, imagem sem pista é `fotos`.
 *  - Texto/áudio sem valor, sem pergunta, com 4+ palavras → registro_obra
 *    (diário). Menos que isso ("bom dia") → nao_identificado.
 *  - Obra: por nome ou apelido no texto; senão a obra do grupo, se houver.
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
    // Qualquer anexo conta: vídeo, planilha e Word também são guardados.
    const ehMidia = Boolean(midiaMime?.trim());

    // Regex simples pra valor em reais: "R$ 1.234,56" ou "1234,56" ou "R$ 500".
    //
    // A primeira alternativa exige o grupo de milhar com ponto (`+`, não `*`).
    // Com `*` ela casava "120" dentro de "1200" e o regex nunca tentava a
    // segunda: "paguei 1200 de areia" virava R$ 120,00. Revisão de 2026-09-11.
    const valorMatch = texto?.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)/u);
    const valor = valorMatch ? parseValor(valorMatch[1]!) : undefined;

    const textoNorm = texto ? normalize(texto) : '';
    const obraCitada = contexto.obrasAtivas.find(
      (o) =>
        textoNorm.includes(normalize(o.nome)) ||
        (o.apelidos ?? []).some((a) => a && textoNorm.includes(normalize(a))),
    );
    const obraDoGrupo = contexto.grupoObraId
      ? contexto.obrasAtivas.find((o) => o.id === contexto.grupoObraId)
      : undefined;
    const obraResolvida = obraCitada ?? obraDoGrupo;

    // Mídia sem valor na legenda: é nota/comprovante (fluxo de pagamento) ou
    // é arquivo de obra (arquiva na pasta).
    if (ehMidia && valor == null) {
      const pista = texto ?? '';
      const tipoPista = tipoDoNome(pista);
      if (tipoPista === 'nota_fiscal' || tipoPista === 'comprovante') {
        return {
          kind: 'documento_apenas',
          confidence: 0.5,
          extracted: {
            tipo_documento: midiaMime === 'application/pdf' ? 'nota_fiscal' : 'comprovante',
            obra_id: obraResolvida?.id,
            descricao: texto ?? undefined,
            raciocinio:
              'MockClassifier: mídia com cheiro de nota/comprovante; OCR desabilitado no mock',
          },
          perguntaConfirmacao: 'Recebi um documento. Confirma cadastro?',
        };
      }
      const porPista = categoriaDaPasta(pista);
      const categoria =
        porPista !== 'outro'
          ? porPista
          : midiaMime?.startsWith('image/') || midiaMime?.startsWith('video/')
            ? 'fotos'
            : 'outro';
      return {
        kind: 'documento_obra',
        confidence: 0.6,
        extracted: {
          categoria,
          obra_id: obraResolvida?.id,
          tipo_documento: categoria === 'documentacao' ? 'contrato' : 'outro',
          descricao: texto ?? undefined,
          raciocinio: `MockClassifier: mídia sem valor; pasta=${categoria}, obra=${obraResolvida?.nome ?? '?'}`,
        },
      };
    }

    if (!texto) {
      return {
        kind: 'nao_identificado',
        confidence: 0.9,
        extracted: { raciocinio: 'MockClassifier: sem texto e sem mídia relevante' },
      };
    }

    if (valor == null) {
      // Texto/áudio sem valor: informação do dia a dia vira diário; saudação
      // curta ou pergunta não.
      const palavras = textoNorm.split(' ').filter(Boolean);
      if (palavras.length >= 4 && !texto.trim().endsWith('?')) {
        return {
          kind: 'registro_obra',
          confidence: 0.6,
          extracted: {
            obra_id: obraResolvida?.id,
            resumo: texto.trim().slice(0, 80),
            descricao: texto,
            raciocinio: `MockClassifier: texto sem valor, ${palavras.length} palavras; obra=${obraResolvida?.nome ?? '?'}`,
          },
        };
      }
      return {
        kind: 'nao_identificado',
        confidence: 0.6,
        extracted: {
          descricao: texto,
          raciocinio: 'MockClassifier: texto sem padrão de valor R$',
        },
      };
    }

    const obra = obraResolvida;
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
        data_pagamento: hojeBR(),
        obra_id: obra?.id,
        fornecedor_id: forn?.id,
        fornecedor_nome_novo: !forn ? extractFornecedorNovo(texto) : undefined,
        tipo_documento: ehMidia
          ? midiaMime === 'application/pdf'
            ? 'nota_fiscal'
            : 'comprovante'
          : undefined,
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
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function extractFornecedorNovo(texto: string): string | undefined {
  // Heurística mínima: pega palavras entre "no/na/em/pra" e valor
  const m = texto.match(/(?:no|na|em|pra|para|do|da)\s+([A-Z][\w\s&]+?)(?=\s+R\$|\s+\d|,|$)/u);
  return m?.[1]?.trim() || undefined;
}
