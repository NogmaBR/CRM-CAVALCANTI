import { describe, it, expect } from 'vitest';
import {
  validateUploadedFile,
  validateFileMagicBytes,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIMES,
} from './documento';

// ── helpers ────────────────────────────────────────────────────────────────
function bytesToArrayBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]; // %PDF-1.7
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]; // MZ (PE/DOS)
const ELF = [0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00];
const HTML = [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50]; // <!DOCTYP

function fakeFile(opts: { size?: number; type?: string; name?: string } = {}): File {
  const size = opts.size ?? 1024;
  return new File([new Uint8Array(size)], opts.name ?? 'nota.pdf', {
    type: opts.type ?? 'application/pdf',
  });
}

// ── validateUploadedFile ───────────────────────────────────────────────────
describe('validateUploadedFile', () => {
  it('aceita PDF dentro do limite', () => {
    expect(validateUploadedFile(fakeFile()).ok).toBe(true);
  });

  it('aceita todos os MIMEs da whitelist', () => {
    for (const mime of ALLOWED_MIMES) {
      expect(validateUploadedFile(fakeFile({ type: mime })).ok).toBe(true);
    }
  });

  it('rejeita quando não é File (campo vazio no FormData)', () => {
    for (const naoArquivo of [null, undefined, 'texto', 42, {}]) {
      const r = validateUploadedFile(naoArquivo);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/obrigat/iu);
    }
  });

  it('rejeita arquivo vazio', () => {
    const r = validateUploadedFile(fakeFile({ size: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/vazio/iu);
  });

  it('aceita exatamente no limite de 10 MB', () => {
    expect(validateUploadedFile(fakeFile({ size: MAX_FILE_SIZE_BYTES })).ok).toBe(true);
  });

  it('rejeita 1 byte acima do limite', () => {
    const r = validateUploadedFile(fakeFile({ size: MAX_FILE_SIZE_BYTES + 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/10 MB/u);
  });

  it('rejeita MIME fora da whitelist', () => {
    for (const mime of ['application/x-msdownload', 'text/html', 'image/svg+xml', 'application/zip']) {
      const r = validateUploadedFile(fakeFile({ type: mime }));
      expect(r.ok).toBe(false);
    }
  });

  it('rejeita MIME vazio sem quebrar a mensagem', () => {
    const r = validateUploadedFile(fakeFile({ type: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/desconhecido/u);
  });
});

// ── validateFileMagicBytes ─────────────────────────────────────────────────
describe('validateFileMagicBytes — conteúdo bate com o MIME declarado', () => {
  it('aceita cada formato com sua assinatura correta', () => {
    expect(validateFileMagicBytes(bytesToArrayBuffer(PDF), 'application/pdf').ok).toBe(true);
    expect(validateFileMagicBytes(bytesToArrayBuffer(PNG), 'image/png').ok).toBe(true);
    expect(validateFileMagicBytes(bytesToArrayBuffer(JPEG), 'image/jpeg').ok).toBe(true);
    expect(validateFileMagicBytes(bytesToArrayBuffer(WEBP), 'image/webp').ok).toBe(true);
  });

  it('aceita variantes de marcador JPEG (JFIF, EXIF, raw)', () => {
    for (const marker of [0xe0, 0xe1, 0xe8, 0xdb, 0xee]) {
      const jpeg = [0xff, 0xd8, 0xff, marker, 0x00, 0x10, 0x00, 0x00];
      expect(validateFileMagicBytes(bytesToArrayBuffer(jpeg), 'image/jpeg').ok).toBe(true);
    }
  });
});

describe('validateFileMagicBytes — bloqueia o ataque que ele existe pra bloquear', () => {
  it('rejeita executável renomeado para .pdf', () => {
    const r = validateFileMagicBytes(bytesToArrayBuffer(EXE), 'application/pdf');
    expect(r.ok).toBe(false);
  });

  it('rejeita ELF disfarçado de imagem', () => {
    expect(validateFileMagicBytes(bytesToArrayBuffer(ELF), 'image/png').ok).toBe(false);
    expect(validateFileMagicBytes(bytesToArrayBuffer(ELF), 'image/jpeg').ok).toBe(false);
  });

  it('rejeita HTML declarado como PDF (vetor de XSS via storage)', () => {
    expect(validateFileMagicBytes(bytesToArrayBuffer(HTML), 'application/pdf').ok).toBe(false);
  });

  it('rejeita troca de formato entre tipos permitidos (PNG declarado como PDF)', () => {
    expect(validateFileMagicBytes(bytesToArrayBuffer(PNG), 'application/pdf').ok).toBe(false);
    expect(validateFileMagicBytes(bytesToArrayBuffer(PDF), 'image/png').ok).toBe(false);
    expect(validateFileMagicBytes(bytesToArrayBuffer(JPEG), 'image/webp').ok).toBe(false);
  });

  it('rejeita RIFF que não é WebP (ex: WAV de áudio)', () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];
    expect(validateFileMagicBytes(bytesToArrayBuffer(wav), 'image/webp').ok).toBe(false);
  });

  it('rejeita arquivo curto demais para conter assinatura', () => {
    const r = validateFileMagicBytes(bytesToArrayBuffer([0x25, 0x50]), 'application/pdf');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/pequeno/iu);
  });

  it('rejeita MIME fora da whitelist mesmo com bytes válidos (defesa em profundidade)', () => {
    const r = validateFileMagicBytes(bytesToArrayBuffer(PDF), 'application/octet-stream');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/não permitido/u);
  });

  it('não confia em bytes de assinatura que aparecem depois do início', () => {
    const pdfDeslocado = [0x00, 0x00, ...PDF];
    expect(validateFileMagicBytes(bytesToArrayBuffer(pdfDeslocado), 'application/pdf').ok).toBe(false);
  });
});
