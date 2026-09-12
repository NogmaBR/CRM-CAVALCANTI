import 'server-only';
import type { DadosExtraidos } from '@/lib/data/pendentes';
import { logger } from '@/lib/log';
import { hojeBR } from '@/lib/util/datas';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger('confirmacoes');

/**
 * Resolução de uma confirmação pendente — o núcleo do fluxo do briefing.
 *
 * Existe como service, e não dentro da server action, porque agora tem DOIS
 * chamadores que precisam se comportar de forma idêntica:
 *
 *   1. `/pendentes` — o gestor clica em Confirmar/Rejeitar.
 *   2. O webhook do UAZAPI — o cliente responde "SIM"/"NÃO" no WhatsApp.
 *
 * Se essa lógica ficasse duplicada, os dois caminhos divergiriam no primeiro
 * ajuste (a guarda de idempotência, por exemplo, existia só no painel) e o
 * resultado seria pagamento duplicado quando o cliente responde "SIM" no
 * mesmo instante em que o gestor clica em "Confirmar".
 *
 * O client é injetado porque o contexto muda: o painel usa a sessão do
 * usuário (RLS ativa, `criado_por_user_id` preenchido) e o webhook usa
 * service_role (não há sessão — a autorização ali é o HMAC + `autorizados`).
 */

export type ViaResolucao = 'painel' | 'whatsapp' | 'expiracao';

export type ResultadoConfirmacao =
  | { ok: true; pagamentoId: string; jaEstavaResolvida: boolean }
  | {
      ok: false;
      codigo:
        | 'nao_encontrada'
        | 'ja_resolvida'
        | 'dados_incompletos'
        | 'erro_insert'
        | 'sem_permissao';
      motivo: string;
    };

export type ResultadoRecusa =
  | { ok: true; jaEstavaResolvida: boolean }
  | { ok: false; codigo: 'nao_encontrada' | 'sem_permissao'; motivo: string };

type Client = SupabaseClient<Database>;

interface ContextoResolucao {
  confirmacaoId: string;
  via: ViaResolucao;
  /** Texto literal da resposta — fica no audit trail de `resposta_bruta`. */
  respostaBruta: string;
  /** Preenchido só quando veio do painel; no WhatsApp não há sessão. */
  userId?: string | null;
}

/**
 * Confirma a pendência: cria o pagamento (se ainda não existe) e fecha a
 * confirmação.
 *
 * Idempotente em dois níveis, porque as duas corridas são reais:
 *   - a pré-checagem por `criado_via_msg_id` cobre duplo-clique e o caso
 *     "gestor clica enquanto o SIM chega";
 *   - o catch de `23505` cobre a corrida que passa entre o SELECT e o INSERT,
 *     apoiado no índice único parcial `idx_pagamentos_criado_via_msg_unique`.
 */
export async function aplicarConfirmacao(
  supabase: Client,
  ctx: ContextoResolucao,
): Promise<ResultadoConfirmacao> {
  const { data: confirmacao } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, resolvida, pagamento_id')
    .eq('id', ctx.confirmacaoId)
    .maybeSingle();

  if (!confirmacao) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Confirmação não encontrada.' };
  }

  const { data: mensagem } = await supabase
    .from('mensagens_whats')
    .select('id, status, dados_extraidos, pagamento_id')
    .eq('id', confirmacao.mensagem_id)
    .maybeSingle();

  if (!mensagem) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Mensagem original não encontrada.' };
  }

  // Já resolvida: se resultou em pagamento, devolvemos o mesmo id em vez de
  // erro — quem chamou duas vezes recebe a mesma resposta das duas.
  if (confirmacao.resolvida) {
    const pagamentoId = confirmacao.pagamento_id ?? mensagem.pagamento_id;
    if (pagamentoId) {
      return { ok: true, pagamentoId, jaEstavaResolvida: true };
    }
    return { ok: false, codigo: 'ja_resolvida', motivo: 'Esta pendência já foi resolvida.' };
  }

  const dados = mensagem.dados_extraidos as DadosExtraidos | null;
  if (!dados?.valor || !dados?.obra_id) {
    return {
      ok: false,
      codigo: 'dados_incompletos',
      motivo:
        'Faltam dados obrigatórios (valor e obra). Abra a mensagem em /whatsapp para completar manualmente.',
    };
  }

  const pagamento = await obterOuCriarPagamento(supabase, mensagem.id, dados, ctx.userId ?? null);
  if (!pagamento.ok) return pagamento;

  // Cada escrita confere erro E linhas afetadas: com a RLS, um papel sem
  // permissão faz o UPDATE atingir zero linhas sem erro nenhum — e a
  // pendência ficava "resolvida" só na mensagem de sucesso.
  const msgUpd = await supabase
    .from('mensagens_whats')
    .update({ status: 'confirmada', pagamento_id: pagamento.id })
    .eq('id', mensagem.id)
    .select('id');
  if (msgUpd.error || (msgUpd.data?.length ?? 0) === 0) {
    log.erro('confirmacao_mensagem_nao_atualizada', {
      mensagemId: mensagem.id,
      erro: msgUpd.error?.message ?? 'zero linhas (permissão?)',
    });
    return {
      ok: false,
      codigo: 'sem_permissao',
      motivo: 'Sem permissão para confirmar esta pendência.',
    };
  }

  const confUpd = await supabase
    .from('confirmacoes_pendentes')
    .update({
      resolvida: true,
      respondida_em: new Date().toISOString(),
      resposta_bruta: ctx.respostaBruta,
      resolvida_via: ctx.via,
      resultado: 'confirmada',
      pagamento_id: pagamento.id,
    })
    .eq('id', ctx.confirmacaoId)
    .select('id');
  if (confUpd.error || (confUpd.data?.length ?? 0) === 0) {
    log.erro('confirmacao_pendencia_nao_fechada', {
      confirmacaoId: ctx.confirmacaoId,
      erro: confUpd.error?.message ?? 'zero linhas (permissão?)',
    });
    return {
      ok: false,
      codigo: 'sem_permissao',
      motivo: 'Sem permissão para confirmar esta pendência.',
    };
  }

  return { ok: true, pagamentoId: pagamento.id, jaEstavaResolvida: false };
}

async function obterOuCriarPagamento(
  supabase: Client,
  mensagemId: string,
  dados: DadosExtraidos,
  userId: string | null,
): Promise<{ ok: true; id: string } | { ok: false; codigo: 'erro_insert'; motivo: string }> {
  const { data: existente } = await supabase
    .from('pagamentos')
    .select('id')
    .eq('criado_via_msg_id', mensagemId)
    .maybeSingle();

  if (existente) return { ok: true, id: existente.id };

  const hoje = hojeBR();
  const { data: novo, error } = await supabase
    .from('pagamentos')
    .insert({
      obra_id: dados.obra_id!,
      fornecedor_id: dados.fornecedor_id ?? null,
      valor: dados.valor!,
      data_pagamento: dados.data_pagamento ?? hoje,
      origem: 'whatsapp',
      status_pagto: 'confirmado',
      descricao: dados.descricao ?? null,
      criado_via_msg_id: mensagemId,
      criado_por_user_id: userId,
    })
    .select('id')
    .single();

  if (error || !novo) {
    if (error?.code === '23505') {
      // Corrida perdida entre o SELECT acima e este INSERT: o vencedor já
      // gravou, então buscamos o registro dele e seguimos.
      const { data: vencedor } = await supabase
        .from('pagamentos')
        .select('id')
        .eq('criado_via_msg_id', mensagemId)
        .maybeSingle();
      if (vencedor) return { ok: true, id: vencedor.id };
    }
    log.erro('insert_pagamento_falhou', { mensagemId, erro: error });
    return {
      ok: false,
      codigo: 'erro_insert',
      motivo: 'Não foi possível criar o pagamento. Tente novamente.',
    };
  }

  return { ok: true, id: novo.id };
}

/**
 * Recusa a pendência.
 *
 * Grava `msg_status='recusada'` — não mais `'erro'`. A verificação do briefing
 * apontou que misturar os dois torna impossível distinguir "o gestor não
 * aprovou" de "o classificador quebrou", que são coisas diferentes tanto pro
 * relatório quanto pra quem vai investigar uma falha.
 */
export async function recusarConfirmacao(
  supabase: Client,
  ctx: ContextoResolucao & { motivo?: string },
): Promise<ResultadoRecusa> {
  const { data: confirmacao } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, resolvida')
    .eq('id', ctx.confirmacaoId)
    .maybeSingle();

  if (!confirmacao) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Confirmação não encontrada.' };
  }
  if (confirmacao.resolvida) {
    return { ok: true, jaEstavaResolvida: true };
  }

  const msgUpd = await supabase
    .from('mensagens_whats')
    .update({
      status: 'recusada',
      erro_msg:
        ctx.motivo ??
        (ctx.via === 'whatsapp'
          ? 'Recusada pelo remetente no WhatsApp'
          : 'Recusada pelo gestor no painel'),
    })
    .eq('id', confirmacao.mensagem_id)
    .select('id');
  if (msgUpd.error || (msgUpd.data?.length ?? 0) === 0) {
    log.erro('recusa_mensagem_nao_atualizada', {
      mensagemId: confirmacao.mensagem_id,
      erro: msgUpd.error?.message ?? 'zero linhas (permissão?)',
    });
    return {
      ok: false,
      codigo: 'sem_permissao',
      motivo: 'Sem permissão para recusar esta pendência.',
    };
  }

  const confUpd = await supabase
    .from('confirmacoes_pendentes')
    .update({
      resolvida: true,
      respondida_em: new Date().toISOString(),
      resposta_bruta: ctx.respostaBruta,
      resolvida_via: ctx.via,
      resultado: 'recusada',
    })
    .eq('id', ctx.confirmacaoId)
    .select('id');
  if (confUpd.error || (confUpd.data?.length ?? 0) === 0) {
    log.erro('recusa_pendencia_nao_fechada', {
      confirmacaoId: ctx.confirmacaoId,
      erro: confUpd.error?.message ?? 'zero linhas (permissão?)',
    });
    return {
      ok: false,
      codigo: 'sem_permissao',
      motivo: 'Sem permissão para recusar esta pendência.',
    };
  }

  return { ok: true, jaEstavaResolvida: false };
}

/**
 * Localiza a confirmação em aberto mais recente de um telefone.
 *
 * `janelaHoras` evita que um "ok" solto amanhã de manhã resolva a pendência
 * de anteontem: passado o prazo, a resposta volta a ser tratada como mensagem
 * nova e a pendência antiga fica pro gestor decidir.
 */
export async function buscarConfirmacaoAberta(
  supabase: Client,
  telefone: string,
  janelaHoras = 24,
): Promise<{ id: string; mensagemId: string; perguntaEnviada: string } | null> {
  const desde = new Date(Date.now() - janelaHoras * 3600_000).toISOString();

  const { data, error } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, pergunta_enviada, created_at, mensagens_whats!inner(telefone_from)')
    .eq('resolvida', false)
    .eq('mensagens_whats.telefone_from', telefone)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    log.erro('buscar_pendencia_falhou', { erro: error });
    return null;
  }

  const linha = data?.[0];
  if (!linha) return null;

  return {
    id: linha.id,
    mensagemId: linha.mensagem_id,
    perguntaEnviada: linha.pergunta_enviada,
  };
}
