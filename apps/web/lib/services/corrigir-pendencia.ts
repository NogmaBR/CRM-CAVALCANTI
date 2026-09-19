import 'server-only';
import { logger } from '@/lib/log';
import { type DadosExtraidos, lerDadosExtraidos } from '@/lib/schemas/dados-extraidos';
import type { PatchDeCorrecao } from '@/lib/whatsapp/correcao';
import { perguntaDePagamento, respostaCorrigida } from '@/lib/whatsapp/textos';
import type { Database } from '@nogma/db';
import type { Json } from '@nogma/db/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendenciaAberta } from './confirmacoes';
import { zerarObraDaConversa } from './escolha-pendencia';

type Client = SupabaseClient<Database>;

const log = logger('corrigir-pendencia');

export type ResultadoCorrecao =
  | { ok: true; resposta: string; mudancas: string[] }
  | { ok: false; codigo: 'nao_encontrada' | 'sem_mudanca' | 'erro'; motivo: string };

/**
 * Aplica uma correção parcial a uma pendência de pagamento e pergunta de novo.
 *
 * "Não, é na INOX" em cima de "Vou lançar R$ 109,99 na Garibaldi" trocava
 * tudo por "não entendi". Aqui o patch entra em `dados_extraidos` (só os
 * campos ditos), a pergunta é remontada pelo mesmo template de sempre e a
 * pendência fica aberta esperando o SIM — correção não grava nada. O que
 * mudou vai para o rastro em `resposta_bruta` (auditoria) e para a resposta
 * ("Troquei a obra para INOX Piratini").
 *
 * Também lembra a obra dita: é a obra da conversa a partir de agora
 * (`conversa_estado`), e o que se deduzia antes disso não vale mais.
 */
export async function corrigirPendencia(
  supabase: Client,
  args: {
    pendencia: PendenciaAberta;
    patch: PatchDeCorrecao;
    chatId: string | null;
    respostaBruta: string;
    /** Como a pergunta foi lida da primeira vez (anexo/áudio), para a nova pergunta. */
    origem?: { deAnexo?: boolean; deAudio?: boolean };
  },
): Promise<ResultadoCorrecao> {
  const { pendencia, patch } = args;
  const { data: msg } = await supabase
    .from('mensagens_whats')
    .select('id, dados_extraidos, midia_storage_path, tipo')
    .eq('id', pendencia.mensagemId)
    .maybeSingle();
  if (!msg) return { ok: false, codigo: 'nao_encontrada', motivo: 'Mensagem original sumiu.' };

  const atual: DadosExtraidos = lerDadosExtraidos(msg.dados_extraidos) ?? {};
  const novo: DadosExtraidos = { ...atual };
  const mudancas: string[] = [];

  if (patch.obra && patch.obra.id !== atual.obra_id) {
    novo.obra_id = patch.obra.id;
    mudancas.push(`a obra para ${patch.obra.nome}`);
  }
  if (patch.fornecedor && patch.fornecedor.id !== atual.fornecedor_id) {
    novo.fornecedor_id = patch.fornecedor.id;
    novo.fornecedor_nome_novo = undefined;
    mudancas.push(`o fornecedor para ${patch.fornecedor.nome}`);
  } else if (patch.fornecedorNomeNovo && patch.fornecedorNomeNovo !== atual.fornecedor_nome_novo) {
    novo.fornecedor_id = undefined;
    novo.fornecedor_nome_novo = patch.fornecedorNomeNovo;
    mudancas.push(`o fornecedor para ${patch.fornecedorNomeNovo}`);
  }
  if (patch.valor != null && patch.valor !== atual.valor) {
    novo.valor = patch.valor;
    mudancas.push('o valor');
  }
  if (patch.data && patch.data !== atual.data_pagamento) {
    novo.data_pagamento = patch.data;
    mudancas.push('a data');
  }
  if (patch.descricao && patch.descricao !== atual.descricao) {
    novo.descricao = patch.descricao;
    mudancas.push('a descrição');
  }
  if (mudancas.length === 0) {
    return { ok: false, codigo: 'sem_mudanca', motivo: 'Nada para mudar.' };
  }

  // Nomes para a pergunta nova: só o que a pergunta mostra.
  const [obra, fornecedor, categoria] = await Promise.all([
    novo.obra_id
      ? supabase.from('obras').select('nome').eq('id', novo.obra_id).maybeSingle()
      : Promise.resolve({ data: null }),
    novo.fornecedor_id
      ? supabase.from('fornecedores').select('nome').eq('id', novo.fornecedor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    novo.categoria_id
      ? supabase.from('categorias').select('nome').eq('id', novo.categoria_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const deAudio = args.origem?.deAudio ?? msg.tipo === 'audio';
  const deAnexo = args.origem?.deAnexo ?? (Boolean(msg.midia_storage_path) && !deAudio);
  const pergunta =
    novo.valor != null
      ? perguntaDePagamento({
          valor: novo.valor,
          obra: obra.data?.nome ?? null,
          fornecedor: fornecedor.data?.nome ?? novo.fornecedor_nome_novo ?? null,
          descricao: novo.descricao ?? null,
          data: novo.data_pagamento ?? null,
          categoria: categoria.data?.nome ?? null,
          deAnexo,
          deAudio,
        })
      : pendencia.perguntaEnviada;

  const limpo = Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== undefined));
  const upd = await supabase
    .from('mensagens_whats')
    .update({ dados_extraidos: limpo as Json })
    .eq('id', msg.id)
    .select('id');
  if (upd.error || (upd.data?.length ?? 0) === 0) {
    log.erro('correcao_nao_gravada', { erro: upd.error?.message ?? 'zero linhas' });
    return { ok: false, codigo: 'erro', motivo: 'Não consegui gravar a correção.' };
  }

  // A pergunta de obra (opções numeradas) deixa de existir quando a obra
  // veio pela correção: a pendência vira "confirma?" comum.
  const patchPend: Database['public']['Tables']['confirmacoes_pendentes']['Update'] = {
    pergunta_enviada: pergunta,
    resposta_bruta: `correção: ${args.respostaBruta}`.slice(0, 500),
  };
  if (novo.obra_id && pendencia.opcoes.length > 0) patchPend.opcoes = null;
  await supabase.from('confirmacoes_pendentes').update(patchPend).eq('id', pendencia.id);

  if (args.chatId) await zerarObraDaConversa(supabase, args.chatId, patch.obra ?? null);

  return {
    ok: true,
    mudancas,
    resposta: respostaCorrigida(mudancas, novo.valor != null ? pergunta : null),
  };
}
