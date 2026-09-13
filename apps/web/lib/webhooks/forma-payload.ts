/**
 * Descreve a forma de um JSON até dois níveis: `{from: string, media: {url: string}}`.
 * Só chaves e tipos — nenhum valor sai para o log.
 */
export function formaDoPayload(v: unknown, nivel = 0): unknown {
  if (Array.isArray(v)) return `array(${v.length})`;
  if (v && typeof v === 'object') {
    if (nivel >= 2) return 'object';
    const saida: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v).slice(0, 40)) {
      saida[k] = formaDoPayload(val, nivel + 1);
    }
    return saida;
  }
  return v === null ? 'null' : typeof v;
}
