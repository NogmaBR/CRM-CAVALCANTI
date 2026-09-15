import 'server-only';
import { type ClassifierInput, getClassifier } from '@/lib/ia/classifier';
import { logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Conciliação: nota/comprovante do acervo ↔ pagamento sem documento.
 *
 * Os 80 pagamentos importados do protótipo estão "sem nota" porque as notas
 * estavam no OneDrive. Com o acervo dentro, dá para ligar os dois sem ninguém
 * anexar à mão — desde que a ligação seja **inequívoca**:
 *
 *   - mesma obra (a pasta do Drive é a obra);
 *   - valor igual (tolerância de R$ 0,01);
 *   - data do pagamento a até 7 dias da data extraída, quando há data;
 *   - UM candidato só. Zero ou dois: não vincula, fica para o gestor em
 *     `/pendentes` ("Documentos sem pagamento").
 *
 * Nunca cria pagamento. O acervo é passado; lançamento novo é decisão humana
 * (e, pelo WhatsApp, passa pelo "SIM").
 */

type Client = SupabaseClient<Database>;
type AnexoTipo = Database['public']['Enums']['anexo_tipo'];

const log = logger('acervo_conciliacao');

const TOLERANCIA_VALOR = 0.011;
const JANELA_DIAS = 7;

export interface DadosNota {
  valor: number | null;
  data: string | null;
  numero_nf?: string | null;
  fornecedor_id?: string | null;
  tipo_documento?: AnexoTipo | null;
}

export interface PagamentoCandidato {
  id: string;
  valor: number;
  data_pagamento: string;
  fornecedor_id: string | null;
}

function diasEntre(a: string, b: string): number {
  const ms = Math.abs(
    Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`),
  );
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms / 86_400_000;
}

/** Puro. Um candidato só, ou nada. */
export function escolherCandidato(
  extraido: Pick<DadosNota, 'valor' | 'data'>,
  candidatos: PagamentoCandidato[],
): PagamentoCandidato | null {
  if (extraido.valor == null) return null;
  const valor = extraido.valor;

  const porValor = candidatos.filter((c) => Math.abs(Number(c.valor) - valor) <= TOLERANCIA_VALOR);
  const naJanela = extraido.data
    ? porValor.filter((c) => diasEntre(c.data_pagamento, extraido.data as string) <= JANELA_DIAS)
    : porValor;

  return naJanela.length === 1 ? (naJanela[0] ?? null) : null;
}

export interface DecisaoConciliacao {
  resultado: 'vinculado' | 'ambiguo' | 'sem_candidato';
  /** Campos a gravar em `documentos` (além de `conciliado_em`). */
  documento: {
    pagamento_id?: string;
    tipo?: AnexoTipo;
    numero_nf?: string;
    fornecedor_id?: string;
  };
  /** Fornecedor a preencher no pagamento, quando ele não tinha. */
  pagamento: { id: string; fornecedor_id: string } | null;
}

/**
 * Puro. Decide o que gravar. Mesmo sem vínculo, número da nota e tipo
 * extraídos são guardados: é o que faz a tela de pendentes mostrar "NF 123"
 * em vez de "arquivo.pdf".
 */
export function decidirConciliacao(args: {
  documento: {
    id: string;
    tipo: AnexoTipo;
    numero_nf: string | null;
    fornecedor_id: string | null;
  };
  extraido: DadosNota;
  candidatos: PagamentoCandidato[];
}): DecisaoConciliacao {
  const { documento, extraido, candidatos } = args;
  const escolhido = escolherCandidato(extraido, candidatos);

  const patch: DecisaoConciliacao['documento'] = {};
  if (
    documento.tipo === 'outro' &&
    extraido.tipo_documento &&
    extraido.tipo_documento !== 'outro'
  ) {
    patch.tipo = extraido.tipo_documento;
  }
  if (!documento.numero_nf && extraido.numero_nf) patch.numero_nf = extraido.numero_nf;

  if (!escolhido) {
    const houveValor = extraido.valor != null;
    const algumPorValor =
      houveValor &&
      candidatos.some(
        (c) => Math.abs(Number(c.valor) - (extraido.valor as number)) <= TOLERANCIA_VALOR,
      );
    return {
      resultado: algumPorValor ? 'ambiguo' : 'sem_candidato',
      documento: patch,
      pagamento: null,
    };
  }

  patch.pagamento_id = escolhido.id;
  if (!documento.fornecedor_id && extraido.fornecedor_id)
    patch.fornecedor_id = extraido.fornecedor_id;

  const pagamento =
    !escolhido.fornecedor_id && extraido.fornecedor_id
      ? { id: escolhido.id, fornecedor_id: extraido.fornecedor_id }
      : null;

  return { resultado: 'vinculado', documento: patch, pagamento };
}

export interface DepsConciliacao {
  /** Extrai valor/data/nº/fornecedor do texto (e do arquivo, quando há visão). */
  extrair: (args: {
    texto: string;
    storagePath: string;
    mime: string;
    contexto: ClassifierInput['contexto'];
  }) => Promise<DadosNota | null>;
}

async function extrairComClassificador(
  args: Parameters<DepsConciliacao['extrair']>[0],
): Promise<DadosNota | null> {
  const classifier = await getClassifier();
  const out = await classifier.classify({
    texto: args.texto,
    midiaStoragePath: args.storagePath,
    midiaMime: args.mime,
    telefone: 'acervo',
    contexto: args.contexto,
  });
  return {
    valor: out.extracted.valor ?? null,
    data: out.extracted.data_pagamento ?? null,
    numero_nf: out.extracted.numero_nf ?? null,
    fornecedor_id: out.extracted.fornecedor_id ?? null,
    tipo_documento: out.extracted.tipo_documento ?? null,
  };
}

export interface ResultadoConciliacao {
  analisados: number;
  vinculados: number;
  ambiguos: number;
  semCandidato: number;
  erros: number;
}

/**
 * Processa uma leva de notas ainda não conciliadas (`conciliado_em IS NULL`,
 * categoria `nfs_pagamentos`, com texto extraído, sem pagamento).
 */
export async function conciliarPendentes(
  supabase: Client,
  opts: { limite?: number; deps?: DepsConciliacao } = {},
): Promise<ResultadoConciliacao> {
  const limite = opts.limite ?? 20;
  const deps = opts.deps ?? { extrair: extrairComClassificador };

  const { data: docs, error } = await supabase
    .from('documentos')
    .select('id, obra_id, tipo, numero_nf, fornecedor_id, texto_extraido, storage_path, mime_type')
    .eq('categoria', 'nfs_pagamentos')
    .is('pagamento_id', null)
    .is('conciliado_em', null)
    .not('texto_extraido_em', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limite);

  if (error) throw new Error(`Falha ao listar documentos para conciliar: ${error.message}`);

  const resultado: ResultadoConciliacao = {
    analisados: 0,
    vinculados: 0,
    ambiguos: 0,
    semCandidato: 0,
    erros: 0,
  };
  const lista = docs ?? [];
  if (lista.length === 0) return resultado;

  const [obrasRes, fornRes] = await Promise.all([
    supabase.from('obras').select('id, nome, apelidos').is('deleted_at', null),
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null),
  ]);
  const contexto: ClassifierInput['contexto'] = {
    obrasAtivas: (obrasRes.data ?? []).map((o) => ({
      id: o.id,
      nome: o.nome,
      apelidos: o.apelidos ?? [],
    })),
    fornecedoresConhecidos: (fornRes.data ?? []).map((f) => ({ id: f.id, nome: f.nome })),
  };

  for (const doc of lista) {
    resultado.analisados += 1;
    try {
      // Sem texto não há o que extrair; marca como olhado e segue.
      if (!doc.texto_extraido || !doc.obra_id) {
        await supabase
          .from('documentos')
          .update({ conciliado_em: new Date().toISOString() })
          .eq('id', doc.id);
        resultado.semCandidato += 1;
        continue;
      }

      const extraido = await deps.extrair({
        texto: doc.texto_extraido,
        storagePath: doc.storage_path,
        mime: doc.mime_type,
        contexto,
      });

      const { data: candidatos } = await supabase
        .from('pagamentos')
        .select('id, valor, data_pagamento, fornecedor_id')
        .eq('obra_id', doc.obra_id)
        .is('deleted_at', null);

      const decisao = decidirConciliacao({
        documento: {
          id: doc.id,
          tipo: doc.tipo,
          numero_nf: doc.numero_nf,
          fornecedor_id: doc.fornecedor_id,
        },
        extraido: extraido ?? { valor: null, data: null },
        candidatos: (candidatos ?? []).map((c) => ({
          id: c.id,
          valor: Number(c.valor),
          data_pagamento: c.data_pagamento,
          fornecedor_id: c.fornecedor_id,
        })),
      });

      const { error: erroDoc } = await supabase
        .from('documentos')
        .update({ ...decisao.documento, conciliado_em: new Date().toISOString() })
        .eq('id', doc.id);
      if (erroDoc) throw new Error(erroDoc.message);

      if (decisao.pagamento) {
        await supabase
          .from('pagamentos')
          .update({ fornecedor_id: decisao.pagamento.fornecedor_id })
          .eq('id', decisao.pagamento.id)
          .is('fornecedor_id', null);
      }

      if (decisao.resultado === 'vinculado') resultado.vinculados += 1;
      else if (decisao.resultado === 'ambiguo') resultado.ambiguos += 1;
      else resultado.semCandidato += 1;

      log.info('conciliado', { documento_id: doc.id, resultado: decisao.resultado });
    } catch (err) {
      resultado.erros += 1;
      log.erro('conciliacao_falhou', { documento_id: doc.id, err });
    }
  }

  return resultado;
}
