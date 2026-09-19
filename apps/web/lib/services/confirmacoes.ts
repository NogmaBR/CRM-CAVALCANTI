import 'server-only';
import { type Proposta, lerProposta } from '@/lib/ia/ferramentas/acoes';
import { logger } from '@/lib/log';
import {
  type DadosLancaveis,
  lerDadosExtraidos,
  temDadosParaLancar,
} from '@/lib/schemas/dados-extraidos';
import { anexarMidiaComoDocumento } from '@/lib/services/anexar-midia';
import { CATEGORIAS, type DocCategoria } from '@/lib/status-labels';
import { hojeBR } from '@/lib/util/datas';
import type { Opcao } from '@/lib/whatsapp/escolha';
import { linkDoPainel } from '@/lib/whatsapp/links';
import type { Database } from '@nogma/db';
import type { Json } from '@nogma/db/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  arquivarDocumentoDeObra,
  registrarNaObra,
  respostaArquivado,
  respostaRegistrado,
} from './arquivar';

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
        | 'sem_permissao'
        | 'tipo_diferente';
      motivo: string;
    };

export type TipoPendencia = 'pagamento' | 'obra_documento' | 'obra_registro' | 'acao';

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
    .select('id, mensagem_id, resolvida, pagamento_id, tipo')
    .eq('id', ctx.confirmacaoId)
    .maybeSingle();

  if (!confirmacao) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Confirmação não encontrada.' };
  }
  // Pergunta de obra não lança pagamento: o caminho é `aplicarEscolhaDeObra`.
  if (confirmacao.tipo && confirmacao.tipo !== 'pagamento') {
    return {
      ok: false,
      codigo: 'tipo_diferente',
      motivo: 'Esta pendência pergunta a obra do arquivo, não confirma pagamento. Escolha a obra.',
    };
  }

  const { data: mensagem } = await supabase
    .from('mensagens_whats')
    .select('id, status, dados_extraidos, pagamento_id, midia_storage_path, midia_mime')
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

  // O JSONB passa pelo schema: campo inválido (valor como texto, obra que não
  // é uuid) some antes de chegar ao INSERT, e a confirmação cai no caminho
  // humano em vez de virar erro cru do Postgres.
  const dados = lerDadosExtraidos(mensagem.dados_extraidos);
  if (!temDadosParaLancar(dados)) {
    return {
      ok: false,
      codigo: 'dados_incompletos',
      motivo:
        'Faltam dados obrigatórios (valor e obra). Abra a mensagem em /whatsapp para completar manualmente.',
    };
  }

  const pagamento = await obterOuCriarPagamento(supabase, mensagem.id, dados, ctx.userId ?? null);
  if (!pagamento.ok) return pagamento;

  // A foto da nota que veio junto vira documento do pagamento. Sem isso o
  // pagamento nascia "sem documento" e a cobrança automática pediria ao
  // fornecedor a nota que ele acabou de mandar. Best-effort e idempotente.
  const anexo = await anexarMidiaComoDocumento(supabase, {
    storagePath: mensagem.midia_storage_path,
    mime: mensagem.midia_mime,
    pagamentoId: pagamento.id,
    obraId: dados.obra_id,
    fornecedorId: dados.fornecedor_id ?? null,
    dados,
    userId: ctx.userId ?? null,
  });
  if (!anexo.ok && anexo.motivo !== 'sem_midia') {
    log.aviso('midia_nao_anexada', { pagamentoId: pagamento.id, motivo: anexo.motivo });
  }

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
  dados: DadosLancaveis,
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
      obra_id: dados.obra_id,
      fornecedor_id: dados.fornecedor_id ?? null,
      categoria_id: dados.categoria_id ?? null,
      valor: dados.valor,
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
/**
 * A pessoa respondeu o número da obra a uma pendência de pagamento que veio
 * sem obra: grava `obra_id` nos dados extraídos da mensagem original. Quem
 * chama segue com `aplicarConfirmacao` — o número é a confirmação.
 */
export async function definirObraDaPendencia(
  supabase: Client,
  args: { confirmacaoId: string; obraId: string },
): Promise<
  | { ok: true }
  | { ok: false; codigo: 'nao_encontrada' | 'ja_resolvida' | 'erro_banco'; motivo: string }
> {
  const { data: confirmacao } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, resolvida')
    .eq('id', args.confirmacaoId)
    .maybeSingle();
  if (!confirmacao) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Confirmação não encontrada.' };
  }
  if (confirmacao.resolvida) {
    return { ok: false, codigo: 'ja_resolvida', motivo: 'Esta pendência já foi resolvida.' };
  }
  const { data: mensagem } = await supabase
    .from('mensagens_whats')
    .select('id, dados_extraidos')
    .eq('id', confirmacao.mensagem_id)
    .maybeSingle();
  if (!mensagem) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Mensagem original não encontrada.' };
  }
  const atuais =
    mensagem.dados_extraidos && typeof mensagem.dados_extraidos === 'object'
      ? (mensagem.dados_extraidos as Record<string, unknown>)
      : {};
  const { data: linhas, error } = await supabase
    .from('mensagens_whats')
    .update({ dados_extraidos: { ...atuais, obra_id: args.obraId } as Json })
    .eq('id', mensagem.id)
    .select('id');
  if (error || !linhas || linhas.length !== 1) {
    return {
      ok: false,
      codigo: 'erro_banco',
      motivo: error?.message ?? 'nenhuma linha atualizada',
    };
  }
  return { ok: true };
}

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
export interface PendenciaAberta {
  id: string;
  mensagemId: string;
  perguntaEnviada: string;
  tipo: TipoPendencia;
  opcoes: Opcao[];
  /** Para `tipo = 'acao'`: a proposta gravada (relida pelo schema no SIM). */
  acao: Proposta | null;
  /** Lote (janela de silêncio) de onde veio, quando veio de um. */
  loteId?: string | null;
}

export async function buscarConfirmacaoAberta(
  supabase: Client,
  telefone: string,
  janelaHoras = 24,
  opts: {
    /**
     * A pendência que a pessoa citou ou reagiu (id resolvido pelo rastro das
     * respostas). Quando vem, vence a busca pela mais recente: "sim" em cima
     * da pergunta de R$ 10 resolve a de R$ 10, mesmo que a última aberta seja
     * outra. Se já estiver resolvida, cai na busca comum.
     */
    confirmacaoId?: string | null;
    /**
     * No grupo, a pendência é da CONVERSA: qualquer autorizado responde a
     * pergunta que outro abriu ("sim" do Hugo à foto do Társis). Sem chat
     * (privado), continua sendo por telefone.
     */
    chatId?: string | null;
  } = {},
): Promise<PendenciaAberta | null> {
  if (opts.confirmacaoId) {
    const citada = await buscarConfirmacaoPorId(supabase, opts.confirmacaoId);
    if (citada) return citada;
  }
  const abertas = await pendenciasAbertas(supabase, { telefone, chatId: opts.chatId }, janelaHoras);
  return abertas[0] ?? null;
}

/**
 * Todas as pendências abertas da conversa (grupo) ou do telefone (privado),
 * da mais recente para a mais antiga, dentro da janela. É com a lista que o
 * inbound decide: uma → resolve; duas ou mais e resposta sem citação →
 * pergunta qual.
 */
export async function pendenciasAbertas(
  supabase: Client,
  quem: { telefone: string; chatId?: string | null },
  janelaHoras = 24,
): Promise<PendenciaAberta[]> {
  const desde = new Date(Date.now() - janelaHoras * 3600_000).toISOString();
  let q = supabase
    .from('confirmacoes_pendentes')
    .select(
      'id, mensagem_id, pergunta_enviada, created_at, tipo, opcoes, acao, lote_id, mensagens_whats!inner(telefone_from)',
    )
    .eq('resolvida', false)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(10);
  q = quem.chatId
    ? q.eq('chat_id', quem.chatId)
    : q.eq('mensagens_whats.telefone_from', quem.telefone);
  const { data, error } = await q;
  if (error) {
    log.erro('buscar_pendencia_falhou', { erro: error });
    return [];
  }
  return (data ?? []).map(montarPendencia);
}

/** Valor, fornecedor e obra de uma pendência, para listar "qual delas?". */
export async function resumoDaPendencia(
  supabase: Client,
  pendencia: PendenciaAberta,
): Promise<{
  valor: number | null;
  fornecedor: string | null;
  obra: string | null;
  descricao: string | null;
}> {
  const { data: msg } = await supabase
    .from('mensagens_whats')
    .select('dados_extraidos')
    .eq('id', pendencia.mensagemId)
    .maybeSingle();
  const d = lerDadosExtraidos(msg?.dados_extraidos) ?? {};
  const [obra, fornecedor] = await Promise.all([
    d.obra_id
      ? supabase.from('obras').select('nome').eq('id', d.obra_id).maybeSingle()
      : Promise.resolve({ data: null }),
    d.fornecedor_id
      ? supabase.from('fornecedores').select('nome').eq('id', d.fornecedor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    valor: d.valor ?? null,
    fornecedor: fornecedor.data?.nome ?? d.fornecedor_nome_novo ?? null,
    obra: obra.data?.nome ?? null,
    descricao: d.descricao ?? null,
  };
}

/** Uma pendência específica, só se ainda estiver aberta. */
export async function buscarConfirmacaoPorId(
  supabase: Client,
  confirmacaoId: string,
): Promise<PendenciaAberta | null> {
  const { data, error } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, pergunta_enviada, created_at, tipo, opcoes, acao, lote_id')
    .eq('id', confirmacaoId)
    .eq('resolvida', false)
    .maybeSingle();
  if (error) {
    log.erro('buscar_pendencia_falhou', { erro: error });
    return null;
  }
  return data ? montarPendencia(data) : null;
}

function montarPendencia(linha: {
  id: string;
  mensagem_id: string;
  pergunta_enviada: string;
  tipo: string;
  opcoes: unknown;
  acao: unknown;
  lote_id?: string | null;
}): PendenciaAberta {
  return {
    id: linha.id,
    mensagemId: linha.mensagem_id,
    perguntaEnviada: linha.pergunta_enviada,
    tipo: lerTipoPendencia(linha.tipo),
    opcoes: lerOpcoes(linha.opcoes),
    acao: lerProposta(linha.acao),
    loteId: linha.lote_id ?? null,
  };
}

/** As pendências abertas de um lote, na ordem da lista que o agente mandou. */
export async function pendenciasDoLote(
  supabase: Client,
  loteId: string,
): Promise<PendenciaAberta[]> {
  const { data, error } = await supabase
    .from('confirmacoes_pendentes')
    .select(
      'id, mensagem_id, pergunta_enviada, created_at, tipo, opcoes, acao, lote_id, indice_no_lote',
    )
    .eq('lote_id', loteId)
    .eq('resolvida', false)
    .order('indice_no_lote', { ascending: true })
    .limit(50);
  if (error) {
    log.erro('buscar_pendencia_falhou', { erro: error });
    return [];
  }
  return (data ?? []).map(montarPendencia);
}

export function lerTipoPendencia(t: unknown): TipoPendencia {
  return t === 'obra_documento' || t === 'obra_registro' || t === 'acao' ? t : 'pagamento';
}

export function lerOpcoes(v: unknown): Opcao[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (o): o is Record<string, unknown> =>
        !!o && typeof o === 'object' && typeof (o as Record<string, unknown>).id === 'string',
    )
    .map((o) => ({
      n: Number(o.n),
      id: String(o.id),
      nome: String(o.nome ?? ''),
      apelidos: Array.isArray(o.apelidos) ? o.apelidos.map(String) : [],
    }));
}

export type ResultadoEscolha =
  | {
      ok: true;
      resposta: string;
      jaEstavaResolvida: boolean;
      /** O que foi criado: vai para o rastro da resposta (é o alvo de um "desfaz"). */
      documentoId?: string;
      registroId?: string;
    }
  | {
      ok: false;
      codigo:
        | 'nao_encontrada'
        | 'ja_resolvida'
        | 'tipo_diferente'
        | 'erro_insert'
        | 'sem_permissao';
      motivo: string;
    };

/**
 * Resolve uma pendência de obra (`obra_documento` / `obra_registro`) com a
 * obra escolhida — pelo número no WhatsApp ou pelo gestor no painel.
 *
 * Arquiva (ou registra) na obra e fecha a pendência. Idempotente: a segunda
 * chamada devolve a mesma resposta sem duplicar (o arquivamento é por
 * mensagem, e a pendência já resolvida devolve `jaEstavaResolvida`).
 */
export async function aplicarEscolhaDeObra(
  supabase: Client,
  ctx: ContextoResolucao & { obraId: string },
): Promise<ResultadoEscolha> {
  const { data: confirmacao } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, resolvida, tipo')
    .eq('id', ctx.confirmacaoId)
    .maybeSingle();
  if (!confirmacao) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Pendência não encontrada.' };
  }
  const tipo = lerTipoPendencia(confirmacao.tipo);
  if (tipo === 'pagamento') {
    return {
      ok: false,
      codigo: 'tipo_diferente',
      motivo: 'Esta pendência é de pagamento; confirme ou recuse.',
    };
  }

  const { data: obra } = await supabase
    .from('obras')
    .select('id, nome')
    .eq('id', ctx.obraId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!obra) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Obra não encontrada.' };
  }

  const { data: mensagem } = await supabase
    .from('mensagens_whats')
    .select(
      'id, texto_bruto, texto_transcrito, dados_extraidos, midia_storage_path, midia_mime, autorizado_id',
    )
    .eq('id', confirmacao.mensagem_id)
    .maybeSingle();
  if (!mensagem) {
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Mensagem original não encontrada.' };
  }

  const dados = (mensagem.dados_extraidos ?? {}) as Record<string, unknown>;
  const categoria = categoriaValida(dados.categoria);

  let resposta: string;
  let documentoId: string | undefined;
  let registroId: string | undefined;
  if (tipo === 'obra_documento') {
    const r = await arquivarDocumentoDeObra(supabase, {
      mensagemId: mensagem.id,
      obraId: obra.id,
      categoria,
      tipo: tipoAnexoValido(dados.tipo_documento),
      storagePath: mensagem.midia_storage_path,
      mime: mensagem.midia_mime,
      autorizadoId: mensagem.autorizado_id,
      legenda: mensagem.texto_bruto,
    });
    if (!r.ok) {
      return { ok: false, codigo: 'erro_insert', motivo: `Não consegui arquivar (${r.motivo}).` };
    }
    documentoId = r.documentoId;
    resposta = respostaArquivado(obra.nome, categoria, {
      link: linkDoPainel(`/documentos/${r.documentoId}`),
    });
  } else {
    const r = await registrarNaObra(supabase, {
      mensagemId: mensagem.id,
      obraId: obra.id,
      texto: mensagem.texto_bruto ?? mensagem.texto_transcrito,
      resumo: typeof dados.resumo === 'string' ? dados.resumo : null,
      storagePath: mensagem.midia_storage_path,
      mime: mensagem.midia_mime,
      autorizadoId: mensagem.autorizado_id,
    });
    if (!r.ok) {
      return { ok: false, codigo: 'erro_insert', motivo: `Não consegui registrar (${r.motivo}).` };
    }
    registroId = r.registroId;
    resposta = respostaRegistrado(obra.nome, { link: linkDoPainel(`/obras/${obra.id}#diario`) });
  }

  if (confirmacao.resolvida) {
    return { ok: true, resposta, jaEstavaResolvida: true, documentoId, registroId };
  }

  const confUpd = await supabase
    .from('confirmacoes_pendentes')
    .update({
      resolvida: true,
      respondida_em: new Date().toISOString(),
      resposta_bruta: ctx.respostaBruta,
      resolvida_via: ctx.via,
      resultado: 'confirmada',
    })
    .eq('id', ctx.confirmacaoId)
    .select('id');
  if (confUpd.error || (confUpd.data?.length ?? 0) === 0) {
    log.erro('escolha_pendencia_nao_fechada', {
      confirmacaoId: ctx.confirmacaoId,
      erro: confUpd.error?.message ?? 'zero linhas (permissão?)',
    });
    return {
      ok: false,
      codigo: 'sem_permissao',
      motivo: 'Sem permissão para resolver esta pendência.',
    };
  }

  return { ok: true, resposta, jaEstavaResolvida: false, documentoId, registroId };
}

function categoriaValida(c: unknown): DocCategoria {
  return typeof c === 'string' && (CATEGORIAS as readonly string[]).includes(c)
    ? (c as DocCategoria)
    : 'outro';
}

function tipoAnexoValido(t: unknown): 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro' {
  return t === 'nota_fiscal' || t === 'comprovante' || t === 'contrato' ? t : 'outro';
}
