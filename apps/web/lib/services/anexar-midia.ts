import 'server-only';
import { logger } from '@/lib/log';
import type { DadosExtraidos } from '@/lib/schemas/dados-extraidos';
import {
  downloadDocumentBytes,
  makeStoragePath,
  sha256Hex,
  uploadDocumentBuffer,
} from '@/lib/storage/documents';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger('anexar_midia');

type Client = SupabaseClient<Database>;
type AnexoTipo = Database['public']['Enums']['anexo_tipo'];

const MIMES_DOCUMENTO = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export type ResultadoAnexo =
  | { ok: true; documentoId: string; jaExistia: boolean }
  | { ok: false; motivo: 'sem_midia' | 'mime_nao_suportado' | 'midia_nao_lida' | 'erro_insert' };

/**
 * A foto (ou PDF) que veio no WhatsApp e foi confirmada com "SIM" vira uma
 * linha em `documentos`, ligada ao pagamento.
 *
 * Até a revisão gstack de 2026-09-12 a mídia só ficava em
 * `mensagens_whats.midia_storage_path`: o pagamento nascia "sem documento" e
 * a automação de cobrança mandaria WhatsApp ao fornecedor pedindo a nota que
 * ele acabou de enviar (CEO review, G5).
 *
 * Idempotente pelo hash do conteúdo (`idx_documentos_hash`, único entre
 * vivos): confirmar duas vezes, ou o painel e o WhatsApp confirmarem a mesma
 * mensagem, não duplica. Nunca lança — falha aqui vira log e o pagamento
 * continua confirmado; a nota pode ser anexada à mão em `/documentos/novo`.
 */
export async function anexarMidiaComoDocumento(
  supabase: Client,
  args: {
    storagePath: string | null;
    mime: string | null;
    pagamentoId: string;
    obraId: string;
    fornecedorId: string | null;
    dados: DadosExtraidos | null;
    userId: string | null;
  },
): Promise<ResultadoAnexo> {
  if (!args.storagePath) return { ok: false, motivo: 'sem_midia' };
  const mime = args.mime?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!MIMES_DOCUMENTO.has(mime)) return { ok: false, motivo: 'mime_nao_suportado' };

  try {
    const bytes = await downloadDocumentBytes(args.storagePath);
    if (!bytes) {
      log.aviso('midia_nao_lida', { storage_path: args.storagePath });
      return { ok: false, motivo: 'midia_nao_lida' };
    }
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const hash = sha256Hex(buffer);

    // Já existe um documento vivo com este conteúdo? Então é reconfirmação.
    const { data: existente } = await supabase
      .from('documentos')
      .select('id')
      .eq('hash_sha256', hash)
      .is('deleted_at', null)
      .maybeSingle();
    if (existente) return { ok: true, documentoId: existente.id, jaExistia: true };

    const nome = args.storagePath.split('/').pop() || `midia.${mime.split('/')[1] ?? 'bin'}`;
    const { data: novo, error } = await supabase
      .from('documentos')
      .insert({
        obra_id: args.obraId,
        pagamento_id: args.pagamentoId,
        fornecedor_id: args.fornecedorId,
        tipo: tipoDoDocumento(args.dados?.tipo_documento, mime),
        nome_arquivo: nome,
        mime_type: mime,
        tamanho_bytes: bytes.byteLength,
        storage_path: 'pending',
        numero_nf: args.dados?.numero_nf ?? null,
        hash_sha256: hash,
        criado_por_user_id: args.userId,
      })
      .select('id')
      .single();

    if (error || !novo) {
      if (error?.code === '23505') {
        // Corrida perdida: o outro confirmador já anexou.
        const { data: vencedor } = await supabase
          .from('documentos')
          .select('id')
          .eq('hash_sha256', hash)
          .is('deleted_at', null)
          .maybeSingle();
        if (vencedor) return { ok: true, documentoId: vencedor.id, jaExistia: true };
      }
      log.erro('insert_documento_falhou', { pagamentoId: args.pagamentoId, erro: error });
      return { ok: false, motivo: 'erro_insert' };
    }

    // Copia para o caminho canônico de documentos (`<obra>/<documento>/<arquivo>`);
    // a policy de Storage por ownership espera esse prefixo. O objeto original
    // em `whatsapp/` fica para a retenção cuidar.
    const destino = makeStoragePath(args.obraId, novo.id, nome);
    try {
      await uploadDocumentBuffer(destino, buffer, mime);
    } catch (err) {
      // Sem cópia, apontamos para o objeto original: o documento continua
      // abrindo, só não está no prefixo canônico. Melhor que órfão.
      log.aviso('copia_midia_falhou', { documentoId: novo.id, err });
      await supabase
        .from('documentos')
        .update({ storage_path: args.storagePath })
        .eq('id', novo.id);
      return { ok: true, documentoId: novo.id, jaExistia: false };
    }
    await supabase.from('documentos').update({ storage_path: destino }).eq('id', novo.id);
    return { ok: true, documentoId: novo.id, jaExistia: false };
  } catch (err) {
    log.erro('anexar_midia_falhou', { pagamentoId: args.pagamentoId, err });
    return { ok: false, motivo: 'erro_insert' };
  }
}

function tipoDoDocumento(declarado: DadosExtraidos['tipo_documento'], mime: string): AnexoTipo {
  if (declarado) return declarado;
  return mime === 'application/pdf' ? 'nota_fiscal' : 'comprovante';
}
