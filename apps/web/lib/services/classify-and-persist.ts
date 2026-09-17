import 'server-only';
import { type Classifier, type ClassifierInput, getClassifier } from '@/lib/ia/classifier';
import { obraRecente } from '@/lib/ia/memoria-curta';
import { logger } from '@/lib/log';
import { CATEGORIAS, type DocCategoria } from '@/lib/status-labels';
import { hojeBR } from '@/lib/util/datas';
import { formatarValorBR } from '@/lib/util/moeda';
import { type Opcao, formatarOpcoes } from '@/lib/whatsapp/escolha';
import type { Database } from '@nogma/db';
import type { Json } from '@nogma/db/types';
import { createClient as createSbClient } from '@supabase/supabase-js';
import {
  arquivarDocumentoDeObra,
  registrarNaObra,
  respostaArquivado,
  respostaRegistrado,
} from './arquivar';

const log = logger('classificacao');

const CONFIANCA_AUTO_APROVAR = 0.85;

/**
 * Auto-aprovação sem perguntar nada ao remetente: desligada por padrão.
 *
 * O briefing (§4) descreve o fluxo como "o bot devolve a confirmação e, após o
 * OK, insere automaticamente" — a confirmação é parte do contrato, não um
 * degrau opcional. Com o classificador real ligado, manter a auto-aprovação
 * como default significaria gravar no financeiro do cliente a partir de um
 * palpite de 0.85 de confiança sem que ninguém tenha dito "sim".
 *
 * Quem quiser o comportamento antigo liga `IA_AUTO_APROVAR=true`.
 */
function autoAprovacaoLigada(): boolean {
  return process.env.IA_AUTO_APROVAR === 'true';
}

/**
 * Given a `mensagens_whats.id`, fetch context, run the classifier, and
 * persist the outcome. Fluxo:
 *
 *  1. Fetch mensagem + contexto (obras ativas + fornecedores).
 *  2. status → 'processando'.
 *  3. classifier.classify(input).
 *  4. Route por kind + confidence:
 *     - `nao_identificado`: status='erro', erro_msg=raciocinio
 *     - `documento_apenas`: status='classificada', cria entry em confirmacoes_pendentes
 *     - `pagamento_completo` + confidence >= 0.85 + valor/obra/fornecedor completos:
 *          cria Pagamento (origem='whatsapp'), status='confirmada', link
 *     - `pagamento_parcial` OU confidence < 0.85: status='classificada' +
 *          confirmacoes_pendentes.pergunta_enviada
 *
 * O download da mídia acontece ANTES desta função, em `inbound-whatsapp`,
 * enquanto a URL do provider ainda é válida (ela expira em minutos). Aqui a
 * mídia já chega como `midia_storage_path` — o classificador real relê o
 * objeto do Storage para enxergar a foto da nota — e o áudio já chega
 * transcrito em `texto_transcrito`.
 *
 * Chamado por `processarInbound` depois de gravar a mensagem.
 */
export async function classifyAndPersist(mensagemId: string): Promise<
  | {
      ok: true;
      status: string;
      confianca: number;
      kind: string;
      /**
       * Preenchido quando a classificação abriu uma pendência. Quem chamou
       * usa isto pra mandar a pergunta no WhatsApp e guardar o id da
       * mensagem enviada — sem isso o cliente nunca fica sabendo que
       * precisa confirmar, e o fluxo automático morre na primeira etapa.
       */
      confirmacao: { id: string; pergunta: string } | null;
      /**
       * Resposta curta a mandar no chat quando a mensagem foi resolvida sem
       * pergunta ("📁 Garibaldi › Fotos ✔"). Só para documento/registro de
       * obra; pagamento continua pelo `confirmacao`.
       */
      resposta?: string;
    }
  | { ok: false; error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: 'supabase env missing' };
  const supabase = createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: msg, error: msgErr } = await supabase
    .from('mensagens_whats')
    .select(
      'id, telefone_from, texto_bruto, texto_transcrito, midia_mime, midia_storage_path, chat_id, grupo_id, autorizado_id',
    )
    .eq('id', mensagemId)
    .single();
  if (msgErr || !msg) return { ok: false, error: `mensagem ${mensagemId} não encontrada` };

  await supabase.from('mensagens_whats').update({ status: 'processando' }).eq('id', mensagemId);

  const [obrasRes, fornRes, catRes, grupoRes] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, apelidos')
      .is('deleted_at', null)
      .eq('status', 'ativa')
      .order('nome', { ascending: true }),
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null),
    supabase.from('categorias').select('id, nome').is('deleted_at', null).order('nome'),
    msg.grupo_id
      ? supabase.from('whatsapp_grupos').select('obra_id').eq('id', msg.grupo_id).maybeSingle()
      : Promise.resolve({ data: null as { obra_id: string | null } | null }),
  ]);

  const obrasAtivas = (obrasRes.data ?? []).map((o) => ({
    id: o.id,
    nome: o.nome,
    apelidos: o.apelidos ?? [],
  }));

  const input: ClassifierInput = {
    // Áudio chega com `texto_bruto` nulo: quem tem o conteúdo é a transcrição.
    // Sem este fallback todo áudio caía direto em `nao_identificado`.
    texto: msg.texto_bruto ?? msg.texto_transcrito,
    midiaStoragePath: msg.midia_storage_path,
    midiaMime: msg.midia_mime,
    telefone: msg.telefone_from,
    contexto: {
      obrasAtivas,
      fornecedoresConhecidos: (fornRes.data ?? []).map((f) => ({ id: f.id, nome: f.nome })),
      categorias: (catRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome })),
      // Obra padrão: a do grupo dedicado; sem ela, a de que se estava falando
      // neste chat nas últimas horas (criada por ação, ou citada na última
      // mensagem classificada). É o que faz "vou mandar os documentos aqui"
      // depois de "cria a obra X" arquivar em X sem perguntar a cada foto.
      grupoObraId:
        grupoRes.data?.obra_id ??
        (msg.autorizado_id
          ? ((
              await obraRecente(supabase, {
                chatId: msg.chat_id,
                telefone: msg.telefone_from,
                autorizadoId: msg.autorizado_id,
              })
            )?.id ?? null)
          : null),
    },
  };

  // Falha do classificador (rede, chave, modelo) não pode deixar a mensagem
  // presa em `processando` para sempre: o gestor precisa ver que deu erro e
  // lançar à mão. O erro técnico vai para o log, não para a tela.
  let out: Awaited<ReturnType<Classifier['classify']>>;
  try {
    const classifier = await getClassifier();
    out = await classifier.classify(input);
  } catch (err) {
    log.erro('classificador_falhou', { mensagem_id: mensagemId, err });
    await supabase
      .from('mensagens_whats')
      .update({ status: 'erro', erro_msg: 'Classificador indisponível; lançar manualmente.' })
      .eq('id', mensagemId);
    return { ok: false, error: 'classificador indisponível' };
  }

  if (out.kind === 'nao_identificado') {
    await supabase
      .from('mensagens_whats')
      .update({
        status: 'erro',
        erro_msg: out.extracted.raciocinio ?? 'não identificado',
        confianca_ia: out.confidence,
        dados_extraidos: out.extracted,
      })
      .eq('id', mensagemId);
    return {
      ok: true,
      status: 'erro',
      confianca: out.confidence,
      kind: out.kind,
      confirmacao: null,
    };
  }

  // ---------------------------------------------------------------------
  // Documento de obra e registro do diário: arquiva e avisa. Sem obra,
  // pergunta qual (por número). Nunca abre pendência de pagamento.
  // ---------------------------------------------------------------------
  if (out.kind === 'documento_obra' || out.kind === 'registro_obra') {
    const obra = out.extracted.obra_id
      ? obrasAtivas.find((o) => o.id === out.extracted.obra_id)
      : undefined;

    if (!obra) {
      const opcoes: Opcao[] = obrasAtivas.slice(0, 10).map((o, i) => ({
        n: i + 1,
        id: o.id,
        nome: o.nome,
        apelidos: o.apelidos,
      }));
      if (opcoes.length === 0) {
        await supabase
          .from('mensagens_whats')
          .update({
            status: 'erro',
            erro_msg: 'Nenhuma obra ativa cadastrada para arquivar.',
            confianca_ia: out.confidence,
            dados_extraidos: out.extracted,
          })
          .eq('id', mensagemId);
        return {
          ok: true,
          status: 'erro',
          confianca: out.confidence,
          kind: out.kind,
          confirmacao: null,
        };
      }
      const pergunta = `${out.kind === 'documento_obra' ? 'De qual obra é esse arquivo?' : 'Anoto isso em qual obra?'}\n${formatarOpcoes(opcoes)}\nResponda com o número.`;
      return abrirPendencia(supabase, {
        mensagemId,
        pergunta,
        out,
        tipo: out.kind === 'documento_obra' ? 'obra_documento' : 'obra_registro',
        opcoes,
        chatId: msg.chat_id,
      });
    }

    const resultado =
      out.kind === 'documento_obra'
        ? await arquivarDocumentoDeObra(supabase, {
            mensagemId,
            obraId: obra.id,
            categoria: categoriaValida(out.extracted.categoria),
            tipo: out.extracted.tipo_documento ?? 'outro',
            storagePath: msg.midia_storage_path,
            mime: msg.midia_mime,
            autorizadoId: msg.autorizado_id,
            legenda: msg.texto_bruto,
          })
        : await registrarNaObra(supabase, {
            mensagemId,
            obraId: obra.id,
            texto: msg.texto_bruto ?? msg.texto_transcrito,
            resumo: out.extracted.resumo ?? null,
            storagePath: msg.midia_storage_path,
            mime: msg.midia_mime,
            autorizadoId: msg.autorizado_id,
          });

    if (!resultado.ok) {
      await supabase
        .from('mensagens_whats')
        .update({
          status: 'erro',
          erro_msg:
            out.kind === 'documento_obra'
              ? 'Não consegui guardar o arquivo; arquive pelo painel.'
              : 'Não consegui anotar no diário; registre pelo painel.',
          confianca_ia: out.confidence,
          dados_extraidos: out.extracted,
        })
        .eq('id', mensagemId);
      log.aviso('arquivamento_falhou', {
        mensagem_id: mensagemId,
        kind: out.kind,
        motivo: resultado.motivo,
      });
      return {
        ok: true,
        status: 'erro',
        confianca: out.confidence,
        kind: out.kind,
        confirmacao: null,
        resposta: 'Não consegui guardar isso agora. Ficou registrado para o gestor ver no painel.',
      };
    }

    await supabase
      .from('mensagens_whats')
      .update({ confianca_ia: out.confidence, dados_extraidos: out.extracted })
      .eq('id', mensagemId);

    return {
      ok: true,
      status: 'confirmada',
      confianca: out.confidence,
      kind: out.kind,
      confirmacao: null,
      resposta:
        out.kind === 'documento_obra'
          ? respostaArquivado(obra.nome, categoriaValida(out.extracted.categoria))
          : respostaRegistrado(obra.nome),
    };
  }

  const { valor: valorExtraido, obra_id: obraExtraida } = out.extracted;
  const autoAprovar =
    autoAprovacaoLigada() &&
    out.kind === 'pagamento_completo' &&
    out.confidence >= CONFIANCA_AUTO_APROVAR &&
    valorExtraido != null &&
    obraExtraida != null;

  if (autoAprovar) {
    const insertPagto = await supabase
      .from('pagamentos')
      .insert({
        obra_id: obraExtraida,
        fornecedor_id: out.extracted.fornecedor_id ?? null,
        valor: valorExtraido,
        data_pagamento: out.extracted.data_pagamento ?? hojeBR(),
        origem: 'whatsapp',
        status_pagto: 'confirmado',
        descricao: out.extracted.descricao ?? null,
        criado_via_msg_id: mensagemId,
      })
      .select('id')
      .single();

    if (insertPagto.error) {
      await supabase
        .from('mensagens_whats')
        .update({
          status: 'erro',
          erro_msg: `insert pagamento falhou (${insertPagto.error.code ?? 'erro'}); veja o log pela correlação`,
          confianca_ia: out.confidence,
          dados_extraidos: out.extracted,
        })
        .eq('id', mensagemId);
      return { ok: false, error: insertPagto.error.message };
    }

    await supabase
      .from('mensagens_whats')
      .update({
        status: 'confirmada',
        pagamento_id: insertPagto.data.id,
        confianca_ia: out.confidence,
        dados_extraidos: out.extracted,
      })
      .eq('id', mensagemId);

    return {
      ok: true,
      status: 'confirmada',
      confianca: out.confidence,
      kind: out.kind,
      confirmacao: null,
    };
  }

  // Pagamento com valor mas sem obra (comprovante de Pix não diz a obra; o
  // grupo não é dedicado): perguntar "confirma?" leva a um SIM que não lança
  // nada — foi o teste 2 de 16/09. Pergunta-se a obra, numerada; o número
  // confirma E lança. Sem obras ativas cai na pergunta comum.
  const semObra = out.extracted.valor != null && !out.extracted.obra_id;
  const opcoesDeObra: Opcao[] = semObra
    ? obrasAtivas
        .slice(0, 10)
        .map((o, i) => ({ n: i + 1, id: o.id, nome: o.nome, apelidos: o.apelidos }))
    : [];
  if (opcoesDeObra.length > 0) {
    const fornecedor =
      (out.extracted.fornecedor_id &&
        input.contexto.fornecedoresConhecidos.find((f) => f.id === out.extracted.fornecedor_id)
          ?.nome) ||
      out.extracted.fornecedor_nome_novo;
    const partes = [`R$ ${formatarValorBR(out.extracted.valor as number)}`];
    if (out.extracted.descricao) partes.push(out.extracted.descricao);
    if (fornecedor) partes.push(`para ${fornecedor}`);
    if (out.extracted.data_pagamento) partes.push(`em ${dataBR(out.extracted.data_pagamento)}`);
    const pergunta = `${partes.join(' — ')}.\nDe qual obra é esse pagamento?\n${formatarOpcoes(opcoesDeObra)}\nResponda com o número para lançar, ou NÃO para cancelar.`;
    return abrirPendencia(supabase, {
      mensagemId,
      pergunta,
      out,
      tipo: 'pagamento',
      opcoes: opcoesDeObra,
      chatId: msg.chat_id,
    });
  }

  // Caso default: confirmação pendente
  const pergunta =
    out.perguntaConfirmacao ??
    'Recebi sua mensagem mas preciso confirmar os dados antes de lançar. Pode revisar no painel?';

  return abrirPendencia(supabase, {
    mensagemId,
    pergunta,
    out,
    tipo: 'pagamento',
    chatId: msg.chat_id,
  });
}

/** `2026-09-15` → `15/09/2026`. */
function dataBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function categoriaValida(c: string | undefined): DocCategoria {
  return (CATEGORIAS as readonly string[]).includes(c ?? '') ? (c as DocCategoria) : 'outro';
}

/**
 * Abre a pendência (pagamento ou obra) e marca a mensagem como `classificada`.
 * Uma por mensagem: o índice parcial segura a segunda pergunta no retry.
 */
async function abrirPendencia(
  supabase: ReturnType<typeof createSbClient<Database>>,
  args: {
    mensagemId: string;
    pergunta: string;
    out: Awaited<ReturnType<Classifier['classify']>>;
    tipo: 'pagamento' | 'obra_documento' | 'obra_registro';
    opcoes?: Opcao[];
    chatId: string | null;
  },
): Promise<{
  ok: true;
  status: string;
  confianca: number;
  kind: string;
  confirmacao: { id: string; pergunta: string } | null;
}> {
  const { mensagemId, pergunta, out } = args;
  const { data: msg } = await supabase
    .from('mensagens_whats')
    .select('texto_bruto, telefone_from, midia_mime')
    .eq('id', mensagemId)
    .maybeSingle();

  const { data: confirmacaoCriada, error: erroConfirmacao } = await supabase
    .from('confirmacoes_pendentes')
    .insert({
      mensagem_id: mensagemId,
      pergunta_enviada: pergunta,
      tipo: args.tipo,
      opcoes: args.opcoes ? (JSON.parse(JSON.stringify(args.opcoes)) as Json) : null,
      chat_id: args.chatId,
    })
    .select('id')
    .single();

  if (erroConfirmacao?.code === '23505') {
    // Já há uma pendência aberta para esta mensagem (índice parcial
    // `idx_confirmacoes_uma_aberta_por_mensagem`). É a trava contra a segunda
    // pergunta no WhatsApp: a primeira passagem já perguntou.
    await supabase
      .from('mensagens_whats')
      .update({
        status: 'classificada',
        confianca_ia: out.confidence,
        dados_extraidos: out.extracted,
      })
      .eq('id', mensagemId);
    return {
      ok: true,
      status: 'classificada',
      confianca: out.confidence,
      kind: out.kind,
      confirmacao: null,
    };
  }
  if (erroConfirmacao) {
    log.erro('abrir_pendencia_falhou', { mensagemId, erro: erroConfirmacao.message });
  }

  await supabase
    .from('mensagens_whats')
    .update({
      status: 'classificada',
      confianca_ia: out.confidence,
      dados_extraidos: out.extracted,
    })
    .eq('id', mensagemId);

  // Pergunta de obra não é pendência financeira: nem webhook, nem evento.
  if (args.tipo !== 'pagamento') {
    return {
      ok: true,
      status: 'classificada',
      confianca: out.confidence,
      kind: out.kind,
      confirmacao: confirmacaoCriada ? { id: confirmacaoCriada.id, pergunta } : null,
    };
  }

  // Nota: automação de e-mail "pendência nova" removida — fora do escopo
  // contratado (briefing de alinhamento 16/09). Webhook outbound (fase
  // n8n) segue best-effort abaixo.
  try {
    const { count: pendenciaCount } = await supabase
      .from('confirmacoes_pendentes')
      .select('*', { count: 'exact', head: true })
      .eq('resolvida', false);

    // Dispatch outbound webhook (fase n8n) — best-effort
    const { dispatchEvento } = await import('@/lib/services/dispatch-webhook');
    await dispatchEvento('confirmacao_pendente_created', {
      mensagem_id: mensagemId,
      texto_bruto: msg?.texto_bruto ?? null,
      telefone_from: msg?.telefone_from ?? null,
      midia_mime: msg?.midia_mime ?? null,
      confianca_ia: out.confidence,
      dados_extraidos: out.extracted,
      pendencia_count: pendenciaCount ?? 1,
    });
  } catch {
    // Silencioso — webhook é secundário ao fluxo principal
  }

  // Evento de domínio. Fica FORA do try do webhook de propósito: se o dispatch
  // externo falhar, as automações internas ainda devem reagir.
  if (confirmacaoCriada?.id) {
    const { emitir } = await import('@/lib/events/bus');
    await emitir('confirmacao.aberta', { confirmacaoId: confirmacaoCriada.id, mensagemId });
  }

  return {
    ok: true,
    status: 'classificada',
    confianca: out.confidence,
    kind: out.kind,
    confirmacao: confirmacaoCriada ? { id: confirmacaoCriada.id, pergunta } : null,
  };
}
