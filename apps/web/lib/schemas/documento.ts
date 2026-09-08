import { z } from 'zod';

export const anexoTipoEnum = z.enum(['nota_fiscal', 'comprovante', 'contrato', 'outro']);
export type AnexoTipo = z.infer<typeof anexoTipoEnum>;

export const ANEXO_TIPO_LABELS: Record<AnexoTipo, string> = {
  nota_fiscal: 'Nota fiscal',
  comprovante: 'Comprovante',
  contrato: 'Contrato',
  outro: 'Outro',
};

/** Whitelist alinhado com bucket allowed_mime_types (Task 7.0 migration) */
export const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (batem com bucket file_size_limit)

const uuidRequired = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu, 'ID inválido');

const uuidOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : v))
  .refine(
    (v) =>
      v === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(v),
    'ID inválido',
  );

/** Schema pra create — inclui File validation. File é passado separado do form (via formData.get('file')). */
export const DocumentoMetaCreateSchema = z.object({
  obra_id: uuidRequired,
  pagamento_id: uuidOptional,
  fornecedor_id: uuidOptional,
  tipo: anexoTipoEnum,
  numero_nf: z.string().trim().max(50).optional(),
  chave_acesso_nf: z.string().trim().max(50).optional(),
});

/** Schema pra update (sem file) */
export const DocumentoUpdateSchema = DocumentoMetaCreateSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export type DocumentoMetaCreateInput = z.infer<typeof DocumentoMetaCreateSchema>;
export type DocumentoUpdateInput = z.infer<typeof DocumentoUpdateSchema>;

/** Valida File (browser API) — chamado após parse de metadata. */
export function validateUploadedFile(
  file: unknown,
): { ok: true; file: File } | { ok: false; error: string } {
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo obrigatório' };
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio' };
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Arquivo excede 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
    };
  }
  if (!ALLOWED_MIMES.includes(file.type as (typeof ALLOWED_MIMES)[number])) {
    return {
      ok: false,
      error: `Tipo não suportado: ${file.type || 'desconhecido'}. Use PDF, JPEG, PNG ou WebP.`,
    };
  }
  return { ok: true, file };
}

/**
 * Magic bytes validation (audit MED fix): confirma que o conteúdo do arquivo
 * bate com o MIME declarado. Sem isso, um atacante pode renomear um .exe pra
 * .pdf ou setar Content-Type: application/pdf em curl e passar pela validação
 * de MIME declarado.
 *
 * Assinaturas verificadas (primeiros bytes):
 *   PDF:  %PDF-           → 25 50 44 46 2D
 *   PNG:  \x89 PNG        → 89 50 4E 47 0D 0A 1A 0A
 *   JPEG: FF D8 FF        → FF D8 FF (variantes: E0, E1, E8, DB, etc)
 *   WebP: RIFF ... WEBP   → 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
 *
 * Chamar APÓS validateUploadedFile e ANTES de persistir/subir pro Storage.
 */
export function validateFileMagicBytes(
  buffer: ArrayBuffer,
  declaredMime: string,
): { ok: true } | { ok: false; error: string } {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes.length < 4) {
    return { ok: false, error: 'Arquivo muito pequeno pra validar assinatura' };
  }

  const startsWith = (sig: number[]) => sig.every((byte, i) => bytes[i] === byte);

  switch (declaredMime) {
    case 'application/pdf':
      // %PDF-
      if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: true };
      return { ok: false, error: 'Conteúdo não é um PDF válido (assinatura ausente).' };

    case 'image/png':
      // \x89 P N G \r \n \x1a \n
      if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true };
      return { ok: false, error: 'Conteúdo não é um PNG válido (assinatura ausente).' };

    case 'image/jpeg':
      // FF D8 FF — variantes: E0/JFIF, E1/EXIF, E8, DB, EE, etc
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ok: true };
      return { ok: false, error: 'Conteúdo não é um JPEG válido (assinatura ausente).' };

    case 'image/webp':
      // RIFF ???? WEBP
      if (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      ) {
        return { ok: true };
      }
      return { ok: false, error: 'Conteúdo não é um WebP válido (assinatura ausente).' };

    default:
      // MIME não-whitelist já barra em validateUploadedFile; defesa em profundidade.
      return { ok: false, error: `MIME ${declaredMime} não permitido.` };
  }
}

/** Formata bytes → "1.2 MB" pt-BR */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
