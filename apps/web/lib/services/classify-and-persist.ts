import 'server-only';
import { type ClassifierInput, getClassifier } from '@/lib/ia/classifier';
import { logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';

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
 * mídia já chega como `midia_storage_path`, e o áudio já chega transcrito em
 * `texto_transcrito`.
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
    .select('id, telefone_from, texto_bruto, texto_transcrito, midia_mime, midia_storage_path')
    .eq('id', mensagemId)
    .single();
  if (msgErr || !msg) return { ok: false, error: `mensagem ${mensagemId} não encontrada` };

  await supabase.from('mensagens_whats').update({ status: 'processando' }).eq('id', mensagemId);

  const [obrasRes, fornRes] = await Promise.all([
    supabase.from('obras').select('id, nome').is('deleted_at', null).eq('status', 'ativa'),
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null),
  ]);

  const input: ClassifierInput = {
    // Áudio chega com `texto_bruto` nulo: quem tem o conteúdo é a transcrição.
    // Sem este fallback todo áudio caía direto em `nao_identificado`.
    texto: msg.texto_bruto ?? msg.texto_transcrito,
    midiaUrl: null, // hoje não baixamos; ver nota no header
    midiaMime: msg.midia_mime,
    telefone: msg.telefone_from,
    contexto: {
      obrasAtivas: (obrasRes.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
      fornecedoresConhecidos: (fornRes.data ?? []).map((f) => ({ id: f.id, nome: f.nome })),
    },
  };

  const classifier = await getClassifier();
  const out = await classifier.classify(input);

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

  const autoAprovar =
    autoAprovacaoLigada() &&
    out.kind === 'pagamento_completo' &&
    out.confidence >= CONFIANCA_AUTO_APROVAR &&
    out.extracted.valor != null &&
    out.extracted.obra_id != null;

  if (autoAprovar) {
    const insertPagto = await supabase
      .from('pagamentos')
      .insert({
        obra_id: out.extracted.obra_id!,
        fornecedor_id: out.extracted.fornecedor_id ?? null,
        valor: out.extracted.valor!,
        data_pagamento: out.extracted.data_pagamento ?? new Date().toISOString().slice(0, 10),
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
          erro_msg: `insert pagamento falhou: ${insertPagto.error.message}`,
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

  // Caso default: confirmação pendente
  const pergunta =
    out.perguntaConfirmacao ??
    'Recebi sua mensagem mas preciso confirmar os dados antes de lançar. Pode revisar no painel?';

  const { data: confirmacaoCriada, error: erroConfirmacao } = await supabase
    .from('confirmacoes_pendentes')
    .insert({
      mensagem_id: mensagemId,
      pergunta_enviada: pergunta,
    })
    .select('id')
    .single();

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
      texto_bruto: msg.texto_bruto,
      telefone_from: msg.telefone_from,
      midia_mime: msg.midia_mime,
      confianca_ia: out.confidence,
      dados_extraidos: out.extracted,
      pendencia_count: pendenciaCount ?? 1,
    });
  } catch {
    // Silencioso — webhook é secundário ao fluxo principal
  }

  return {
    ok: true,
    status: 'classificada',
    confianca: out.confidence,
    kind: out.kind,
    confirmacao: confirmacaoCriada ? { id: confirmacaoCriada.id, pergunta } : null,
  };
}
