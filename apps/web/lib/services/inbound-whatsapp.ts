import 'server-only';
import { extrairCorrecao } from '@/lib/ia/correcao';
import { normalizarNome } from '@/lib/ia/resolver-nomes';
import { transcreverAudio } from '@/lib/ia/transcricao';
import { logger } from '@/lib/log';
import {
  type UazapiInbound,
  destinoDaResposta,
  ehChatDeGrupo,
  mapTipoToDb,
  normalizeTelefone,
  toIsoDate,
} from '@/lib/schemas/uazapi';
import { uploadDocumentBuffer } from '@/lib/storage/documents';
import { hojeBR } from '@/lib/util/datas';
import { interpretarComando } from '@/lib/whatsapp/comandos';
import {
  acharNomeado,
  alcanceDaResposta,
  pareceCorrecao,
  pareceDesfazer,
  semAlcance,
} from '@/lib/whatsapp/correcao';
import { interpretarEscolha } from '@/lib/whatsapp/escolha';
import { linkDoPainel } from '@/lib/whatsapp/links';
import { nomeArquivoDaMidia } from '@/lib/whatsapp/nome-arquivo';
import { type Interpretacao, interpretarResposta } from '@/lib/whatsapp/resposta';
import { decidirDestino } from '@/lib/whatsapp/roteador';
import { variantesTelefoneBR } from '@/lib/whatsapp/telefone-br';
import {
  RESPOSTAS,
  perguntaQualPendencia,
  respostaAnexado,
  respostaPagamentoLancado,
} from '@/lib/whatsapp/textos';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { abrirPendenciaDeAcao, aplicarAcao } from './acoes-whatsapp';
import { anexarMidiaComoDocumento } from './anexar-midia';
import { classifyAndPersist } from './classify-and-persist';
import { executarComando } from './comandos-whatsapp';
import {
  type PendenciaAberta,
  aplicarConfirmacao,
  aplicarEscolhaDeObra,
  buscarConfirmacaoPorId,
  definirObraDaPendencia,
  pendenciasAbertas,
  recusarConfirmacao,
  resumoDaPendencia,
} from './confirmacoes';
import { corrigirPendencia } from './corrigir-pendencia';
import { desfazerAlvo, moverParaObra, ultimaAcaoDoRemetente } from './desfazer';
import {
  guardarEscolha,
  lerEscolha,
  limparEscolha,
  zerarObraDaConversa,
} from './escolha-pendencia';
import { type AlvoDaMensagem, resolverAlvo, responder } from './responder';
import { baixarMidia, obterLinkDaMidia } from './uazapi';

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
  | 'ignorada_grupo_nao_autorizado'
  | 'ignorada_privado'
  | 'ignorada_figurinha'
  | 'ignorada_reacao'
  | 'ignorada_sem_pendencia'
  | 'duplicada'
  | 'confirmou_pendencia'
  | 'recusou_pendencia'
  | 'escolheu_obra'
  | 'classificada'
  | 'corrigiu_pendencia'
  | 'perguntou_qual'
  | 'desfez'
  | 'moveu'
  | 'anexou'
  | 'comando'
  | 'pergunta'
  | 'acao_proposta'
  | 'executou_acao'
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

// As respostas fixas vivem em `lib/whatsapp/textos.ts`, com teste de legibilidade.

export async function processarInbound(
  supabase: Client,
  payload: UazapiInbound,
): Promise<ResultadoInbound> {
  // Num grupo, `from` é quem falou (o participante) e `chatId` é o grupo. A
  // autorização é pela pessoa; a resposta vai para o chat de origem.
  const telefone = normalizeTelefone(payload.from);
  const destino = destinoDaResposta(payload);
  const emGrupo = Boolean(payload.isGroup || ehChatDeGrupo(payload.chatId));

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

  // Só grupo cadastrado (decisão do usuário, 2026-09-17). A instância é o
  // número pessoal de alguém: conversa no privado — inclusive a do dono do
  // número com terceiros — NÃO é do CRM. Antes de existir esta trava, uma
  // figurinha mandada a um amigo virou "documento de obra" e o assistente
  // respondeu no privado. Nada é gravado nem respondido; só o rastro em
  // `webhook_eventos` (sem conteúdo). `WHATSAPP_ACEITA_PRIVADO=true` reabre.
  if (!emGrupo && process.env.WHATSAPP_ACEITA_PRIVADO !== 'true') {
    log.aviso('ignorada_privado', {
      telefone,
      dica: 'Só mensagens em grupo cadastrado entram no CRM. Cadastre um grupo em /config/autorizados › Grupos.',
    });
    return { acao: 'ignorada_privado' };
  }

  // Grupo também é lista fechada: pessoa autorizada num grupo desconhecido é
  // ignorada em silêncio. O id vai para o log — é assim que o gestor descobre
  // o que cadastrar em /config/autorizados (seção Grupos).
  const grupo = emGrupo ? await buscarGrupo(supabase, payload.chatId ?? '') : null;
  if (emGrupo && !grupo) {
    log.aviso('ignorada_grupo_nao_autorizado', {
      chat_id: payload.chatId,
      telefone,
      dica: 'Cadastre o grupo em /config/autorizados › Grupos para o agente agir nele.',
    });
    return { acao: 'ignorada_grupo_nao_autorizado' };
  }

  // ---------------------------------------------------------------------
  // 1b. Figurinha, reação e citação.
  // ---------------------------------------------------------------------
  // Figurinha não é documento nem resposta: sai em silêncio. Na rodada de
  // 17/09 uma virou "Recebi o arquivo. De qual obra ele é?".
  if (payload.type === 'sticker') {
    log.info('ignorada_figurinha', { telefone });
    return { acao: 'ignorada_figurinha' };
  }

  // Reação (👍 na pergunta) e citação ("sim" em cima da pergunta) apontam
  // para uma mensagem pelo id do provider. `resolverAlvo` diz o que ela é no
  // CRM — uma pergunta de pendência, um "📁 Guardei…", a foto que a própria
  // pessoa mandou — e o resto do fluxo age sobre ESSE alvo, não sobre "a
  // pendência mais recente". Reação a algo que não é nosso: silêncio.
  const alvo: AlvoDaMensagem | null = await resolverAlvo(
    supabase,
    payload.type === 'reaction' ? payload.reactionTo : payload.quotedId,
  );
  if (payload.type === 'reaction') {
    const emoji = interpretarResposta(payload.text);
    if (!alvo?.confirmacaoId || emoji === 'outro') {
      log.info('ignorada_reacao', { telefone, alvo: alvo?.tipoDaEnviada ?? null });
      return { acao: 'ignorada_reacao' };
    }
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
  const tipoDb = mapTipoToDb(payload.type, payload.media?.mimetype);
  const midia = await materializarMidia(payload, tipoDb, autorizado.nome);
  const textoEfetivo = payload.text?.trim() || midia.transcricao || null;

  // ---------------------------------------------------------------------
  // 4. Isto é resposta a uma pergunta em aberto? Correção? Desfazer?
  // ---------------------------------------------------------------------
  // Precisa vir ANTES da classificação: "sim" classificado do zero não
  // significa nada, e é justamente o elo que faltava no fluxo. "sim todos"
  // vale para todas as perguntas abertas.
  const alcance = alcanceDaResposta(textoEfetivo);
  const interpretacao: Interpretacao =
    alcance === 'todos'
      ? interpretarResposta(semAlcance(textoEfetivo ?? ''))
      : interpretarResposta(textoEfetivo);
  // No grupo a pendência é da CONVERSA (qualquer autorizado responde); no
  // privado, do telefone.
  const chatDaPendencia = emGrupo ? (payload.chatId ?? null) : null;
  const ctxMsg: ContextoDaMensagem = {
    supabase,
    payload,
    telefone,
    destino,
    grupoId: grupo?.id ?? null,
    autorizado,
    midia,
    tipoDb,
    textoEfetivo,
  };

  // 4a. Nota mandada EM CIMA do "✅ Lançado": anexa ao pagamento, sem
  // classificar de novo. É o caminho do "lançou por texto, a nota vem depois".
  if (midia.storagePath && alvo?.pagamentoId) {
    return anexarAoPagamentoCitado(ctxMsg, alvo.pagamentoId);
  }

  // 4b. "Desfaz", "cancela isso": o alvo é o que foi citado; sem citação, a
  // última coisa que o agente fez por causa DESTA pessoa neste chat (30 min);
  // sem isso, a pergunta aberta mais recente.
  if (textoEfetivo && !midia.storagePath && pareceDesfazer(textoEfetivo)) {
    return desfazer(ctxMsg, alvo, chatDaPendencia);
  }

  // 4c. Correção em cima de um "📁 Guardei…" / "📝 Anotei…": move de obra.
  if (
    textoEfetivo &&
    !midia.storagePath &&
    alvo &&
    !alvo.confirmacaoId &&
    (alvo.documentoId || alvo.registroId)
  ) {
    const r = await moverCitado(ctxMsg, alvo);
    if (r) return r;
  }

  // 4d. "Qual delas?" perguntado há pouco: o número (ou TODOS) escolhe.
  if (chatDaPendencia && textoEfetivo && !alvo && !midia.storagePath) {
    const escolha = await lerEscolha(supabase, chatDaPendencia);
    if (escolha) {
      const opcoes = escolha.itens.map((i) => ({ n: i.n, id: i.confirmacaoId, nome: String(i.n) }));
      const escolhida = alcance === 'todos' ? null : interpretarEscolha(textoEfetivo, opcoes);
      const alvos = alcance === 'todos' ? opcoes : escolhida ? [escolhida] : [];
      if (alvos.length > 0) {
        await limparEscolha(supabase, chatDaPendencia);
        let ultimo: ResultadoInbound = { acao: 'ignorada_sem_pendencia' };
        for (const o of alvos) {
          const p = await buscarConfirmacaoPorId(supabase, o.id);
          if (!p) continue;
          ultimo = (await responderPendencia(ctxMsg, p, escolha.interpretacao)) ?? ultimo;
        }
        return { ...ultimo, detalhe: `escolha:${alvos.length}` };
      }
    }
  }

  // 4e. Que pendência esta mensagem responde? Citação/reação vence; senão a
  // mais recente da conversa. Com duas ou mais esperando SIM/NÃO e a resposta
  // solta, pergunta qual — foi assim que um "sim" lançou o pagamento errado
  // em 17/09. Só vale a pena buscar quando há texto: foto sem legenda nunca
  // é resposta.
  const abertas = textoEfetivo
    ? await pendenciasAbertas(
        supabase,
        { telefone, chatId: chatDaPendencia },
        JANELA_RESPOSTA_HORAS,
      )
    : [];
  let pendencia: PendenciaAberta | null = alvo?.confirmacaoId
    ? await buscarConfirmacaoPorId(supabase, alvo.confirmacaoId)
    : null;
  const esperamSimNao = abertas.filter(
    (p) => p.tipo === 'acao' || (p.tipo === 'pagamento' && p.opcoes.length === 0),
  );
  if (!pendencia && interpretacao !== 'outro' && textoEfetivo) {
    if (alcance === 'todos' && esperamSimNao.length > 0) {
      let ultimo: ResultadoInbound = { acao: 'ignorada_sem_pendencia' };
      for (const p of esperamSimNao) {
        ultimo = (await responderPendencia(ctxMsg, p, interpretacao)) ?? ultimo;
      }
      return { ...ultimo, detalhe: `todos:${esperamSimNao.length}` };
    }
    if (esperamSimNao.length >= 2 && chatDaPendencia) {
      return perguntarQual(ctxMsg, chatDaPendencia, esperamSimNao, interpretacao);
    }
    pendencia = esperamSimNao[0] ?? abertas[0] ?? null;
  }
  if (!pendencia && interpretacao === 'outro' && textoEfetivo) {
    // Um número ou nome de obra responde a pergunta mais recente que tem
    // opções — não necessariamente a última pergunta de todas.
    pendencia =
      abertas.find((p) => p.opcoes.length > 0 && interpretarEscolha(textoEfetivo, p.opcoes)) ??
      abertas[0] ??
      null;
  }

  // "sim", "ok", 👍 sem pergunta nenhuma em aberto: não é para ninguém.
  // Antes caía no classificador e voltava "Não entendi o que fazer com essa
  // mensagem" — para um joinha. Silêncio, só rastro.
  if (!pendencia && interpretacao !== 'outro' && !midia.storagePath) {
    log.info('resposta_sem_pendencia', { telefone, interpretacao });
    return { acao: 'ignorada_sem_pendencia' };
  }

  if (pendencia) {
    const resolvido = await responderPendencia(ctxMsg, pendencia, interpretacao);
    if (resolvido) return resolvido;

    // 4f. Não era sim/não/número: é correção? "não é na Garibaldi, é na
    // INOX", "o valor é 500". Ajusta a pendência e pergunta de novo — nunca
    // grava. Pendência de obra (opções): a obra citada escolhe.
    if (textoEfetivo && !midia.storagePath && pareceCorrecao(textoEfetivo)) {
      return corrigir(ctxMsg, pendencia, chatDaPendencia);
    }
    // Não era escolha, recusa nem correção: segue como mensagem comum. A
    // pergunta continua aberta pelas 24 h.
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
    // Comando não vira `mensagens_whats`, então a dedupe do passo 2 não o vê.
    // Sem isto, um retry do provider respondia o resumo duas vezes.
    if (await jaRespondida(supabase, payload.id, `comando:${comando.tipo}`)) {
      return { acao: 'duplicada' };
    }
    const resposta = await executarComando(supabase, comando).catch((err) => {
      log.erro('comando_falhou', { comando: comando.tipo, err });
      return 'Não consegui consultar isso agora. Tente de novo em instantes.';
    });
    await responder(supabase, destino, resposta, { tipo: 'resposta' });
    return { acao: 'comando', detalhe: comando.tipo };
  }

  // ---------------------------------------------------------------------
  // 5b. É para o assistente (pergunta, ação ou conversa)?
  // ---------------------------------------------------------------------
  // Depois dos comandos fixos (exatos e baratos) e antes da classificação
  // (que trata a mensagem como lançamento). O roteador decide em três
  // camadas — código puro, padrão de ação, modelo — e tudo que cheira a
  // lançamento vai ao classificador SEM consultar o modelo: perder um
  // pagamento custa dinheiro; uma pergunta virando pendência custa um clique.
  //
  // Sem chave de modelo, o assistente não age e a mensagem segue o caminho
  // de sempre — este bloco é invisível.
  const { assistenteDisponivel, perguntar } = await import('@/lib/ia/assistente');
  if (assistenteDisponivel()) {
    const { classificarIntencao, intencaoDisponivel } = await import('@/lib/ia/intencao');
    const decisao = await decidirDestino(
      { texto: textoEfetivo, temMidia: Boolean(midia.storagePath) },
      intencaoDisponivel() ? { classificarIntencao: (t) => classificarIntencao(t) } : {},
    );
    log.info('roteador', {
      destino: decisao.destino,
      motivo: decisao.motivo,
      intencao: decisao.intencao,
    });

    if (decisao.destino === 'saudacao') {
      if (await jaRespondida(supabase, payload.id, 'saudacao')) return { acao: 'duplicada' };
      await responder(supabase, destino, RESPOSTAS.saudacao, { tipo: 'resposta' });
      return { acao: 'comando', detalhe: 'saudacao' };
    }

    if (decisao.destino === 'assistente') {
      // Mesma dedupe dos comandos: 4 rodadas de modelo é onde o provider
      // mais dá timeout e reenvia — e a segunda resposta seria diferente.
      if (await jaRespondida(supabase, payload.id, 'pergunta')) {
        return { acao: 'duplicada' };
      }
      const resposta = await perguntar(supabase, {
        pergunta: textoEfetivo ?? '',
        canal: 'whatsapp',
        autorizadoId: autorizado.id,
        chatId: payload.chatId ?? null,
        telefone,
      }).catch((err) => {
        log.erro('assistente_falhou', { err });
        return null;
      });

      // Falhou? Cai para a classificação — melhor a pergunta virar pendência
      // no painel do que a pessoa receber silêncio.
      if (resposta?.proposta) {
        // Ação proposta: a mensagem vira registro (para a pendência ter
        // origem e para o retry não repetir), a pendência guarda a proposta e
        // a pergunta é template — o texto do modelo é só a introdução.
        const gravada = await gravarMensagem({
          supabase,
          payload,
          telefone,
          grupoId: grupo?.id ?? null,
          autorizadoId: autorizado.id,
          midia,
          tipoDb,
          status: 'recebida',
        });
        if (gravada.duplicada) return { acao: 'duplicada', mensagemId: gravada.id ?? undefined };
        if (!gravada.id) {
          await responder(supabase, destino, RESPOSTAS.falhaTemporaria, { tipo: 'aviso' });
          return { acao: 'erro', detalhe: 'mensagem_nao_gravada' };
        }
        const aberta = await abrirPendenciaDeAcao(supabase, {
          mensagemId: gravada.id,
          proposta: resposta.proposta,
          chatId: payload.chatId ?? null,
        });
        if (!aberta.ok) {
          await responder(supabase, destino, RESPOSTAS.falhaTemporaria, {
            tipo: 'aviso',
            emRespostaA: gravada.id,
          });
          return { acao: 'erro', mensagemId: gravada.id, detalhe: 'pendencia_acao_nao_aberta' };
        }
        await responder(supabase, destino, aberta.pergunta, {
          tipo: 'pergunta_pendencia',
          emRespostaA: gravada.id,
          confirmacaoId: aberta.id,
        });
        return { acao: 'acao_proposta', mensagemId: gravada.id, detalhe: resposta.proposta.tipo };
      }
      if (resposta) {
        await responder(supabase, destino, resposta.texto, { tipo: 'resposta' });
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
  const gravada = await gravarMensagem({
    supabase,
    payload,
    telefone,
    grupoId: grupo?.id ?? null,
    autorizadoId: autorizado.id,
    tipoDb,
    midia,
    status: 'recebida',
  });

  // Retry do provider que chegou enquanto o primeiro ainda processava: o
  // primeiro é quem classifica e pergunta. Este só reconhece e sai.
  if (gravada.duplicada) {
    return { acao: 'duplicada' };
  }

  const mensagemId = gravada.id;
  if (!mensagemId) {
    return { acao: 'erro', detalhe: 'falha ao gravar mensagem' };
  }

  const classificacao = await classifyAndPersist(mensagemId).catch((err) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  // Classificador fora do ar (429, timeout, chave errada): a mensagem já está
  // gravada como `erro` para o painel, mas o remetente ficaria no silêncio —
  // e o retry do provider morre no dedupe. Uma resposta curta, uma vez só,
  // fecha o ciclo do lado dele (revisão adversarial do PR #22, G7).
  if (!classificacao.ok) {
    if (!(await jaRespondida(supabase, payload.id, 'falha_temporaria'))) {
      await responder(supabase, destino, RESPOSTAS.falhaTemporaria, {
        tipo: 'aviso',
        emRespostaA: mensagemId,
      });
    }
    return { acao: 'erro', detalhe: 'classificação falhou; remetente avisado', mensagemId };
  }

  // ---------------------------------------------------------------------
  // 7. Se abriu pendência, faz a pergunta no WhatsApp.
  // ---------------------------------------------------------------------
  // Sem este envio o cliente nunca fica sabendo que precisa confirmar, e o
  // fluxo automático morre na primeira etapa.
  if ('ok' in classificacao && classificacao.ok && classificacao.confirmacao) {
    await responder(supabase, destino, classificacao.confirmacao.pergunta, {
      tipo: 'pergunta_pendencia',
      emRespostaA: mensagemId,
      confirmacaoId: classificacao.confirmacao.id,
    });
  }

  // Texto que não deu em nada (`nao_identificado`): antes era silêncio, e a
  // pessoa achava que tinha lançado. Uma linha dizendo como mandar, uma vez
  // só. Mídia não entra aqui — anexo nunca é `nao_identificado`.
  if (
    'ok' in classificacao &&
    classificacao.ok &&
    classificacao.kind === 'nao_identificado' &&
    !midia.storagePath &&
    !(await jaRespondida(supabase, payload.id, 'nao_entendi'))
  ) {
    await responder(supabase, destino, RESPOSTAS.naoEntendi, {
      tipo: 'aviso',
      emRespostaA: mensagemId,
    });
  }

  // Documento ou registro de obra resolvido sem pergunta: avisa onde foi
  // parar ("📁 Garibaldi › Fotos ✔"). Uma vez só, mesmo com retry.
  if ('ok' in classificacao && classificacao.ok && classificacao.resposta) {
    if (!(await jaRespondida(supabase, payload.id, `arquivado:${classificacao.kind}`))) {
      await responder(supabase, destino, classificacao.resposta, {
        tipo: classificacao.kind === 'documento_obra' ? 'arquivado' : 'anotado',
        emRespostaA: mensagemId,
        documentoId: classificacao.documentoId ?? null,
        registroId: classificacao.registroId ?? null,
      });
    }
  }

  return { acao: 'classificada', mensagemId, detalhe: classificacao.kind };
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

/** O que uma mensagem carrega, para as etapas que respondem pendência. */
interface ContextoDaMensagem {
  supabase: Client;
  payload: UazapiInbound;
  telefone: string;
  destino: string;
  grupoId: string | null;
  autorizado: { id: string; nome: string };
  midia: MidiaMaterializada;
  tipoDb: Database['public']['Enums']['msg_tipo'];
  textoEfetivo: string | null;
}

/**
 * Aplica a interpretação (sim/não/número) a UMA pendência. `null` quando a
 * mensagem não resolve essa pendência (não era escolha, recusa nem
 * confirmação) — o chamador decide o que fazer com ela.
 */
async function responderPendencia(
  c: ContextoDaMensagem,
  pendencia: PendenciaAberta,
  interpretacao: Interpretacao,
): Promise<ResultadoInbound | null> {
  const { supabase, payload, telefone, destino, midia, tipoDb, textoEfetivo } = c;
  // Pendência de AÇÃO (criar obra, contrato, recebimento…): SIM executa o
  // que está gravado na pendência; NÃO cancela. Outra coisa segue o fluxo —
  // a pergunta continua aberta pelas 24 h.
  if (pendencia && pendencia.tipo === 'acao') {
    if (interpretacao === 'sim') {
      const r = await aplicarAcao(supabase, {
        confirmacaoId: pendencia.id,
        via: 'whatsapp',
        respostaBruta: textoEfetivo ?? '(sem texto)',
      });
      const gravada = await gravarMensagem({
        supabase,
        payload,
        telefone,
        grupoId: c.grupoId,
        autorizadoId: c.autorizado.id,
        midia,
        tipoDb,
        status: r.ok ? 'confirmada' : 'recebida',
      });
      if (r.ok) {
        await responder(supabase, destino, r.texto, {
          tipo: 'acao_executada',
          emRespostaA: gravada.id,
          confirmacaoId: pendencia.id,
        });
        return { acao: 'executou_acao', detalhe: r.proposta.tipo };
      }
      log.aviso('acao_nao_executada', { codigo: r.codigo, motivo: r.motivo });
      await responder(
        supabase,
        destino,
        r.codigo === 'ja_resolvida' ? RESPOSTAS.acaoJaResolvida : RESPOSTAS.falhaTemporaria,
        { tipo: 'aviso', emRespostaA: gravada.id, confirmacaoId: pendencia.id },
      );
      return { acao: 'executou_acao', detalhe: r.codigo };
    }
    if (interpretacao === 'nao') {
      await recusarConfirmacao(supabase, {
        confirmacaoId: pendencia.id,
        via: 'whatsapp',
        respostaBruta: textoEfetivo ?? '(sem texto)',
        motivo: 'Remetente cancelou a ação',
      });
      const gravada = await gravarMensagem({
        supabase,
        payload,
        telefone,
        grupoId: c.grupoId,
        autorizadoId: c.autorizado.id,
        midia,
        tipoDb,
        status: 'recusada',
      });
      await responder(supabase, destino, RESPOSTAS.acaoCancelada, {
        tipo: 'aviso',
        emRespostaA: gravada.id,
        confirmacaoId: pendencia.id,
      });
      return { acao: 'recusou_pendencia', detalhe: 'acao' };
    }
  }

  // Pendência de pagamento que perguntou a obra (veio sem obra): o número
  // escolhe a obra e confirma de uma vez. "sim" sozinho não basta — falta a
  // obra, e a resposta diz isso em vez de "o gestor vai revisar".
  if (pendencia && pendencia.tipo === 'pagamento' && pendencia.opcoes.length > 0) {
    const escolha = interpretarEscolha(textoEfetivo, pendencia.opcoes);
    if (escolha) {
      const definida = await definirObraDaPendencia(supabase, {
        confirmacaoId: pendencia.id,
        obraId: escolha.id,
      });
      if (!definida.ok) {
        log.aviso('obra_da_pendencia_nao_definida', { codigo: definida.codigo });
        await responder(supabase, destino, RESPOSTAS.falhaTemporaria, {
          tipo: 'aviso',
          confirmacaoId: pendencia.id,
        });
        return { acao: 'confirmou_pendencia', detalhe: definida.codigo };
      }
      return resolverPendencia({
        supabase,
        pendencia,
        interpretacao: 'sim',
        payload,
        telefone,
        destino,
        grupoId: c.grupoId,
        autorizadoId: c.autorizado.id,
        textoEfetivo,
        midia,
        tipoDb,
        rotuloObra: escolha.nome,
      });
    }
    if (interpretacao === 'sim') {
      const gravada = await gravarMensagem({
        supabase,
        payload,
        telefone,
        grupoId: c.grupoId,
        autorizadoId: c.autorizado.id,
        midia,
        tipoDb,
        status: 'recebida',
      });
      await responder(supabase, destino, RESPOSTAS.faltaObra, {
        tipo: 'aviso',
        emRespostaA: gravada.id,
        confirmacaoId: pendencia.id,
      });
      return { acao: 'confirmou_pendencia', detalhe: 'falta_obra' };
    }
  }

  if (pendencia && pendencia.tipo === 'pagamento' && interpretacao !== 'outro') {
    return resolverPendencia({
      supabase,
      pendencia,
      interpretacao,
      payload,
      telefone,
      destino,
      grupoId: c.grupoId,
      autorizadoId: c.autorizado.id,
      autorizadoNome: c.autorizado.nome,
      textoEfetivo,
      midia,
      tipoDb,
    });
  }

  if (pendencia && pendencia.tipo !== 'pagamento') {
    const escolha = interpretarEscolha(textoEfetivo, pendencia.opcoes);
    if (escolha) {
      return resolverEscolhaDeObra({
        supabase,
        pendencia,
        obraId: escolha.id,
        payload,
        telefone,
        destino,
        grupoId: c.grupoId,
        autorizadoId: c.autorizado.id,
        textoEfetivo,
        midia,
        tipoDb,
      });
    }
    if (interpretacao === 'nao') {
      await recusarConfirmacao(supabase, {
        confirmacaoId: pendencia.id,
        via: 'whatsapp',
        respostaBruta: textoEfetivo ?? '(sem texto)',
        motivo: 'Remetente não quis arquivar',
      });
      const gravada = await gravarMensagem({
        supabase,
        payload,
        telefone,
        grupoId: c.grupoId,
        autorizadoId: c.autorizado.id,
        tipoDb,
        midia,
        status: 'recusada',
      });
      await responder(supabase, destino, RESPOSTAS.obraRecusada, {
        tipo: 'aviso',
        emRespostaA: gravada.id,
        confirmacaoId: pendencia.id,
      });
      return { acao: 'recusou_pendencia' };
    }
    // Não era escolha nem recusa: segue como mensagem comum. A pergunta de
    // obra continua aberta pelas 24 h.
  }
  return null;
}

/**
 * A pessoa mandou a nota EM CIMA do "✅ Lançado" (ou da mensagem que virou
 * o pagamento): vira documento ligado àquele pagamento. Tira o vermelho de
 * "sem comprovante" sem passar pelo painel.
 */
async function anexarAoPagamentoCitado(
  c: ContextoDaMensagem,
  pagamentoId: string,
): Promise<ResultadoInbound> {
  const { supabase, destino, midia } = c;
  const gravada = await gravarMensagem({ ...c, autorizadoId: c.autorizado.id, status: 'recebida' });
  if (gravada.duplicada) return { acao: 'duplicada' };
  const { data: pag } = await supabase
    .from('pagamentos')
    .select('id, valor, obra_id, fornecedor_id')
    .eq('id', pagamentoId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!pag) {
    await responder(supabase, destino, RESPOSTAS.falhaTemporaria, {
      tipo: 'aviso',
      emRespostaA: gravada.id,
    });
    return {
      acao: 'anexou',
      mensagemId: gravada.id ?? undefined,
      detalhe: 'pagamento_nao_encontrado',
    };
  }
  const r = await anexarMidiaComoDocumento(supabase, {
    storagePath: midia.storagePath,
    mime: midia.mime,
    pagamentoId: pag.id,
    obraId: pag.obra_id,
    fornecedorId: pag.fornecedor_id,
    dados: null,
    userId: null,
  });
  if (!r.ok) {
    log.aviso('anexo_citado_falhou', { motivo: r.motivo });
    await responder(supabase, destino, RESPOSTAS.falhaTemporaria, {
      tipo: 'aviso',
      emRespostaA: gravada.id,
      pagamentoId: pag.id,
    });
    return { acao: 'anexou', mensagemId: gravada.id ?? undefined, detalhe: r.motivo };
  }
  if (gravada.id) {
    await supabase
      .from('mensagens_whats')
      .update({ status: 'confirmada', pagamento_id: pag.id, documento_id: r.documentoId })
      .eq('id', gravada.id);
  }
  const { data: obra } = await supabase
    .from('obras')
    .select('nome')
    .eq('id', pag.obra_id)
    .maybeSingle();
  await responder(
    supabase,
    destino,
    respostaAnexado({
      valor: Number(pag.valor),
      obra: obra?.nome ?? null,
      link: linkDoPainel(`/pagamentos/${pag.id}`),
    }),
    { tipo: 'arquivado', emRespostaA: gravada.id, pagamentoId: pag.id, documentoId: r.documentoId },
  );
  return { acao: 'anexou', mensagemId: gravada.id ?? undefined, pagamentoId: pag.id };
}

async function desfazer(
  c: ContextoDaMensagem,
  alvo: AlvoDaMensagem | null,
  chatDaPendencia: string | null,
): Promise<ResultadoInbound> {
  const { supabase, destino, telefone, textoEfetivo } = c;
  const gravada = await gravarMensagem({ ...c, autorizadoId: c.autorizado.id, status: 'recebida' });
  if (gravada.duplicada) return { acao: 'duplicada' };

  let alvoReal: AlvoDaMensagem | null =
    alvo && (alvo.pagamentoId || alvo.documentoId || alvo.registroId || alvo.confirmacaoId)
      ? alvo
      : null;
  if (!alvoReal && c.payload.chatId) {
    alvoReal = await ultimaAcaoDoRemetente(supabase, { chatId: c.payload.chatId, telefone });
  }
  if (!alvoReal) {
    const [aberta] = await pendenciasAbertas(
      supabase,
      { telefone, chatId: chatDaPendencia },
      JANELA_RESPOSTA_HORAS,
    );
    if (aberta) {
      alvoReal = {
        enviadaId: null,
        tipoDaEnviada: null,
        mensagemId: aberta.mensagemId,
        confirmacaoId: aberta.id,
        pagamentoId: null,
        documentoId: null,
        registroId: null,
      };
    }
  }
  if (!alvoReal) {
    await responder(supabase, destino, RESPOSTAS.desfazerSemAlvo, {
      tipo: 'aviso',
      emRespostaA: gravada.id,
    });
    return { acao: 'desfez', mensagemId: gravada.id ?? undefined, detalhe: 'sem_alvo' };
  }

  const r = await desfazerAlvo(supabase, alvoReal, { respostaBruta: textoEfetivo ?? '' });
  if (!r.ok) {
    await responder(
      supabase,
      destino,
      r.codigo === 'ja_desfeito' ? RESPOSTAS.jaDesfeito : RESPOSTAS.falhaTemporaria,
      { tipo: 'aviso', emRespostaA: gravada.id },
    );
    return { acao: 'desfez', mensagemId: gravada.id ?? undefined, detalhe: r.codigo };
  }
  if (c.payload.chatId) await zerarObraDaConversa(supabase, c.payload.chatId);
  await responder(supabase, destino, r.resposta, {
    tipo: 'aviso',
    emRespostaA: gravada.id,
    confirmacaoId: alvoReal.confirmacaoId,
    pagamentoId: alvoReal.pagamentoId,
    documentoId: alvoReal.documentoId,
    registroId: alvoReal.registroId,
  });
  return { acao: 'desfez', mensagemId: gravada.id ?? undefined, detalhe: r.oQue };
}

/** Obras ativas e fornecedores vivos, por nome — para correção e mover. */
async function nomesDoCadastro(supabase: Client) {
  const [obras, fornecedores] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, apelidos')
      .is('deleted_at', null)
      .eq('status', 'ativa')
      .limit(50),
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null).limit(500),
  ]);
  return {
    obras: (obras.data ?? []).map((o) => ({ id: o.id, nome: o.nome, apelidos: o.apelidos ?? [] })),
    fornecedores: (fornecedores.data ?? []).map((f) => ({ id: f.id, nome: f.nome })),
  };
}

/**
 * "Essa é da INOX" em cima de um "📁 Guardei na obra Garibaldi": move. Sem
 * obra reconhecível e sem cara de correção, `null` — a mensagem segue como
 * qualquer outra (pode ser uma pergunta sobre a foto).
 */
async function moverCitado(
  c: ContextoDaMensagem,
  alvo: AlvoDaMensagem,
): Promise<ResultadoInbound | null> {
  const { supabase, destino, textoEfetivo } = c;
  const nomes = await nomesDoCadastro(supabase);
  const obra = acharNomeado(normalizarNome(textoEfetivo), nomes.obras);
  if (!obra && !pareceCorrecao(textoEfetivo)) return null;

  const gravada = await gravarMensagem({ ...c, autorizadoId: c.autorizado.id, status: 'recebida' });
  if (gravada.duplicada) return { acao: 'duplicada' };
  if (!obra) {
    await responder(supabase, destino, RESPOSTAS.moverQualObra, {
      tipo: 'aviso',
      emRespostaA: gravada.id,
      documentoId: alvo.documentoId,
      registroId: alvo.registroId,
    });
    return { acao: 'moveu', mensagemId: gravada.id ?? undefined, detalhe: 'sem_obra' };
  }
  const r = await moverParaObra(supabase, alvo, obra);
  if (!r.ok) {
    await responder(
      supabase,
      destino,
      r.codigo === 'ja_desfeito' ? `Já está na obra *${obra.nome}*.` : RESPOSTAS.falhaTemporaria,
      { tipo: 'aviso', emRespostaA: gravada.id },
    );
    return { acao: 'moveu', mensagemId: gravada.id ?? undefined, detalhe: r.codigo };
  }
  if (c.payload.chatId) await zerarObraDaConversa(supabase, c.payload.chatId, obra);
  await responder(supabase, destino, r.resposta, {
    tipo: alvo.registroId ? 'anotado' : 'arquivado',
    emRespostaA: gravada.id,
    documentoId: alvo.documentoId,
    registroId: alvo.registroId,
  });
  return { acao: 'moveu', mensagemId: gravada.id ?? undefined, detalhe: r.oQue };
}

/** Duas ou mais perguntas esperando SIM/NÃO e um "sim" solto: qual? */
async function perguntarQual(
  c: ContextoDaMensagem,
  chatId: string,
  candidatas: PendenciaAberta[],
  interpretacao: Interpretacao,
): Promise<ResultadoInbound> {
  const { supabase, destino } = c;
  const gravada = await gravarMensagem({ ...c, autorizadoId: c.autorizado.id, status: 'recebida' });
  if (gravada.duplicada) return { acao: 'duplicada' };
  // Da mais antiga para a mais nova: é a ordem em que a pessoa viu as perguntas.
  const ordenadas = [...candidatas].reverse().slice(0, 9);
  const itens = await Promise.all(
    ordenadas.map(async (p, i) => ({ n: i + 1, ...(await resumoDaPendencia(supabase, p)) })),
  );
  const escolha = interpretacao === 'nao' ? 'nao' : 'sim';
  await guardarEscolha(supabase, chatId, {
    interpretacao: escolha,
    itens: ordenadas.map((p, i) => ({ n: i + 1, confirmacaoId: p.id })),
  });
  await responder(supabase, destino, perguntaQualPendencia(itens, escolha), {
    tipo: 'aviso',
    emRespostaA: gravada.id,
  });
  return {
    acao: 'perguntou_qual',
    mensagemId: gravada.id ?? undefined,
    detalhe: `${itens.length}`,
  };
}

/**
 * Correção de uma pendência: extrai o que mudar (padrões, e o modelo quando
 * há), aplica e pergunta de novo. Pendência de obra: a obra citada escolhe.
 */
async function corrigir(
  c: ContextoDaMensagem,
  pendencia: PendenciaAberta,
  chatDaPendencia: string | null,
): Promise<ResultadoInbound> {
  const { supabase, destino, textoEfetivo } = c;
  const texto = textoEfetivo ?? '';
  const nomes = await nomesDoCadastro(supabase);
  const patch = await extrairCorrecao(texto, {
    ...nomes,
    hoje: hojeBR(),
    perguntaEnviada: pendencia.perguntaEnviada,
  });
  const campos = Object.keys(patch).filter((k) => k !== 'cancelar');

  if (patch.cancelar) {
    // "não, esquece" = recusa de sempre.
    return (
      (await responderPendencia(c, pendencia, 'nao')) ?? {
        acao: 'recusou_pendencia',
        detalhe: 'correcao',
      }
    );
  }

  const gravada = await gravarMensagem({ ...c, autorizadoId: c.autorizado.id, status: 'recebida' });
  if (gravada.duplicada) return { acao: 'duplicada' };
  const rastro = { emRespostaA: gravada.id, confirmacaoId: pendencia.id };

  if (pendencia.tipo === 'acao') {
    await responder(supabase, destino, RESPOSTAS.correcaoDeAcao, { tipo: 'aviso', ...rastro });
    return { acao: 'corrigiu_pendencia', mensagemId: gravada.id ?? undefined, detalhe: 'acao' };
  }

  if (pendencia.tipo !== 'pagamento') {
    // Pergunta de obra: a obra citada é a escolha.
    if (patch.obra) {
      const opcao = pendencia.opcoes.find((o) => o.id === patch.obra?.id);
      const obraId = opcao?.id ?? patch.obra.id;
      if (chatDaPendencia) await zerarObraDaConversa(supabase, chatDaPendencia, patch.obra);
      return resolverEscolhaDeObra({
        ...c,
        pendencia,
        obraId,
        grupoId: c.grupoId,
        autorizadoId: c.autorizado.id,
        jaGravada: gravada.id,
      });
    }
    await responder(supabase, destino, RESPOSTAS.correcaoQualObra, { tipo: 'aviso', ...rastro });
    return { acao: 'corrigiu_pendencia', mensagemId: gravada.id ?? undefined, detalhe: 'sem_obra' };
  }

  if (campos.length === 0) {
    await responder(supabase, destino, RESPOSTAS.correcaoSemDado, { tipo: 'aviso', ...rastro });
    return { acao: 'corrigiu_pendencia', mensagemId: gravada.id ?? undefined, detalhe: 'sem_dado' };
  }

  const r = await corrigirPendencia(supabase, {
    pendencia,
    patch,
    chatId: chatDaPendencia,
    respostaBruta: texto,
  });
  if (!r.ok) {
    await responder(
      supabase,
      destino,
      r.codigo === 'sem_mudanca' ? RESPOSTAS.correcaoSemDado : RESPOSTAS.falhaTemporaria,
      { tipo: 'aviso', ...rastro },
    );
    return { acao: 'corrigiu_pendencia', mensagemId: gravada.id ?? undefined, detalhe: r.codigo };
  }
  await responder(supabase, destino, r.resposta, { tipo: 'pergunta_pendencia', ...rastro });
  return {
    acao: 'corrigiu_pendencia',
    mensagemId: gravada.id ?? undefined,
    detalhe: r.mudancas.join(', '),
  };
}

interface ContextoResolucao {
  supabase: Client;
  pendencia: PendenciaAberta;
  interpretacao: 'sim' | 'nao';
  payload: UazapiInbound;
  telefone: string;
  /** Chat para onde a resposta vai (grupo ou o próprio remetente). */
  destino: string;
  grupoId: string | null;
  autorizadoId: string;
  /** Quem respondeu — entra na resposta quando não é quem abriu a pendência. */
  autorizadoNome?: string;
  textoEfetivo: string | null;
  midia: MidiaMaterializada;
  tipoDb: Database['public']['Enums']['msg_tipo'];
  /** Quando a confirmação veio pelo número da obra: entra na resposta. */
  rotuloObra?: string;
  /** A mensagem já foi gravada por quem chamou (correção): não gravar de novo. */
  jaGravada?: string | null;
}

/**
 * Aplica a resposta do cliente à pendência aberta e avisa o resultado.
 *
 * A mensagem de resposta também é gravada, com status já resolvido: ela é a
 * prova, no audit trail, de que o lançamento saiu de um "sim" do próprio
 * cliente e não de um clique do gestor.
 */
async function resolverPendencia(ctx: ContextoResolucao): Promise<ResultadoInbound> {
  const { supabase, pendencia, interpretacao, destino, textoEfetivo } = ctx;
  const respostaBruta = textoEfetivo ?? '(sem texto)';

  if (interpretacao === 'sim') {
    const resultado = await aplicarConfirmacao(supabase, {
      confirmacaoId: pendencia.id,
      via: 'whatsapp',
      respostaBruta,
      userId: null, // não há sessão: quem autorizou foi o próprio remetente
    });

    const gravada = await gravarMensagem({
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
      await responder(supabase, destino, RESPOSTAS.confirmadoSemPagamento, {
        tipo: 'aviso',
        emRespostaA: gravada.id,
        confirmacaoId: pendencia.id,
      });
      return { acao: 'confirmou_pendencia', detalhe: resultado.codigo };
    }

    await responder(
      supabase,
      destino,
      await textoDoLancado(supabase, resultado.pagamentoId, {
        rotuloObra: ctx.rotuloObra,
        pendencia,
        telefone: ctx.telefone,
        autorizadoNome: ctx.autorizadoNome,
      }),
      {
        tipo: 'lancado',
        emRespostaA: gravada.id,
        confirmacaoId: pendencia.id,
        pagamentoId: resultado.pagamentoId,
      },
    );
    return { acao: 'confirmou_pendencia', pagamentoId: resultado.pagamentoId };
  }

  await recusarConfirmacao(supabase, {
    confirmacaoId: pendencia.id,
    via: 'whatsapp',
    respostaBruta,
    motivo: 'Recusada pelo remetente no WhatsApp',
  });

  const gravada = await gravarMensagem({
    ...ctx,
    status: 'recusada',
    autorizadoId: ctx.autorizadoId,
  });

  await responder(supabase, destino, RESPOSTAS.recusado, {
    tipo: 'aviso',
    emRespostaA: gravada.id,
    confirmacaoId: pendencia.id,
  });
  return { acao: 'recusou_pendencia' };
}

/**
 * A pessoa respondeu o número (ou o nome) da obra: arquiva/registra lá e
 * avisa. A mensagem da resposta é gravada como `confirmada` — é a prova de
 * que o destino foi escolhido pelo remetente.
 */
async function resolverEscolhaDeObra(
  ctx: Omit<ContextoResolucao, 'interpretacao'> & { obraId: string },
): Promise<ResultadoInbound> {
  const { supabase, pendencia, destino, textoEfetivo } = ctx;
  const resultado = await aplicarEscolhaDeObra(supabase, {
    confirmacaoId: pendencia.id,
    obraId: ctx.obraId,
    via: 'whatsapp',
    respostaBruta: textoEfetivo ?? '(sem texto)',
    userId: null,
  });

  const gravada = ctx.jaGravada
    ? { id: ctx.jaGravada, duplicada: false }
    : await gravarMensagem({ ...ctx, status: resultado.ok ? 'confirmada' : 'recebida' });
  if (ctx.jaGravada && resultado.ok) {
    await supabase.from('mensagens_whats').update({ status: 'confirmada' }).eq('id', ctx.jaGravada);
  }

  if (!resultado.ok) {
    log.aviso('escolha_de_obra_falhou', { codigo: resultado.codigo });
    await responder(supabase, destino, RESPOSTAS.falhaTemporaria, {
      tipo: 'aviso',
      emRespostaA: gravada.id,
      confirmacaoId: pendencia.id,
    });
    return { acao: 'escolheu_obra', detalhe: resultado.codigo };
  }

  await responder(supabase, destino, resultado.resposta, {
    tipo: pendencia.tipo === 'obra_registro' ? 'anotado' : 'arquivado',
    emRespostaA: gravada.id,
    confirmacaoId: pendencia.id,
    documentoId: resultado.documentoId ?? null,
    registroId: resultado.registroId ?? null,
  });
  return { acao: 'escolheu_obra', detalhe: pendencia.tipo };
}

interface ArgsGravar {
  supabase: Client;
  payload: UazapiInbound;
  telefone: string;
  grupoId: string | null;
  autorizadoId: string;
  tipoDb: Database['public']['Enums']['msg_tipo'];
  midia: MidiaMaterializada;
  status: Database['public']['Enums']['msg_status'];
  pagamentoId?: string | null;
}

async function gravarMensagem(
  args: ArgsGravar,
): Promise<{ id: string | null; duplicada: boolean }> {
  const { supabase, payload, telefone, autorizadoId, tipoDb, midia, status } = args;

  const { data, error } = await supabase
    .from('mensagens_whats')
    .insert({
      msg_id_uazapi: payload.id,
      telefone_from: telefone,
      chat_id: payload.chatId ?? null,
      grupo_id: args.grupoId,
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
      // Sinaliza a corrida perdida: quem chamou NÃO pode classificar de novo.
      // Antes devolvia só o id, e o chamador reclassificava a mensagem do
      // vencedor — segunda pendência, segunda pergunta no WhatsApp.
      return { id: null, duplicada: true };
    }
    log.erro('gravar_mensagem_falhou', { erro: error });
    return { id: null, duplicada: false };
  }

  return { id: data.id, duplicada: false };
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
  remetente: string | null = null,
): Promise<MidiaMaterializada> {
  // O v2 nem sempre manda URL http em `fileURL`; o provider dá o link sob
  // demanda pelo id da mensagem.
  const urlDoPayload = payload.media?.url;
  const url =
    urlDoPayload && /^https?:\/\//u.test(urlDoPayload)
      ? urlDoPayload
      : payload.media
        ? await obterLinkDaMidia(payload.id)
        : null;
  if (!url) return { storagePath: null, mime: payload.media?.mimetype ?? null, transcricao: null };

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
  // ainda não virou `documentos` (migration 20260909140000). O nome diz
  // quando, o que e quem — `midia.jpeg` repetido 40 vezes não ajuda ninguém.
  const nome = nomeArquivoDaMidia({
    tipo: payload.type,
    mime,
    nomeDeclarado: payload.media?.filename,
    remetente,
    quando: new Date(toIsoDate(payload.timestamp)),
  });
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

/**
 * Registra que esta mensagem do provider já foi (ou está sendo) respondida.
 *
 * `true` = já existia: é retry, não responder de novo. A tabela
 * `whatsapp_respostas` tem o id do provider como chave primária; o segundo
 * INSERT dá 23505. Falha de banco libera (`false`): pior responder duas
 * vezes que nunca.
 */
async function jaRespondida(supabase: Client, msgIdUazapi: string, acao: string): Promise<boolean> {
  const { error } = await supabase
    .from('whatsapp_respostas')
    .insert({ msg_id_uazapi: msgIdUazapi, acao });
  if (!error) return false;
  if (error.code === '23505') return true;
  log.aviso('dedupe_resposta_falhou', { erro: error.message });
  return false;
}

/**
 * Grupo cadastrado e ativo. Lista fechada, como `autorizados`.
 */
async function buscarGrupo(
  supabase: Client,
  chatId: string,
): Promise<{ id: string; obraId: string | null } | null> {
  if (!chatId) return null;
  const { data, error } = await supabase
    .from('whatsapp_grupos')
    .select('id, obra_id')
    .eq('chat_id', chatId)
    .eq('ativo', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    log.erro('consultar_grupos_falhou', { erro: error.message });
    return null;
  }
  return data ? { id: data.id, obraId: data.obra_id } : null;
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
  // `telefone_norm` é gerada no banco (só dígitos) e única entre vivos
  // (PR #21): a busca é um índice, não a lista inteira normalizada em JS.
  // As duas formas do celular brasileiro (com e sem o nono dígito) valem:
  // o WhatsApp manda `557398489747`, o cadastro tem `5573998489747`.
  const { data, error } = await supabase
    .from('autorizados')
    .select('id, nome')
    .in('telefone_norm', variantesTelefoneBR(telefone))
    .eq('ativo', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    log.erro('consultar_autorizados_falhou', { erro: error.message });
    return null;
  }
  if (data) return { id: data.id, nome: data.nome };

  // Não achou: a lista está vazia (aviso operacional) ou o número não está nela.
  const { count } = await supabase
    .from('autorizados')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true)
    .is('deleted_at', null);
  if (!count) {
    log.aviso('autorizados_vazio', {
      dica: 'Nenhum número ativo em autorizados: toda mensagem será ignorada. Cadastre a equipe em /config/autorizados.',
    });
  }
  return null;
}

/**
 * "✅ Lançado: R$ 1.200,00 · Obra: Garibaldi · Fornecedor: Mathias" — relê o
 * pagamento gravado para a resposta repetir o que foi gravado, não o que se
 * achou que ia ser. Falha na leitura cai no texto curto de sempre.
 */
async function textoDoLancado(
  supabase: Client,
  pagamentoId: string,
  extras: {
    rotuloObra?: string;
    pendencia?: PendenciaAberta;
    telefone?: string;
    autorizadoNome?: string;
  } = {},
): Promise<string> {
  try {
    const { data } = await supabase
      .from('pagamentos')
      .select('valor, obra_id, fornecedor_id')
      .eq('id', pagamentoId)
      .maybeSingle();
    if (!data) return RESPOSTAS.confirmado;
    const [obra, fornecedor, origem] = await Promise.all([
      data.obra_id
        ? supabase.from('obras').select('nome').eq('id', data.obra_id).maybeSingle()
        : Promise.resolve({ data: null }),
      data.fornecedor_id
        ? supabase.from('fornecedores').select('nome').eq('id', data.fornecedor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      extras.pendencia
        ? supabase
            .from('mensagens_whats')
            .select('telefone_from, midia_storage_path')
            .eq('id', extras.pendencia.mensagemId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    // Quem confirmou não é quem mandou (no grupo, o gestor confirma a foto
    // do encarregado): a resposta diz. E lançamento por texto, sem nota:
    // ensina a mandar a nota em cima desta mensagem.
    const outraPessoa =
      origem.data?.telefone_from &&
      extras.telefone &&
      !variantesTelefoneBR(extras.telefone).includes(origem.data.telefone_from);
    const linhas = [
      respostaPagamentoLancado({
        valor: Number(data.valor),
        obra: obra.data?.nome ?? extras.rotuloObra ?? null,
        fornecedor: fornecedor.data?.nome ?? null,
        link: linkDoPainel(`/pagamentos/${pagamentoId}`),
        confirmadoPor: outraPessoa ? (extras.autorizadoNome ?? null) : null,
      }),
    ];
    if (origem.data && !origem.data.midia_storage_path) linhas.push(RESPOSTAS.dicaAnexar);
    return linhas.join('\n');
  } catch {
    return RESPOSTAS.confirmado;
  }
}
