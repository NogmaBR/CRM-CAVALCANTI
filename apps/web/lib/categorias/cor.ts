/**
 * A cor de uma categoria (etapa) em qualquer gráfico ou tabela.
 *
 * Cadastrada → usa a cadastrada. Sem cor → uma cor AUTOMÁTICA e
 * determinística pelo id, para a mesma etapa sair igual em todo lugar
 * (donut da obra, donut do painel, swatch da tabela). A regra é copiada em
 * `scripts/lib/cor-categoria-core.mjs` (o script que grava a cor no
 * cadastro); o teste garante que as duas dão o mesmo resultado.
 */

export const PALETA_AUTO = [
  '#3C4AA8',
  '#C8761A',
  '#1F7A4D',
  '#8E3B8E',
  '#0E7C86',
  '#B3352B',
  '#6B5B2E',
  '#4F6D8A',
] as const;

/** FNV-1a de 32 bits. */
export function hashTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function corAutomatica(id: string): string {
  return PALETA_AUTO[hashTexto(id) % PALETA_AUTO.length] ?? PALETA_AUTO[0];
}

export function corDaCategoria(cat: { id: string; cor?: string | null }): string {
  return cat.cor?.trim() ? cat.cor : corAutomatica(cat.id);
}
