/**
 * Resposta a uma pergunta de múltipla escolha no WhatsApp ("De qual obra é
 * esse arquivo? 1) Aguirre 2) Garibaldi…").
 *
 * Mesma postura de `interpretarResposta`: **conservador**. Escolher a obra
 * errada arquiva o documento no lugar errado; não escolher só deixa a
 * pergunta aberta por mais um turno. Então só vale resposta inequívoca:
 *
 *   - o número (com o ruído usual: "2)", "opção 2", "a 2");
 *   - o ordinal/cardinal por extenso ("dois", "segunda");
 *   - o nome ou apelido de UMA opção, com no máximo uma partícula em volta
 *     ("da Garibaldi", "é da EJ");
 *   - número e nome juntos, se concordarem.
 *
 * Qualquer outra coisa — dois nomes, número fora da lista, frase longa — é
 * `null` e a mensagem segue o fluxo normal.
 */

export interface Opcao {
  n: number;
  id: string;
  nome: string;
  apelidos?: string[];
}

const CARDINAIS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

const ORDINAIS: Record<string, number> = {
  primeira: 1,
  primeiro: 1,
  segunda: 2,
  segundo: 2,
  terceira: 3,
  terceiro: 3,
  quarta: 4,
  quarto: 4,
  quinta: 5,
  quinto: 5,
  sexta: 6,
  sexto: 6,
  setima: 7,
  setimo: 7,
  oitava: 8,
  oitavo: 8,
  nona: 9,
  nono: 9,
  decima: 10,
  decimo: 10,
};

/** Palavras que podem cercar a resposta sem mudar o sentido. */
const PARTICULAS = new Set([
  'a',
  'o',
  'e',
  'é',
  'eh',
  'da',
  'do',
  'de',
  'na',
  'no',
  'pra',
  'para',
  'obra',
  'opcao',
  'numero',
  'n',
  'essa',
  'esse',
  'aquela',
  'aquele',
]);

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

/** Texto curto para a pergunta: "1) Aguirre\n2) Garibaldi". */
export function formatarOpcoes(opcoes: Opcao[]): string {
  return opcoes.map((o) => `${o.n}) ${o.nome}`).join('\n');
}

export function interpretarEscolha(
  texto: string | null | undefined,
  opcoes: Opcao[],
): Opcao | null {
  if (!texto || opcoes.length === 0) return null;
  const n = normalizar(texto);
  if (!n) return null;

  const palavras = n.split(' ');
  // Frase longa não é escolha — é conversa.
  if (palavras.length > 6) return null;

  const porNumero = new Map(opcoes.map((o) => [o.n, o]));

  // 1. Números e numerais por extenso presentes no texto.
  const numeros = new Set<number>();
  for (const p of palavras) {
    if (/^\d{1,2}$/u.test(p)) numeros.add(Number(p));
    else if (CARDINAIS[p] != null) numeros.add(CARDINAIS[p] as number);
    else if (ORDINAIS[p] != null) numeros.add(ORDINAIS[p] as number);
  }
  if (numeros.size > 1) return null;
  const numero = numeros.size === 1 ? [...numeros][0] : null;
  const porNum = numero != null ? (porNumero.get(numero) ?? null) : null;
  if (numero != null && !porNum) return null; // "12" com três opções

  // 2. Nomes e apelidos: cada opção casa se o nome inteiro aparece como
  //    sequência de palavras. Duas opções casando é ambíguo.
  const casadas = opcoes.filter((o) => {
    const formas = [o.nome, ...(o.apelidos ?? [])].map(normalizar).filter(Boolean);
    return formas.some((f) => ` ${n} `.includes(` ${f} `));
  });
  if (casadas.length > 1) return null;
  const porNome = casadas[0] ?? null;

  if (porNum && porNome) return porNum.id === porNome.id ? porNum : null;

  const escolhida = porNum ?? porNome;
  if (!escolhida) return null;

  // 3. O que sobrou fora do número/nome tem que ser partícula.
  const formasDaEscolhida = [escolhida.nome, ...(escolhida.apelidos ?? [])].map(normalizar);
  let resto = ` ${n} `;
  for (const f of formasDaEscolhida) {
    if (f) resto = resto.replace(` ${f} `, ' ');
  }
  const sobras = resto
    .trim()
    .split(' ')
    .filter((p) => p.length > 0)
    .filter((p) => !/^\d{1,2}$/u.test(p) && CARDINAIS[p] == null && ORDINAIS[p] == null)
    .filter((p) => !PARTICULAS.has(p));
  if (sobras.length > 0) return null;

  return escolhida;
}
