/**
 * Cor automática de uma categoria (etapa) sem cor cadastrada — a MESMA regra
 * do app (`apps/web/lib/categorias/cor.ts`, que tem teste comparando os dois).
 *
 * Determinística pelo id: a mesma etapa tem a mesma cor em todo gráfico e
 * tela, e o script `colorir-categorias.mjs` grava exatamente esta cor no
 * cadastro para ela deixar de ser "automática".
 */
export const PALETA_AUTO = [
  '#3C4AA8', // azul
  '#C8761A', // laranja
  '#1F7A4D', // verde escuro
  '#8E3B8E', // roxo
  '#0E7C86', // turquesa
  '#B3352B', // tijolo
  '#6B5B2E', // marrom
  '#4F6D8A', // azul aço
];

/** FNV-1a de 32 bits: barato, estável, sem dependência. */
export function hashTexto(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function corAutomatica(id) {
  return PALETA_AUTO[hashTexto(String(id)) % PALETA_AUTO.length];
}
