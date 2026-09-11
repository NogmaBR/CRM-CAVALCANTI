import 'server-only';
import { transcreverAudio } from '@/lib/ia/transcricao';
import { logger } from '@/lib/log';
import {
  type UazapiInbound,
  mapTipoToDb,
  normalizeTelefone,
  toIsoDate,
} from '@/lib/schemas/uazapi';
import { uploadDocumentBuffer } from '@/lib/storage/documents';
import { interpretarComando } from '@/lib/whatsapp/comandos';
import { ehPerguntaAoAssistente } from '@/lib/whatsapp/pergunta';
import { interpretarResposta } from '@/lib/whatsapp/resposta';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyAndPersist } from './classify-and-persist';
import { executarComando } from './comandos-whatsapp';
import { aplicarConfirmacao, buscarConfirmacaoAberta, recusarConfirmacao } from './confirmacoes';
import { baixarMidia, enviarTexto } from './uazapi';

/**
 * Processamento de uma mensagem inbound do WhatsApp — o fluxo principal do
 * produto, ponta a ponta.
 *
 * Antes desta camada existir, a rota do webhook fazia upsert + classifica e
 * nada mais. Faltavam três coisas que o briefing trata como o núcleo do que
 * foi contratado (`docs/VERIFICACAO-BRIEFING-16-09.md` §4):
 *
 *   1. **A resposta "SIM" não fechava nada.** Voltava como mensagem nova e era
 *      reclassificada do zero, então a única forma de resolver uma pendência
 *      continuava sendo o gestor clicar no painel — exatamente o trabalho
 *      manual que o produto promete eliminar.
 *   2. **Ninguém checava `autorizados`.** Qualquer número que alcançasse o
 *      webhook virava lançamento no financeiro do cliente (achado A da
 *      auditoria, classificado como bloqueador).
 *   3. **A mídia era perdida.** A URL do provider expira em minutos e nada
 *      baixava o arquivo — a foto da nota fiscal sumia.
 *
 * A ordem das etapas abaixo é deliberada e está comentada caso a caso.
 */

type Client = SupabaseClient<Database>;

const log = logger('inbound');

export type AcaoInbound =
  | 'ignorada_nao_autorizada'
  | 'duplicada'
  | 'confirmou_pendencia'
  | 'recusou_pendencia'
  | 'classificada'
  | 'comando'
  | 'pergunta'
  | 'erro';

export interface ResultadoInbound {
  acao: AcaoInbound;
  mensagemId?: string;
  pagamentoId?: string;
  detalhe?: string;
}

/**
 * Janela em que uma resposta curta ainda é lida como resposta à pergunta.
 * Passado o prazo, "ok" volta a ser mensagem comum e a pendência antiga fica
 * pro gestor — senão um "ok" solto na quinta resolveria a pendência de terça.
 */
const JANELA_RESPOSTA_HORAS = 24;

/** Respostas automáticas. Texto curto de propósito: WhatsApp de obra. */
const RESPOSTAS = {
  confirmado: 'Lançado ✅ Obrigado!',
  confirmadoSemPagamento:
    'Recebi sua confirmação, mas faltaram dados pra lançar automaticamente. ' +
    'O gestor vai revisar no painel.',
  recusado: 'Ok, cancelei esse lançamento. Se quiser, é só mandar de novo com os dados corretos.',
} as const;

export async function processarInbound(
  supabase: Client,
  payload: UazapiInbound,
): Promise<ResultadoInbound> {
  const telefone = normalizeTelefone(payload.from);

  // ---------------------------------------------------------------------
  // 1. Autorização. Antes de qualquer escrita.
  // ---------------------------------------------------------------------
  // Falha fechada: número desconhecido não vira registro nem resposta. Não
  // respondemos nada de volta de propósito — responder confirmaria pra quem
  // sondou que existe um sistema atrás do número.
  const autorizado = await buscarAutorizado(supabase, telefone);
  if (!autorizado) {
    log.aviso('ignorada_nao_autorizada', {
      telefone,
      dica: 'Cadastre o número em /config/autorizados para que ele possa lançar pagamentos.',
    });
    return { acao: 'ignorada_nao_autorizada' };
  }

  // ---------------------------------------------------------------------
  // 2. Idempotência.
  // ---------------------------------------------------------------------
  // O UAZAPI reenvia o mesmo evento quando não recebe 200 rápido o bastante.
  // Sem esta checagem cada retry reclassificava a mensagem e abria uma
  // pendência nova — o gestor via a mesma nota fiscal três vezes na fila.
  const { data: existente } = await supabase
    .from('mensagens_whats')
    .select('id')
    .eq('msg_id_uazapi', payload.id)
    .maybeSingle();

  if (existente) {
    return { acao: 'duplicada', mensagemId: existente.id };
  }

  // ---------------------------------------------------------------------
  // 3. Áudio vira texto antes de qualquer decisão.
  // ---------------------------------------------------------------------
  // No canteiro se fala, não se digita. Sem transcrição o áudio chegava ao
  // classificador como `texto: null` e caía direto em `nao_identificado`.
  // Também é o que permite confirmar por áudio ("isso, pode lançar").
  const tipoDb = mapTipoToDb(payload.type);
  const midia = await materializarMidia(payload, tipoDb);
  const textoEfetivo = payload.text?.trim() || midia.transcricao || null;

  // ---------------------------------------------------------------------
  // 4. Isto é resposta a uma pergunta em aberto?
  // ---------------------------------------------------------------------
  // Precisa vir ANTES da classificação: "sim" classificado do zero não
  // significa nada, e é justamente o elo que faltava no fluxo.
  const interpretacao = interpretarResposta(textoEfetivo);

  if (interpretacao !== 'outro') {
    const pendencia = await buscarConfirmacaoAberta(supabase, telefone, JANELA_RESPOSTA_HORAS);

    if (pendencia) {
      return resolverPendencia({
        supabase,
        pendencia,
        interpretacao,
        payload,
        telefone,
        autorizadoId: autorizado.id,
        textoEfetivo,
        midia,
        tipoDb,
      });
    }
    // Sem pendência aberta, "ok" é só uma mensagem qualquer — segue o fluxo
    // normal e provavelmente vira `nao_identificado`, que é o correto.
  }

  // ---------------------------------------------------------------------
  // 5. É um comando de consulta?
  // ---------------------------------------------------------------------
  // Depois da resposta a pendência (um "sim" em aberto vence tudo) e antes da
  // classificação: "pendências" é pergunta, não lançamento, e não pode virar
  // pagamento nem abrir confirmação. Consultas não são persistidas como
  // mensagem — encheriam a fila do gestor com coisa que já foi respondida.
  const comando = interpretarComando(textoEfetivo);
  if (comando) {
    const resposta = await executarComando(supabase, comando).catch((err) => {
      log.erro('comando_falhou', { comando: comando.tipo, err });
      return 'Não consegui consultar isso agora. Tente de novo em instantes.';
    });
    await enviarTexto(telefone, resposta);
    return { acao: 'comando', detalhe: comando.tipo };
  }

  // ---------------------------------------------------------------------
  // 5b. É uma pergunta livre sobre os dados?
  // ---------------------------------------------------------------------
  // Depois dos comandos fixos (que são exatos e baratos) e antes da
  // classificação (que trata a mensagem como lançamento).
  //
  // A ordem é obrigatória: uma pergunta que chegasse à classificação viraria
  // `nao_identificado` e uma pendência boba no painel. E o reconhecimento é
  // estreito de propósito — `ehPerguntaAoAssistente` recusa qualquer coisa que
  // cheire a lançamento, porque o erro contrário perde um pagamento.
  //
  // Só age com o modelo configurado. Embeddings são opcionais desde a versão
  // com ferramentas: sem eles a busca devolve zero trechos e os agregados
  // (totais, períodos, pendências) saem das ferramentas mesmo assim. Sem
  // chave da Anthropic, a mensagem segue o caminho de sempre — este bloco é
  // invisível.
  if (ehPerguntaAoAssistente(textoEfetivo)) {
    const { assistenteDisponivel, perguntar } = await import('@/lib/ia/assistente');

    if (assistenteDisponivel()) {
      const resposta = await perguntar(supabase, {
        pergunta: textoEfetivo ?? '',
        canal: 'whatsapp',
        autorizadoId: autorizado.id,
      }).catch((err) => {
        log.erro('assistente_falhou', { err });
        return null;
      });

      // Só responde se o assistente respondeu. Falhou? Cai para a
      // classificação — melhor a pergunta virar pendência no painel do que
      // a pessoa receber silêncio.
      if (resposta) {
        await enviarTexto(telefone, resposta.texto);
        return {
          acao: 'pergunta',
          detalhe: `${resposta.fontes.length} fonte(s), ${resposta.ferramentas.length} ferramenta(s)`,
        };
      }
    }
  }

  // ---------------------------------------------------------------------
  // 6. Mensagem nova: grava e classifica.
  // ---------------------------------------------------------------------
  const mensagemId = await gravarMensagem({
    supabase,
    payload,
    telefone,
    autorizadoId: autorizado.id,
    tipoDb,
    midia,
    status: 'recebida',
  });

  if (!mensagemId) {
    return { acao: 'erro', detalhe: 'falha ao gravar mensagem' };
  }

  const classificacao = await classifyAndPersist(mensagemId).catch((err) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  // ---------------------------------------------------------------------
  // 7. Se abriu pendência, faz a pergunta no WhatsApp.
  // ---------------------------------------------------------------------
  // Sem este envio o cliente nunca fica sabendo que precisa confirmar, e o
  // fluxo automático morre na primeira etapa.
  if ('ok' in classificacao && classificacao.ok && classificacao.confirmacao) {
    const envio = await enviarTexto(telefone, classificacao.confirmacao.pergunta);
    if (envio.ok && envio.msgId) {
      await supabase
        .from('confirmacoes_pendentes')
        .update({ msg_id_pergunta_uazapi: envio.msgId })
        .eq('id', classificacao.confirmacao.id);
    }
  }

  return { acao: 'classificada', mensagemId };
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

interface Pendencia {
  id: string;
  mensagemId: string;
  perguntaEnviada: string;
}

interface ContextoResolucao {
  supabase: Client;
  pendencia: Pendencia;
  interpretacao: 'sim' | 'nao';
  payload: UazapiInbound;
  telefone: string;
  autorizadoId: string;
  textoEfetivo: string | null;
  midia: MidiaMaterializada;
  tipoDb: Database['public']['Enums']['msg_tipo'];
}

/**
 * Aplica a resposta do cliente à pendência aberta e avisa o resultado.
 *
 * A mensagem de resposta também é gravada, com status já resolvido: ela é a
 * prova, no audit trail, de que o lançamento saiu de um "sim" do próprio
 * cliente e não de um clique do gestor.
 */
async function resolverPendencia(ctx: ContextoResolucao): Promise<ResultadoInbound> {
  const { supabase, pendencia, interpretacao, telefone, textoEfetivo } = ctx;
  const respostaBruta = textoEfetivo ?? '(sem texto)';

  if (interpretacao === 'sim') {
    const resultado = await aplicarConfirmacao(supabase, {
      confirmacaoId: pendencia.id,
      via: 'whatsapp',
      respostaBruta,
      userId: null, // não há sessão: quem autorizou foi o próprio remetente
    });

    await gravarMensagem({
      ...ctx,
      status: resultado.ok ? 'confirmada' : 'recebida',
      autorizadoId: ctx.autorizadoId,
      pagamentoId: resultado.ok ? resultado.pagamentoId : null,
    });

    if (!resultado.ok) {
      // O caso real aqui é `dados_incompletos`: o cliente confirmou, mas a
      // extração não tinha valor ou obra. Avisamos em vez de silenciar —
      // senão ele acha que lançou e não lançou.
      log.aviso('confirmacao_sem_pagamento', { codigo: resultado.codigo });
      await enviarTexto(telefone, RESPOSTAS.confirmadoSemPagamento);
      return { acao: 'confirmou_pendencia', detalhe: resultado.codigo };
    }

    await enviarTexto(telefone, RESPOSTAS.confirmado);
    return { acao: 'confirmou_pendencia', pagamentoId: resultado.pagamentoId };
  }

  await recusarConfirmacao(supabase, {
    confirmacaoId: pendencia.id,
    via: 'whatsapp',
    respostaBruta,
    motivo: 'Recusada pelo remetente no WhatsApp',
  });

  await gravarMensagem({ ...ctx, status: 'recusada', autorizadoId: ctx.autorizadoId });

  await enviarTexto(telefone, RESPOSTAS.recusado);
  return { acao: 'recusou_pendencia' };
}

interface ArgsGravar {
  supabase: Client;
  payload: UazapiInbound;
  telefone: string;
  autorizadoId: string;
  tipoDb: Database['public']['Enums']['msg_tipo'];
  midia: MidiaMaterializada;
  status: Database['public']['Enums']['msg_status'];
  pagamentoId?: string | null;
}

async function gravarMensagem(args: ArgsGravar): Promise<string | null> {
  const { supabase, payload, telefone, autorizadoId, tipoDb, midia, status } = args;

  const { data, error } = await supabase
    .from('mensagens_whats')
    .insert({
      msg_id_uazapi: payload.id,
      telefone_from: telefone,
      autorizado_id: autorizadoId,
      tipo: tipoDb,
      texto_bruto: payload.text ?? null,
      texto_transcrito: midia.transcricao,
      midia_mime: payload.media?.mimetype ?? midia.mime ?? null,
      midia_storage_path: midia.storagePath,
      recebida_em: toIsoDate(payload.timestamp),
      status,
      pagamento_id: args.pagamentoId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    // 23505 = outro retry do provider venceu a corrida entre a checagem de
    // duplicidade e este insert. O trabalho dele vale; não é erro nosso.
    if (error?.code === '23505') {
      const { data: vencedor } = await supabase
        .from('mensagens_whats')
        .select('id')
        .eq('msg_id_uazapi', payload.id)
        .maybeSingle();
      return vencedor?.id ?? null;
    }
    log.erro('gravar_mensagem_falhou', { erro: error });
    return null;
  }

  return data.id;
}

interface MidiaMaterializada {
  storagePath: string | null;
  mime: string | null;
  transcricao: string | null;
}

/**
 * Baixa a mídia enquanto a URL do provider ainda vale, guarda no Storage e —
 * se for áudio — transcreve.
 *
 * Nada aqui é fatal: falha de download ou de transcrição degrada a mensagem
 * (vira pendência pro gestor abrir), não derruba o webhook. Um throw aqui
 * faria o UAZAPI retentar em loop por causa de um anexo.
 */
async function materializarMidia(
  payload: UazapiInbound,
  tipoDb: Database['public']['Enums']['msg_tipo'],
): Promise<MidiaMaterializada> {
  const url = payload.media?.url;
  if (!url) return { storagePath: null, mime: null, transcricao: null };

  const download = await baixarMidia(url);
  if (!download.ok) {
    log.erro('midia_nao_baixada', { motivo: download.motivo, detalhe: download.detalhe });
    return { storagePath: null, mime: payload.media?.mimetype ?? null, transcricao: null };
  }

  const mime = payload.media?.mimetype ?? download.mime;

  let transcricao: string | null = null;
  if (tipoDb === 'audio') {
    const resultado = await transcreverAudio(download.bytes, mime);
    if (resultado.ok) {
      transcricao = resultado.texto;
    } else if (resultado.motivo !== 'desativado') {
      log.aviso('transcricao_falhou', { motivo: resultado.motivo, detalhe: resultado.detalhe });
    }
  }

  // Prefixo `whatsapp/` é o que a policy de storage espera pra mídia que
  // ainda não virou `documentos` (migration 20260909140000).
  const nome = nomeArquivo(payload, mime);
  const path = `whatsapp/${payload.id.replace(/[^\w.-]/gu, '_')}/${nome}`;

  try {
    const buffer = download.bytes.buffer.slice(
      download.bytes.byteOffset,
      download.bytes.byteOffset + download.bytes.byteLength,
    ) as ArrayBuffer;
    await uploadDocumentBuffer(path, buffer, mime);
    return { storagePath: path, mime, transcricao };
  } catch (err) {
    log.erro('upload_midia_falhou', { err });
    return { storagePath: null, mime, transcricao };
  }
}

function nomeArquivo(payload: UazapiInbound, mime: string): string {
  const declarado = payload.media?.filename?.trim();
  if (declarado) return declarado.replace(/[^\w.\-]/gu, '_').slice(0, 200);

  const ext = mime.split(';')[0]?.split('/')[1]?.replace(/[^\w]/gu, '') || 'bin';
  return `midia.${ext}`;
}

/**
 * Resolve o remetente na lista de autorizados.
 *
 * A comparação é feita sobre os dígitos dos dois lados: o cadastro costuma ser
 * digitado à mão ("(51) 99999-8888") e o provider manda "5551999998888".
 * Comparar os textos crus reprovaria todo mundo.
 */
async function buscarAutorizado(
  supabase: Client,
  telefone: string,
): Promise<{ id: string; nome: string } | null> {
  const { data, error } = await supabase
    .from('autorizados')
    .select('id, nome, telefone_whats')
    .eq('ativo', true)
    .is('deleted_at', null);

  if (error) {
    log.erro('consultar_autorizados_falhou', { erro: error.message });
    return null;
  }

  if (!data || data.length === 0) {
    log.aviso('autorizados_vazio', {
      dica: 'Nenhum número ativo em autorizados: toda mensagem será ignorada. Cadastre a equipe em /config/autorizados.',
    });
    return null;
  }

  const encontrado = data.find((a) => normalizeTelefone(a.telefone_whats) === telefone);
  return encontrado ? { id: encontrado.id, nome: encontrado.nome } : null;
}
