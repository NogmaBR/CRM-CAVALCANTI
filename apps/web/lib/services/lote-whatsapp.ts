import 'server-only';
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/log';
import {
  type UazapiInbound,
  UazapiInboundSchema,
  destinoDaResposta,
  normalizeTelefone,
} from '@/lib/schemas/uazapi';
import type { DocCategoria } from '@/lib/status-labels';
import { linkDoPainel } from '@/lib/whatsapp/links';
import { type ResumoDoLote, planejarLote, textoDoLote } from '@/lib/whatsapp/lote';
import type { Database } from '@nogma/db';
import type { Json } from '@nogma/db/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { lerOpcoes, lerTipoPendencia, resumoDaPendencia } from './confirmacoes';
import { guardarEscolha } from './escolha-pendencia';
import { type RespostaColetada, type ResultadoInbound, processarInbound } from './inbound-whatsapp';
import { responder } from './responder';

type Client = SupabaseClient<Database>;

const log = logger('lote');

/**
 * Janela de silêncio: quanto tempo esperar por mais mensagens do mesmo
 * remetente antes de responder. 8 s é a proposta (a validar com o
 * Cavalcanti); `WHATSAPP_JANELA_LOTE_MS=0` desliga o lote sem deploy.
 */
export function janelaDoLoteMs(): number {
  const n = Number(process.env.WHATSAPP_JANELA_LOTE_MS ?? 8000);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 30_000) : 8000;
}

/** Lote reivindicado e não processado depois disto: alguém morreu no meio. */
export const LOTE_PRESO_MIN = 3;

export interface DepsLote {
  dormir?: (ms: number) => Promise<void>;
  agora?: () => Date;
}

/**
 * Guarda a mensagem na sala de espera. O retry do provider bate no índice
 * único e sai como duplicada — antes mesmo de qualquer processamento.
 */
export async function receberNoLote(
  supabase: Client,
  payload: UazapiInbound,
  deps: DepsLote = {},
): Promise<'guardada' | 'duplicada' | 'erro'> {
  const { error } = await supabase.from('mensagens_em_espera').insert({
    msg_id_uazapi: payload.id,
    chat_id: destinoDaResposta(payload),
    telefone: normalizeTelefone(payload.from),
    payload: payload as unknown as Json,
    recebido_em: (deps.agora ?? (() => new Date()))().toISOString(),
  });
  if (!error) return 'guardada';
  if (error.code === '23505') return 'duplicada';
  log.erro('lote_insert_falhou', { erro: error.message });
  return 'erro';
}

/**
 * Espera a janela e, se esta ainda é a mensagem mais recente do (chat,
 * remetente), reivindica tudo que está sem lote — numa statement (`
 * reivindicar_lote`), então duas invocações nunca levam a mesma mensagem.
 * `null` quando chegou coisa mais nova: a invocação dela fecha o lote.
 */
export async function esperarEFecharLote(
  supabase: Client,
  payload: UazapiInbound,
  deps: DepsLote = {},
): Promise<{ loteId: string; mensagens: UazapiInbound[] } | null> {
  const dormir = deps.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const chatId = destinoDaResposta(payload);
  const telefone = normalizeTelefone(payload.from);

  await dormir(janelaDoLoteMs());

  const { data: ultima } = await supabase
    .from('mensagens_em_espera')
    .select('msg_id_uazapi')
    .eq('chat_id', chatId)
    .eq('telefone', telefone)
    .is('lote_id', null)
    .order('recebido_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultima || ultima.msg_id_uazapi !== payload.id) {
    log.info('lote_adiado', { telefone, motivo: ultima ? 'chegou_mais_nova' : 'ja_reivindicada' });
    return null;
  }

  const loteId = randomUUID();
  const { data, error } = await supabase.rpc('reivindicar_lote', {
    p_chat_id: chatId,
    p_telefone: telefone,
    p_lote_id: loteId,
  });
  if (error) {
    log.erro('reivindicar_lote_falhou', { erro: error.message });
    return null;
  }
  const linhas = (data ?? []) as Array<{ payload: unknown; recebido_em: string }>;
  if (linhas.length === 0) return null;

  const mensagens: UazapiInbound[] = [];
  for (const l of linhas) {
    const parsed = UazapiInboundSchema.safeParse(l.payload);
    if (parsed.success) mensagens.push(parsed.data);
    else log.aviso('lote_payload_invalido', { erro: parsed.error.issues[0]?.message });
  }
  return { loteId, mensagens };
}

/**
 * Processa o lote como UMA entrada e marca as mensagens como processadas.
 *
 *   - uma mensagem: o fluxo de sempre;
 *   - só textos: uma mensagem com os textos na ordem;
 *   - mídias: cada uma passa pelo fluxo em silêncio (com o lote na
 *     pendência), e no fim sai UMA resposta — "Li 3 comprovantes: 1) … 2) …",
 *     "Recebi 5 fotos. De qual obra?", "📁 Guardei 5 arquivos na obra X".
 */
export async function processarLote(
  supabase: Client,
  loteId: string,
  mensagens: UazapiInbound[],
): Promise<ResultadoInbound> {
  const plano = planejarLote(mensagens);
  let resultado: ResultadoInbound;

  if (plano.modo === 'unico') {
    resultado = await processarInbound(supabase, plano.payload);
  } else if (plano.modo === 'texto_unido') {
    log.info('lote_textos_unidos', { quantidade: plano.idsAgrupados.length + 1 });
    resultado = await processarInbound(supabase, plano.payload, { loteId });
  } else if (plano.payloads.length === 1) {
    const unico = plano.payloads[0] as UazapiInbound;
    resultado = await processarInbound(supabase, unico, { loteId });
  } else {
    resultado = await processarMidiasEmLote(supabase, loteId, plano.payloads);
  }

  await supabase
    .from('mensagens_em_espera')
    .update({ processado_em: new Date().toISOString() })
    .eq('lote_id', loteId);
  return resultado;
}

/** Até quantas mídias classificar ao mesmo tempo (o modelo tem limite de taxa). */
const PARALELO = 4;

async function processarMidiasEmLote(
  supabase: Client,
  loteId: string,
  payloads: UazapiInbound[],
): Promise<ResultadoInbound> {
  const coletor: RespostaColetada[] = [];
  const resultados: ResultadoInbound[] = [];
  for (let i = 0; i < payloads.length; i += PARALELO) {
    const fatia = payloads.slice(i, i + PARALELO);
    const r = await Promise.all(
      fatia.map((p, j) =>
        processarInbound(supabase, p, { loteId, indiceNoLote: i + j + 1, coletor }).catch(
          (err): ResultadoInbound => {
            log.erro('lote_item_falhou', { err });
            return { acao: 'erro', detalhe: 'item do lote falhou' };
          },
        ),
      ),
    );
    resultados.push(...r);
  }

  const destino = destinoDaResposta(payloads[0] as UazapiInbound);
  const resumo = await resumirLote(supabase, loteId);
  const totalItens =
    resumo.pagamentos.length +
    resumo.semObra.quantidade +
    resumo.guardados.reduce((a, g) => a + g.quantidade, 0) +
    resumo.anotados.reduce((a, g) => a + g.quantidade, 0) +
    resumo.comProblema;

  // Nada do lote virou pendência nem arquivo (tudo ignorado/duplicado): as
  // respostas recolhidas, se houver, saem como estão.
  if (totalItens === 0) {
    for (const r of coletor) await responder(supabase, r.destino, r.texto, r.rastro);
    return { acao: 'classificada', detalhe: `lote:${payloads.length}:vazio` };
  }

  // Um único comprovante e nada mais: a pergunta completa daquele item é
  // melhor que a lista de um item só.
  if (resumo.pagamentos.length === 1 && totalItens === 1) {
    const pergunta = coletor.find((r) => r.rastro.tipo === 'pergunta_pendencia');
    if (pergunta) {
      await responder(supabase, pergunta.destino, pergunta.texto, pergunta.rastro);
      return { acao: 'classificada', detalhe: `lote:${payloads.length}:1_pagamento` };
    }
  }

  const texto = textoDoLote(resumo);
  const { data: pendencias } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, indice_no_lote, tipo')
    .eq('lote_id', loteId)
    .eq('resolvida', false);
  const dePagamento = (pendencias ?? [])
    .filter((p) => lerTipoPendencia(p.tipo) === 'pagamento')
    .sort((a, b) => (a.indice_no_lote ?? 0) - (b.indice_no_lote ?? 0));

  // "sim" solto depois desta lista = todos; "2 não" = só o 2.
  if (dePagamento.length > 0) {
    await guardarEscolha(supabase, destino, {
      interpretacao: 'lote',
      itens: resumo.pagamentos.map((p, i) => ({
        n: p.n,
        confirmacaoId: dePagamento[i]?.id ?? '',
      })),
    });
  }

  await responder(supabase, destino, texto, {
    tipo: 'pergunta_pendencia',
    loteId,
    confirmacaoId: dePagamento.length === 1 ? dePagamento[0]?.id : null,
  });
  return {
    acao: 'classificada',
    detalhe: `lote:${payloads.length}:${resultados.map((r) => r.detalhe ?? r.acao).join(',')}`,
  };
}

/** O que o lote produziu, lido do banco (pendências e mensagens com o lote). */
export async function resumirLote(supabase: Client, loteId: string): Promise<ResumoDoLote> {
  const [pend, msgs] = await Promise.all([
    supabase
      .from('confirmacoes_pendentes')
      .select('id, mensagem_id, pergunta_enviada, tipo, opcoes, acao, indice_no_lote')
      .eq('lote_id', loteId)
      .eq('resolvida', false),
    supabase
      .from('mensagens_whats')
      .select('id, status, documento_id, registro_id')
      .eq('lote_id', loteId),
  ]);

  const resumo: ResumoDoLote = {
    pagamentos: [],
    semObra: { quantidade: 0, opcoes: [] },
    guardados: [],
    anotados: [],
    comProblema: 0,
  };

  const pendencias = [...(pend.data ?? [])].sort(
    (a, b) => (a.indice_no_lote ?? 0) - (b.indice_no_lote ?? 0),
  );
  let n = 0;
  for (const p of pendencias) {
    const tipo = lerTipoPendencia(p.tipo);
    if (tipo === 'pagamento') {
      const r = await resumoDaPendencia(supabase, {
        id: p.id,
        mensagemId: p.mensagem_id,
        perguntaEnviada: p.pergunta_enviada,
        tipo,
        opcoes: lerOpcoes(p.opcoes),
        acao: null,
      });
      n += 1;
      resumo.pagamentos.push({ n, ...r });
    } else {
      resumo.semObra.quantidade += 1;
      if (resumo.semObra.opcoes.length === 0) resumo.semObra.opcoes = lerOpcoes(p.opcoes);
    }
  }

  const docIds = (msgs.data ?? []).map((m) => m.documento_id).filter((x): x is string => !!x);
  const regIds = (msgs.data ?? []).map((m) => m.registro_id).filter((x): x is string => !!x);
  resumo.comProblema = (msgs.data ?? []).filter((m) => m.status === 'erro').length;

  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('documentos')
      .select('id, obra_id, categoria')
      .in('id', docIds);
    const grupos = new Map<string, { obraId: string; pasta: DocCategoria; quantidade: number }>();
    for (const d of docs ?? []) {
      if (!d.obra_id) continue;
      const chave = `${d.obra_id}|${d.categoria}`;
      const g = grupos.get(chave) ?? {
        obraId: d.obra_id,
        pasta: d.categoria as DocCategoria,
        quantidade: 0,
      };
      g.quantidade += 1;
      grupos.set(chave, g);
    }
    for (const g of grupos.values()) {
      const { data: obra } = await supabase
        .from('obras')
        .select('nome')
        .eq('id', g.obraId)
        .maybeSingle();
      resumo.guardados.push({
        obra: obra?.nome ?? 'obra',
        pasta: g.pasta,
        quantidade: g.quantidade,
        link: linkDoPainel(`/obras/${g.obraId}#pastas`),
      });
    }
  }
  if (regIds.length > 0) {
    const { data: regs } = await supabase
      .from('registros_obra')
      .select('id, obra_id')
      .in('id', regIds);
    const porObra = new Map<string, number>();
    for (const r of regs ?? []) porObra.set(r.obra_id, (porObra.get(r.obra_id) ?? 0) + 1);
    for (const [obraId, quantidade] of porObra) {
      const { data: obra } = await supabase
        .from('obras')
        .select('nome')
        .eq('id', obraId)
        .maybeSingle();
      resumo.anotados.push({ obra: obra?.nome ?? 'obra', quantidade });
    }
  }
  return resumo;
}

/**
 * Lote reivindicado há mais de alguns minutos e nunca processado (a função
 * morreu no meio): solta as mensagens para o próximo webhook do mesmo
 * remetente levar — ou o sweep as descarta depois de um dia.
 */
export async function recuperarLotesPresos(supabase: Client, agora = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - LOTE_PRESO_MIN * 60_000).toISOString();
  const { data, error } = await supabase
    .from('mensagens_em_espera')
    .update({ lote_id: null })
    .is('processado_em', null)
    .not('lote_id', 'is', null)
    .lt('recebido_em', limite)
    .select('id');
  if (error) {
    log.erro('recuperar_lotes_falhou', { erro: error.message });
    return 0;
  }
  return data?.length ?? 0;
}

/** Sala de espera não precisa de histórico: um dia basta para diagnosticar. */
export async function purgarEspera(supabase: Client, agora = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('mensagens_em_espera')
    .delete()
    .lt('recebido_em', limite)
    .select('id');
  if (error) {
    log.erro('purgar_espera_falhou', { erro: error.message });
    return 0;
  }
  return data?.length ?? 0;
}
