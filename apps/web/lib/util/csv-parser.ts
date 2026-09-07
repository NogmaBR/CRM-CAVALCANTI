/**
 * Minimal RFC 4180 CSV parser — zero deps. Aceita:
 *   - separador vírgula OU ponto-vírgula (auto-detect via primeira linha)
 *   - BOM UTF-8 no início
 *   - CRLF ou LF line endings
 *   - Campos quoted (com escape "" pra aspas literais)
 *   - Newline dentro de campo quoted
 *
 * Retorna: { headers: string[], rows: string[][] } — headers da primeira
 * linha, rows sem headers. Vazio se input vazio ou só headers.
 *
 * NÃO usa PapaParse (600KB) — dataset típico é <500 linhas, parser é
 * suficiente + zero footprint.
 */

const BOM = '﻿';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  separator: ',' | ';';
}

export function parseCsv(input: string): ParsedCsv {
  const cleaned = input.startsWith(BOM) ? input.slice(1) : input;
  const separator = detectSeparator(cleaned);

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const c = cleaned[i]!;
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"' && field === '') {
        inQuotes = true;
      } else if (c === separator) {
        current.push(field);
        field = '';
      } else if (c === '\r' && next === '\n') {
        current.push(field);
        rows.push(current);
        current = [];
        field = '';
        i += 1;
      } else if (c === '\n' || c === '\r') {
        current.push(field);
        rows.push(current);
        current = [];
        field = '';
      } else {
        field += c;
      }
    }
  }

  // Última linha sem newline terminal
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  if (rows.length === 0) return { headers: [], rows: [], separator };
  const [headers, ...body] = rows;
  return {
    headers: (headers ?? []).map((h) => h.trim()),
    rows: body.filter((r) => r.some((cell) => cell.trim().length > 0)),
    separator,
  };
}

function detectSeparator(input: string): ',' | ';' {
  const firstLine = input.split(/\r?\n/u, 1)[0] ?? '';
  const commas = (firstLine.match(/,/gu) ?? []).length;
  const semis = (firstLine.match(/;/gu) ?? []).length;
  return semis > commas ? ';' : ',';
}

/** Converte parsed rows em array de objetos usando headers como keys. */
export function rowsToObjects(parsed: ParsedCsv): Array<Record<string, string>> {
  return parsed.rows.map((row) => {
    const obj: Record<string, string> = {};
    parsed.headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '').trim();
    });
    return obj;
  });
}
