import 'server-only';
import { logger } from '@/lib/log';
import { CATEGORIA_LABELS, type DocCategoria } from '@/lib/status-labels';
import { variantesTelefoneBR } from '@/lib/whatsapp/telefone-br';
import { respostaDesfeito, respostaMovido, valorLegivel } from '@/lib/whatsapp/textos';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recusarConfirmacao } from './confirmacoes';
import type { AlvoDaMensagem } from './responder';

type Client = SupabaseClient<Database>;

const log = logger('desfazer');

/** Até quando "desfaz" sem citação ainda aponta para a última ação da pessoa. */
export const JANELA_DESFAZER_MIN = 30;

export type ResultadoDesfazer =
  | { ok: true; resposta: string; oQue: 'pagamento' | 'documento' | 'registro' | 'pendencia' }
  | { ok: false; codigo: 'sem_alvo' | 'ja_desfeito' | 'nao_encontrado' | 'erro'; motivo: string };

/**
 * A última coisa que o agente fez por causa de uma mensagem DESTA pessoa
 * neste chat, nos últimos minutos — o alvo de um "desfaz" sem citação.
 *
 * Só a própria pessoa desfaz o que foi dela sem citar: no grupo, "desfaz"
 * do Hugo não apaga a foto que o Társis mandou. Citando a mensagem, aí sim
 * (qualquer autorizado do grupo, como em qualquer outra resposta).
 */
export async function ultimaAcaoDoRemetente(
  supabase: Client,
  args: { chatId: string; telefone: string; agora?: Date },
): Promise<AlvoDaMensagem | null> {
  const agora = args.agora ?? new Date();
  const desde = new Date(agora.getTime() - JANELA_DESFAZER_MIN * 60_000).toISOString();
  const formas = variantesTelefoneBR(args.telefone);
  try {
    const { data } = await supabase
      .from('mensagens_enviadas')
      .select('id, tipo, em_resposta_a, confirmacao_id, pagamento_id, documento_id, registro_id')
      .eq('chat_id', args.chatId)
      .gte('created_at', desde)
      .in('tipo', ['lancado', 'arquivado', 'anotado'])
      .order('created_at', { ascending: false })
      .limit(10);
    for (const e of data ?? []) {
      if (!e.em_resposta_a) continue;
      const { data: m } = await supabase
        .from('mensagens_whats')
        .select('telefone_from')
        .eq('id', e.em_resposta_a)
        .maybeSingle();
      if (m && formas.includes(m.telefone_from)) {
        return {
          enviadaId: e.id,
          tipoDaEnviada: e.tipo as AlvoDaMensagem['tipoDaEnviada'],
          mensagemId: e.em_resposta_a,
          confirmacaoId: e.confirmacao_id,
          pagamentoId: e.pagamento_id,
          documentoId: e.documento_id,
          registroId: e.registro_id,
          loteId: null,
        };
      }
    }
    return null;
  } catch (err) {
    log.aviso('ultima_acao_falhou', { err });
    return null;
  }
}

/**
 * Desfaz o que o alvo aponta. Nada é apagado de verdade: pagamento, documento
 * e registro ganham `deleted_at` (o painel restaura; a auditoria guarda quem e
 * quando); pendência aberta é recusada. A resposta diz o que foi desfeito.
 */
export async function desfazerAlvo(
  supabase: Client,
  alvo: AlvoDaMensagem,
  ctx: { respostaBruta: string },
): Promise<ResultadoDesfazer> {
  const agora = new Date().toISOString();

  if (alvo.pagamentoId) {
    const { data: p } = await supabase
      .from('pagamentos')
      .select('id, valor, deleted_at, obras(nome)')
      .eq('id', alvo.pagamentoId)
      .maybeSingle();
    if (!p) return { ok: false, codigo: 'nao_encontrado', motivo: 'Pagamento não encontrado.' };
    if (p.deleted_at) return { ok: false, codigo: 'ja_desfeito', motivo: 'Já estava desfeito.' };
    const upd = await supabase
      .from('pagamentos')
      .update({ deleted_at: agora })
      .eq('id', p.id)
      .is('deleted_at', null)
      .select('id');
    if (upd.error || (upd.data?.length ?? 0) === 0) return erro(upd.error?.message);
    const obraNome = (p as unknown as { obras?: { nome?: string } | null }).obras?.nome ?? null;
    return {
      ok: true,
      oQue: 'pagamento',
      resposta: respostaDesfeito(
        `o pagamento de ${valorLegivel(Number(p.valor))}${obraNome ? ` na obra ${obraNome}` : ''}`,
        'Se quiser, mande de novo com o dado certo.',
      ),
    };
  }

  if (alvo.documentoId) {
    const { data: d } = await supabase
      .from('documentos')
      .select('id, deleted_at, categoria, obras(nome)')
      .eq('id', alvo.documentoId)
      .maybeSingle();
    if (!d) return { ok: false, codigo: 'nao_encontrado', motivo: 'Arquivo não encontrado.' };
    if (d.deleted_at) return { ok: false, codigo: 'ja_desfeito', motivo: 'Já estava desfeito.' };
    const upd = await supabase
      .from('documentos')
      .update({ deleted_at: agora })
      .eq('id', d.id)
      .is('deleted_at', null)
      .select('id');
    if (upd.error || (upd.data?.length ?? 0) === 0) return erro(upd.error?.message);
    const obraNome = (d as unknown as { obras?: { nome?: string } | null }).obras?.nome ?? null;
    return {
      ok: true,
      oQue: 'documento',
      resposta: respostaDesfeito(
        `o arquivo${obraNome ? ` que estava na obra ${obraNome}` : ''}`,
        'Quer guardar em outra obra? Responda em cima da foto dizendo qual.',
      ),
    };
  }

  if (alvo.registroId) {
    const { data: r } = await supabase
      .from('registros_obra')
      .select('id, deleted_at, obras(nome)')
      .eq('id', alvo.registroId)
      .maybeSingle();
    if (!r) return { ok: false, codigo: 'nao_encontrado', motivo: 'Anotação não encontrada.' };
    if (r.deleted_at) return { ok: false, codigo: 'ja_desfeito', motivo: 'Já estava desfeita.' };
    const upd = await supabase
      .from('registros_obra')
      .update({ deleted_at: agora })
      .eq('id', r.id)
      .is('deleted_at', null)
      .select('id');
    if (upd.error || (upd.data?.length ?? 0) === 0) return erro(upd.error?.message);
    const obraNome = (r as unknown as { obras?: { nome?: string } | null }).obras?.nome ?? null;
    return {
      ok: true,
      oQue: 'registro',
      resposta: respostaDesfeito(
        `a anotação${obraNome ? ` do diário da obra ${obraNome}` : ''}`,
        null,
      ),
    };
  }

  if (alvo.confirmacaoId) {
    const r = await recusarConfirmacao(supabase, {
      confirmacaoId: alvo.confirmacaoId,
      via: 'whatsapp',
      respostaBruta: ctx.respostaBruta,
      motivo: 'Remetente pediu para desfazer',
    });
    if (!r.ok) return erro(r.motivo);
    return { ok: true, oQue: 'pendencia', resposta: respostaDesfeito('o pedido', null) };
  }

  return { ok: false, codigo: 'sem_alvo', motivo: 'Nada para desfazer.' };
}

/**
 * "Essa foto é da INOX" em cima do "📁 Guardei na obra Garibaldi": move o
 * documento (ou a anotação) de obra. A pasta fica a mesma.
 */
export async function moverParaObra(
  supabase: Client,
  alvo: AlvoDaMensagem,
  obra: { id: string; nome: string },
): Promise<ResultadoDesfazer> {
  if (alvo.documentoId) {
    const { data: d } = await supabase
      .from('documentos')
      .select('id, categoria, obra_id')
      .eq('id', alvo.documentoId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!d) return { ok: false, codigo: 'nao_encontrado', motivo: 'Arquivo não encontrado.' };
    if (d.obra_id === obra.id) {
      return { ok: false, codigo: 'ja_desfeito', motivo: 'Já está nessa obra.' };
    }
    const upd = await supabase
      .from('documentos')
      .update({ obra_id: obra.id })
      .eq('id', d.id)
      .select('id');
    if (upd.error || (upd.data?.length ?? 0) === 0) return erro(upd.error?.message);
    const pasta = CATEGORIA_LABELS[d.categoria as DocCategoria]?.rotulo ?? 'Outros';
    return { ok: true, oQue: 'documento', resposta: respostaMovido(obra.nome, pasta) };
  }
  if (alvo.registroId) {
    const upd = await supabase
      .from('registros_obra')
      .update({ obra_id: obra.id })
      .eq('id', alvo.registroId)
      .is('deleted_at', null)
      .select('id');
    if (upd.error || (upd.data?.length ?? 0) === 0) return erro(upd.error?.message);
    return { ok: true, oQue: 'registro', resposta: respostaMovido(obra.nome, 'Diário') };
  }
  return { ok: false, codigo: 'sem_alvo', motivo: 'Nada para mover.' };
}

function erro(detalhe?: string): ResultadoDesfazer {
  log.erro('desfazer_falhou', { detalhe: detalhe ?? 'zero linhas' });
  return { ok: false, codigo: 'erro', motivo: 'Não consegui desfazer agora.' };
}
