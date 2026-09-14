/**
 * Valor em reais como o brasileiro digita.
 *
 * O campo de valor era `type="number"`: no Chrome/Android ele recusa
 * "1.250,00" (ponto de milhar) e a vírgula depende do locale do teclado
 * (design review gstack, M5). Agora o campo é texto livre e a leitura mora
 * aqui, num lugar só, com teste.
 *
 * Só o formulário de pagamento usa isto. O importador de CSV
 * (`services/import-pagamentos.ts`) e o classificador mock têm leitura
 * própria, com regras deles — não unificar sem ler os dois.
 */

/**
 * Lê "1.250,00", "1250,00", "1250.00", "R$ 1.250,00" e "1250" como 1250.
 *
 * Regras de desempate, na ordem:
 * - vírgula presente → é o separador decimal; todo ponto é milhar
 *   ("1,250" = 1,25; "1.250,00" = 1250);
 * - só pontos, no padrão de milhar (grupos de 3) → milhar ("1.250" = 1250);
 * - um ponto fora do padrão → decimal ("1250.00" = 1250; "12.5" = 12,5);
 * - nada disso → inválido, `null`. Vazio também é `null`.
 */
export function parseValorBR(texto: string): number | null {
  if (typeof texto !== 'string') return null;
  // Prefixo de moeda e qualquer espaço — `\s` cobre o espaço fino (U+202F)
  // que o Intl põe em "R$ 1.250,00".
  const limpo = texto.replace(/R\$/giu, '').replace(/\s/gu, '');
  if (limpo === '') return null;

  const negativo = limpo.startsWith('-');
  const corpo = negativo ? limpo.slice(1) : limpo;
  if (!/^[\d.,]+$/u.test(corpo)) return null;

  let normalizado: string;
  const virgulas = corpo.split(',').length - 1;
  if (virgulas > 1) return null;
  if (virgulas === 1) {
    normalizado = corpo.replace(/\./gu, '').replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/u.test(corpo)) {
    normalizado = corpo.replace(/\./gu, '');
  } else if (corpo.split('.').length - 1 <= 1) {
    normalizado = corpo;
  } else {
    return null;
  }

  if (!/^\d+(?:\.\d+)?$/u.test(normalizado)) return null;
  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** 1250 → "1.250,00" — o que o campo mostra ao editar. */
export function formatarValorBR(n: number | string | null | undefined): string {
  if (n == null || n === '') return '';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
