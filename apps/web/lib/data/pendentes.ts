import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';

export type ConfirmacaoPendente = Database['public']['Tables']['confirmacoes_pendentes']['Row'];
export type MensagemWhats = Database['public']['Tables']['mensagens_whats']['Row'];

/** Shape produzido pelo classifier e armazenado em dados_extraidos JSONB */
export interface DadosExtraidos {
  valor?: number;
  data_pagamento?: string;
  obra_id?: string;
  fornecedor_id?: string;
  fornecedor_nome_novo?: string;
  tipo_documento?: 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro';
  numero_nf?: string;
  descricao?: string;
  raciocinio?: string;
}

export interface PendenteItem {
  confirmacao_id: string;
  mensagem_id: string;
  pergunta_enviada: string;
  created_at: string | null;
  // campos de mensagens_whats
  telefone_from: string;
  tipo: Database['public']['Enums']['msg_tipo'];
  midia_mime: string | null;
  texto_bruto: string | null;
  recebida_em: string;
  dados_extraidos: DadosExtraidos | null;
  confianca_ia: number | null;
  // lookup resolvido no data layer
  obra_nome: string | null;
  fornecedor_nome: string | null;
}

export async function listPendentes(): Promise<PendenteItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('confirmacoes_pendentes')
    .select(
      `id,
       mensagem_id,
       pergunta_enviada,
       created_at,
       mensagens_whats!confirmacoes_pendentes_mensagem_id_fkey (
         telefone_from,
         tipo,
         midia_mime,
         texto_bruto,
         recebida_em,
         dados_extraidos,
         confianca_ia
       )`,
    )
    .eq('resolvida', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Falha ao listar pendentes: ${error.message}`);

  const rows = data ?? [];

  // Collect unique IDs for batch lookups
  const obraIds = new Set<string>();
  const fornecedorIds = new Set<string>();

  for (const row of rows) {
    const msg = row.mensagens_whats as MensagemWhats | null;
    if (!msg) continue;
    const de = msg.dados_extraidos as DadosExtraidos | null;
    if (de?.obra_id) obraIds.add(de.obra_id);
    if (de?.fornecedor_id) fornecedorIds.add(de.fornecedor_id);
  }

  const [obrasRes, fornecedoresRes] = await Promise.all([
    obraIds.size > 0
      ? supabase
          .from('obras')
          .select('id, nome')
          .in('id', [...obraIds])
      : Promise.resolve({ data: [], error: null }),
    fornecedorIds.size > 0
      ? supabase
          .from('fornecedores')
          .select('id, nome')
          .in('id', [...fornecedorIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const obraMap = new Map<string, string>(
    (obrasRes.data ?? []).map((o) => [o.id, o.nome]),
  );
  const fornecedorMap = new Map<string, string>(
    (fornecedoresRes.data ?? []).map((f) => [f.id, f.nome]),
  );

  return rows
    .map((row): PendenteItem | null => {
      const msg = row.mensagens_whats as MensagemWhats | null;
      if (!msg) return null;
      const de = msg.dados_extraidos as DadosExtraidos | null;

      const obra_nome = de?.obra_id ? (obraMap.get(de.obra_id) ?? null) : null;
      const fornecedor_nome =
        de?.fornecedor_id
          ? (fornecedorMap.get(de.fornecedor_id) ?? null)
          : (de?.fornecedor_nome_novo ?? null);

      return {
        confirmacao_id: row.id,
        mensagem_id: row.mensagem_id,
        pergunta_enviada: row.pergunta_enviada,
        created_at: row.created_at,
        telefone_from: msg.telefone_from,
        tipo: msg.tipo,
        midia_mime: msg.midia_mime,
        texto_bruto: msg.texto_bruto,
        recebida_em: msg.recebida_em,
        dados_extraidos: de,
        confianca_ia: msg.confianca_ia,
        obra_nome,
        fornecedor_nome,
      };
    })
    .filter((item): item is PendenteItem => item !== null);
}

/**
 * Pagamento lançado que continua sem nota fiscal nem comprovante anexado.
 *
 * O briefing (§3) pede "itens sem NF/comprovante viram pendência, com
 * contagem de dias". Isso existia só como o workflow WF5 do n8n, que **cobra
 * o fornecedor por WhatsApp** — nunca como uma visão na tela. Quem precisa
 * decidir o que cobrar é o gestor, e ele não tinha onde olhar.
 */
export interface PagamentoSemDocumento {
  id: string;
  valor: number;
  data_pagamento: string;
  descricao: string | null;
  obra_nome: string | null;
  fornecedor_nome: string | null;
  /** Dias corridos desde a data do pagamento. */
  dias: number;
}

/**
 * Lista pagamentos sem documento, do mais antigo para o mais recente.
 *
 * `diasMinimos` existe pra não poluir a tela com o pagamento lançado hoje de
 * manhã: só é pendência de verdade depois de um tempo razoável sem o papel
 * chegar. O padrão de 3 dias é conservador e ajustável pela chamada.
 */
export async function listPagamentosSemDocumento(
  diasMinimos = 3,
  limite = 50,
): Promise<PagamentoSemDocumento[]> {
  const supabase = await createClient();

  const corte = new Date(Date.now() - diasMinimos * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('pagamentos')
    .select(
      `id,
       valor,
       data_pagamento,
       descricao,
       obras ( nome ),
       fornecedores ( nome ),
       documentos ( id, deleted_at )`,
    )
    .is('deleted_at', null)
    .neq('status_pagto', 'recusado')
    .neq('status_pagto', 'erro')
    .lte('data_pagamento', corte)
    .order('data_pagamento', { ascending: true })
    .limit(limite * 4); // margem: o filtro "sem documento" é aplicado abaixo

  if (error) throw new Error(`Falha ao listar pagamentos sem documento: ${error.message}`);

  const hoje = Date.now();

  // O filtro roda aqui e não no SQL porque PostgREST não expressa
  // "sem linhas na tabela relacionada" — o embed devolve array vazio, que só
  // dá pra testar depois de receber. Por isso o `limit` acima pede folga.
  return (data ?? [])
    .filter((p) => {
      // `deleted_at` importa: documento arquivado não conta como entregue,
      // senão apagar o anexo errado faria o pagamento sumir desta lista.
      const docs = (p.documentos ?? []) as Array<{ id: string; deleted_at: string | null }>;
      return docs.every((d) => d.deleted_at !== null);
    })
    .slice(0, limite)
    .map((p) => {
      const obra = p.obras as { nome: string } | null;
      const fornecedor = p.fornecedores as { nome: string } | null;
      const dias = Math.max(
        0,
        Math.floor((hoje - new Date(`${p.data_pagamento}T00:00:00`).getTime()) / 86_400_000),
      );
      return {
        id: p.id,
        valor: Number(p.valor),
        data_pagamento: p.data_pagamento,
        descricao: p.descricao,
        obra_nome: obra?.nome ?? null,
        fornecedor_nome: fornecedor?.nome ?? null,
        dias,
      };
    });
}
