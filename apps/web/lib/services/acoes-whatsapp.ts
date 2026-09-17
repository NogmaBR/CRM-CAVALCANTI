import 'server-only';
import { type Proposta, lerProposta } from '@/lib/ia/ferramentas/acoes';
import { logger } from '@/lib/log';
import { RESPOSTAS, brl, dataBR, valorLegivel } from '@/lib/whatsapp/textos';
import type { Database } from '@nogma/db';
import type { Json } from '@nogma/db/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger('acoes-whatsapp');

type Client = SupabaseClient<Database>;

/**
 * Ações pedidas pelo WhatsApp: a pergunta, a pendência e o "SIM".
 *
 * O agente nunca grava a partir do que o modelo entendeu. Ele **propõe**
 * (`lib/ia/ferramentas/acoes.ts`), a proposta vira uma linha em
 * `confirmacoes_pendentes` com `tipo = 'acao'`, o bot repete tudo o que vai
 * gravar e pergunta. Só o SIM executa — e executa o que está gravado na
 * pendência, não o que o modelo disse na hora.
 *
 * ## A pergunta é template, não texto do modelo
 *
 * `perguntaDaAcao` monta a frase a partir da proposta, campo a campo. É a
 * garantia de que o que se pergunta é exatamente o que se vai gravar, e é
 * onde o texto é ajustado para quem lê no celular com dificuldade: uma
 * informação por linha, valor por extenso curto, instrução no fim.
 *
 * ## O SIM é idempotente
 *
 * `aplicarAcao` primeiro **reivindica** a pendência (`UPDATE … WHERE
 * resolvida = false`); quem perde a corrida do retry recebe `ja_resolvida` e
 * responde a mesma frase de sucesso. Se a escrita falhar depois da
 * reivindicação, a pendência volta a aberta com o erro em `resultado`, e o
 * painel pode confirmar de novo.
 */

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

// Formatação compartilhada com todos os textos do WhatsApp.
export { brl, dataBR, porExtensoCurto } from '@/lib/whatsapp/textos';

const TIPO_OBRA: Record<'nova' | 'reforma', string> = { nova: 'obra nova', reforma: 'reforma' };

const RODAPE = 'Responda *SIM* para confirmar, ou *NÃO* para cancelar.';

/** Título curto da ação, para o painel e para o log. */
export function tituloDaAcao(p: Proposta): string {
  switch (p.tipo) {
    case 'criar_obra':
      return `Criar obra "${p.dados.nome}"`;
    case 'cadastrar_fornecedor':
      return `Cadastrar fornecedor "${p.dados.nome}"`;
    case 'definir_contrato':
      return `Contrato da obra ${p.dados.obra_nome}: ${brl(p.dados.valor)}`;
    case 'registrar_recebimento':
      return `Recebimento de ${brl(p.dados.valor)} na obra ${p.dados.obra_nome}`;
    case 'arquivar_obra':
      return `Arquivar obra "${p.dados.obra_nome}"`;
  }
}

/** A pergunta que vai para o WhatsApp. Uma informação por linha; instrução no fim. */
export function perguntaDaAcao(p: Proposta): string {
  const linhas: string[] = [];
  switch (p.tipo) {
    case 'criar_obra': {
      linhas.push('Vou *criar uma obra nova* com estes dados:', '');
      linhas.push(`• Nome da obra: *${p.dados.nome}*`);
      linhas.push(`• Cliente: ${p.dados.cliente ?? 'não informado'}`);
      if (p.dados.tipo_obra) linhas.push(`• Tipo: ${TIPO_OBRA[p.dados.tipo_obra]}`);
      if (p.dados.endereco) linhas.push(`• Endereço: ${p.dados.endereco}`);
      linhas.push(
        `• Valor do contrato: ${p.dados.valor_contrato == null ? 'não informado (pode dizer depois)' : valorLegivel(p.dados.valor_contrato)}`,
      );
      if (p.dados.data_inicio) linhas.push(`• Início: ${dataBR(p.dados.data_inicio)}`);
      linhas.push('', 'Depois de criada, tudo que você mandar sobre ela eu guardo na pasta certa.');
      break;
    }
    case 'cadastrar_fornecedor': {
      linhas.push('Vou *cadastrar um fornecedor* com estes dados:', '');
      linhas.push(`• Nome: *${p.dados.nome}*`);
      linhas.push(
        `• ${p.dados.documento?.length === 11 ? 'CPF' : 'CNPJ'}: ${p.dados.documento ?? 'não informado'}`,
      );
      linhas.push(`• Telefone: ${p.dados.telefone ?? 'não informado'}`);
      break;
    }
    case 'definir_contrato': {
      linhas.push(`Vou *anotar o valor do contrato* da obra *${p.dados.obra_nome}*:`, '');
      linhas.push(`• Valor do contrato: *${valorLegivel(p.dados.valor)}*`);
      if (p.dados.valor_anterior != null) {
        linhas.push(`• Substitui o valor anterior: ${brl(p.dados.valor_anterior)}`);
      }
      linhas.push('', 'Com esse valor eu consigo dizer quanto a obra está lucrando.');
      break;
    }
    case 'registrar_recebimento': {
      linhas.push(`Vou *registrar um recebimento* do cliente da obra *${p.dados.obra_nome}*:`, '');
      linhas.push(`• Valor recebido: *${valorLegivel(p.dados.valor)}*`);
      linhas.push(`• Data: ${dataBR(p.dados.data)}`);
      linhas.push(`• Descrição: ${p.dados.descricao ?? 'não informada'}`);
      linhas.push(
        '',
        'Isso é dinheiro que ENTROU. Se foi um pagamento a fornecedor, responda NÃO.',
      );
      break;
    }
    case 'arquivar_obra': {
      linhas.push(`Vou *arquivar a obra* *${p.dados.obra_nome}*.`, '');
      linhas.push('• Ela sai da lista de obras em andamento.');
      linhas.push('• Os pagamentos e documentos ficam guardados.');
      linhas.push('• Dá para restaurar depois pelo painel.');
      break;
    }
  }
  linhas.push('', RODAPE);
  return linhas.join('\n');
}

/** A frase de sucesso depois do SIM. */
export function respostaDaAcao(p: Proposta): string {
  switch (p.tipo) {
    case 'criar_obra':
      return [
        `✅ Obra *${p.dados.nome}* criada.`,
        '',
        'Pode mandar fotos, notas e documentos dela aqui que eu guardo na pasta certa.',
        'Para ver a obra no painel: menu Obras.',
      ].join('\n');
    case 'cadastrar_fornecedor':
      return `✅ Fornecedor *${p.dados.nome}* cadastrado.`;
    case 'definir_contrato':
      return [
        `✅ Anotado: o contrato da obra *${p.dados.obra_nome}* é ${valorLegivel(p.dados.valor)}.`,
        '',
        `Quer saber como está? Pergunte: "como está a obra ${p.dados.obra_nome}".`,
      ].join('\n');
    case 'registrar_recebimento':
      return `✅ Recebimento de ${valorLegivel(p.dados.valor)} registrado na obra *${p.dados.obra_nome}* (${dataBR(p.dados.data)}).`;
    case 'arquivar_obra':
      return `✅ Obra *${p.dados.obra_nome}* arquivada. Para restaurar, use o painel.`;
  }
}

export const RESPOSTA_ACAO_CANCELADA = RESPOSTAS.acaoCancelada;

// ---------------------------------------------------------------------------
// Pendência
// ---------------------------------------------------------------------------

export async function abrirPendenciaDeAcao(
  supabase: Client,
  args: { mensagemId: string; proposta: Proposta; chatId: string | null },
): Promise<{ ok: true; id: string; pergunta: string } | { ok: false; erro: string }> {
  const pergunta = perguntaDaAcao(args.proposta);
  const { data, error } = await supabase
    .from('confirmacoes_pendentes')
    .insert({
      mensagem_id: args.mensagemId,
      tipo: 'acao',
      acao: args.proposta as unknown as Json,
      chat_id: args.chatId,
      pergunta_enviada: pergunta,
      resolvida: false,
    })
    .select('id')
    .single();
  if (error || !data) {
    log.erro('abrir_pendencia_acao_falhou', { erro: error?.message, tipo: args.proposta.tipo });
    return { ok: false, erro: error?.message ?? 'insert sem retorno' };
  }
  return { ok: true, id: data.id, pergunta };
}

export type ResultadoAcao =
  | { ok: true; texto: string; jaEstavaResolvida: boolean; proposta: Proposta }
  | {
      ok: false;
      codigo:
        | 'nao_encontrada'
        | 'tipo_diferente'
        | 'proposta_invalida'
        | 'ja_resolvida'
        | 'erro_escrita';
      motivo: string;
    };

export async function aplicarAcao(
  supabase: Client,
  ctx: {
    confirmacaoId: string;
    via: 'whatsapp' | 'painel';
    respostaBruta: string;
    userId?: string | null;
  },
): Promise<ResultadoAcao> {
  const { data: pendencia } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, resolvida, tipo, acao, resultado')
    .eq('id', ctx.confirmacaoId)
    .maybeSingle();

  if (!pendencia)
    return { ok: false, codigo: 'nao_encontrada', motivo: 'Pendência não encontrada.' };
  if (pendencia.tipo !== 'acao') {
    return { ok: false, codigo: 'tipo_diferente', motivo: 'Esta pendência não é uma ação.' };
  }
  const proposta = lerProposta(pendencia.acao);
  if (!proposta) {
    return {
      ok: false,
      codigo: 'proposta_invalida',
      motivo: 'A ação gravada não está mais no formato esperado. Faça pelo painel.',
    };
  }

  // Já executada: mesma frase para quem chamou duas vezes.
  if (pendencia.resolvida) {
    if (pendencia.resultado === 'executada') {
      return { ok: true, texto: respostaDaAcao(proposta), jaEstavaResolvida: true, proposta };
    }
    return { ok: false, codigo: 'ja_resolvida', motivo: 'Esta pendência já foi resolvida.' };
  }

  // Reivindica antes de executar: o perdedor da corrida do retry atinge zero
  // linhas e devolve `ja_resolvida` — nunca duas obras com o mesmo nome.
  const agora = new Date().toISOString();
  const claim = await supabase
    .from('confirmacoes_pendentes')
    .update({
      resolvida: true,
      respondida_em: agora,
      resposta_bruta: ctx.respostaBruta,
      resolvida_via: ctx.via,
      resultado: 'executando',
    })
    .eq('id', ctx.confirmacaoId)
    .eq('resolvida', false)
    .select('id');
  if (claim.error || (claim.data?.length ?? 0) === 0) {
    return { ok: false, codigo: 'ja_resolvida', motivo: 'Esta pendência já foi resolvida.' };
  }

  const escrita = await executar(supabase, proposta, ctx.userId ?? null, pendencia.mensagem_id);
  if (!escrita.ok) {
    log.erro('acao_falhou', { tipo: proposta.tipo, erro: escrita.erro });
    // Volta a aberta com o erro visível; o painel pode confirmar de novo.
    await supabase
      .from('confirmacoes_pendentes')
      .update({ resolvida: false, resultado: `erro: ${escrita.erro}`.slice(0, 500) })
      .eq('id', ctx.confirmacaoId);
    return { ok: false, codigo: 'erro_escrita', motivo: escrita.erro };
  }

  await supabase
    .from('confirmacoes_pendentes')
    .update({ resultado: 'executada' })
    .eq('id', ctx.confirmacaoId);
  await supabase
    .from('mensagens_whats')
    .update({ status: 'confirmada' })
    .eq('id', pendencia.mensagem_id);

  log.info('acao_executada', { tipo: proposta.tipo, via: ctx.via });
  return { ok: true, texto: respostaDaAcao(proposta), jaEstavaResolvida: false, proposta };
}

// ---------------------------------------------------------------------------
// As escritas, uma função pequena por tipo
// ---------------------------------------------------------------------------

type Escrita = { ok: true } | { ok: false; erro: string };

async function executar(
  supabase: Client,
  p: Proposta,
  userId: string | null,
  mensagemId: string,
): Promise<Escrita> {
  switch (p.tipo) {
    case 'criar_obra':
      return criarObra(supabase, p.dados);
    case 'cadastrar_fornecedor':
      return cadastrarFornecedor(supabase, p.dados);
    case 'definir_contrato':
      return definirContrato(supabase, p.dados);
    case 'registrar_recebimento':
      return registrarRecebimento(supabase, p.dados, userId, mensagemId);
    case 'arquivar_obra':
      return arquivarObra(supabase, p.dados);
  }
}

function deErro(error: { message: string; code?: string } | null): Escrita {
  if (!error) return { ok: true };
  return { ok: false, erro: error.message };
}

async function criarObra(
  supabase: Client,
  d: Extract<Proposta, { tipo: 'criar_obra' }>['dados'],
): Promise<Escrita> {
  const { error } = await supabase.from('obras').insert({
    nome: d.nome,
    cliente: d.cliente,
    tipo: d.tipo_obra,
    status: 'ativa',
    // Endereço veio como texto livre; fica em `rua` para a página mostrar.
    endereco: d.endereco ? ({ rua: d.endereco } as unknown as Json) : null,
    valor_contrato: d.valor_contrato,
    data_inicio: d.data_inicio,
    apelidos: [],
  });
  return deErro(error);
}

async function cadastrarFornecedor(
  supabase: Client,
  d: Extract<Proposta, { tipo: 'cadastrar_fornecedor' }>['dados'],
): Promise<Escrita> {
  const { error } = await supabase.from('fornecedores').insert({
    nome: d.nome,
    documento: d.documento,
    documento_tipo: d.documento ? (d.documento.length === 11 ? 'cpf' : 'cnpj') : null,
    telefone: d.telefone,
    origem: 'manual',
    ativo: true,
  });
  return deErro(error);
}

async function definirContrato(
  supabase: Client,
  d: Extract<Proposta, { tipo: 'definir_contrato' }>['dados'],
): Promise<Escrita> {
  const r = await supabase
    .from('obras')
    .update({ valor_contrato: d.valor })
    .eq('id', d.obra_id)
    .is('deleted_at', null)
    .select('id');
  if (r.error) return deErro(r.error);
  if ((r.data?.length ?? 0) === 0) return { ok: false, erro: 'obra não encontrada ou arquivada' };
  return { ok: true };
}

async function registrarRecebimento(
  supabase: Client,
  d: Extract<Proposta, { tipo: 'registrar_recebimento' }>['dados'],
  userId: string | null,
  mensagemId: string,
): Promise<Escrita> {
  // O autorizado que pediu fica registrado pela mensagem de origem.
  const { data: msg } = await supabase
    .from('mensagens_whats')
    .select('autorizado_id')
    .eq('id', mensagemId)
    .maybeSingle();
  const { error } = await supabase.from('recebimentos').insert({
    obra_id: d.obra_id,
    valor: d.valor,
    data_recebimento: d.data,
    descricao: d.descricao,
    origem: 'whatsapp',
    criado_por_user_id: userId,
    autorizado_id: msg?.autorizado_id ?? null,
  });
  return deErro(error);
}

async function arquivarObra(
  supabase: Client,
  d: Extract<Proposta, { tipo: 'arquivar_obra' }>['dados'],
): Promise<Escrita> {
  const r = await supabase
    .from('obras')
    .update({ status: 'arquivada', deleted_at: new Date().toISOString() })
    .eq('id', d.obra_id)
    .is('deleted_at', null)
    .select('id');
  if (r.error) return deErro(r.error);
  if ((r.data?.length ?? 0) === 0)
    return { ok: false, erro: 'obra não encontrada ou já arquivada' };
  return { ok: true };
}
