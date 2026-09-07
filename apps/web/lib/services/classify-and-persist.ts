import 'server-only';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';
import { getClassifier, type ClassifierInput } from '@/lib/ia/classifier';

const CONFIANCA_AUTO_APROVAR = 0.85;

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
 * NOTA: este service não faz DOWNLOAD da mídia (URL do UAZAPI expira). O
 * download+upload pro Storage é responsabilidade da task 8.x quando UAZAPI
 * for provisionado. Por enquanto persistimos apenas midia_mime.
 *
 * Chamado pelo webhook após upsert em mensagens_whats.
 */
export async function classifyAndPersist(mensagemId: string): Promise<
  | { ok: true; status: string; confianca: number; kind: string }
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
    .select('id, telefone_from, texto_bruto, midia_mime, midia_storage_path')
    .eq('id', mensagemId)
    .single();
  if (msgErr || !msg) return { ok: false, error: `mensagem ${mensagemId} não encontrada` };

  await supabase.from('mensagens_whats').update({ status: 'processando' }).eq('id', mensagemId);

  const [obrasRes, fornRes] = await Promise.all([
    supabase.from('obras').select('id, nome').is('deleted_at', null).eq('status', 'ativa'),
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null),
  ]);

  const input: ClassifierInput = {
    texto: msg.texto_bruto,
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
    return { ok: true, status: 'erro', confianca: out.confidence, kind: out.kind };
  }

  const autoAprovar =
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

    return { ok: true, status: 'confirmada', confianca: out.confidence, kind: out.kind };
  }

  // Caso default: confirmação pendente
  const pergunta =
    out.perguntaConfirmacao ??
    'Recebi sua mensagem mas preciso confirmar os dados antes de lançar. Pode revisar no painel?';

  await supabase.from('confirmacoes_pendentes').insert({
    mensagem_id: mensagemId,
    pergunta_enviada: pergunta,
  });

  await supabase
    .from('mensagens_whats')
    .update({
      status: 'classificada',
      confianca_ia: out.confidence,
      dados_extraidos: out.extracted,
    })
    .eq('id', mensagemId);

  // Dispara email pra gestores — best-effort. Import dinâmico pra evitar
  // ciclo de deps (send-email importa data/notificacoes, que não depende
  // deste service). Falha silenciosa loga em notificacoes_email.erro.
  try {
    const { count: pendenciaCount } = await supabase
      .from('confirmacoes_pendentes')
      .select('*', { count: 'exact', head: true })
      .eq('resolvida', false);

    const obraHint = out.extracted.obra_id
      ? (obrasRes.data ?? []).find((o) => o.id === out.extracted.obra_id)?.nome ?? null
      : null;

    const { sendPendenciaNovaEmail } = await import('@/lib/services/send-email');
    await sendPendenciaNovaEmail({
      texto_bruto: msg.texto_bruto,
      midia_mime: msg.midia_mime,
      valor_estimado: out.extracted.valor ?? null,
      obra_hint: obraHint,
      confidence: out.confidence,
      pendencia_count: pendenciaCount ?? 1,
    });
  } catch {
    // Silencioso — email é secundário ao fluxo principal
  }

  return { ok: true, status: 'classificada', confianca: out.confidence, kind: out.kind };
}
