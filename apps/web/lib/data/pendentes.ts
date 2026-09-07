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
