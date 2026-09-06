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
export const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

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
    (v) => v === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(v),
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
export function validateUploadedFile(file: unknown): { ok: true; file: File } | { ok: false; error: string } {
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo obrigatório' };
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio' };
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `Arquivo excede 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)` };
  }
  if (!ALLOWED_MIMES.includes(file.type as (typeof ALLOWED_MIMES)[number])) {
    return { ok: false, error: `Tipo não suportado: ${file.type || 'desconhecido'}. Use PDF, JPEG, PNG ou WebP.` };
  }
  return { ok: true, file };
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
