import { describe, expect, it } from 'vitest';
import { mimeArquivavel } from './mime-arquivavel';

describe('mimeArquivavel', () => {
  it('aceita foto, PDF, vídeo, áudio, planilha, Word, DWG e zip', () => {
    for (const m of [
      'image/jpeg',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'audio/ogg; codecs=opus',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'image/vnd.dwg',
      'application/zip',
      'application/octet-stream',
    ]) {
      expect(mimeArquivavel(m), m).toBe(true);
    }
  });

  it('recusa executável, script, html e vazio', () => {
    for (const m of [
      'application/x-msdownload',
      'application/x-sh',
      'text/javascript',
      'text/html',
      'application/vnd.android.package-archive',
      '',
      null,
      'semBarra',
    ]) {
      expect(mimeArquivavel(m), String(m)).toBe(false);
    }
  });
});
