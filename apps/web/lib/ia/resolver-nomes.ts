/**
 * Nome citado → registro do CRM, em código, não no modelo.
 *
 * O classificador recebia a lista de obras e fornecedores com UUID e
 * devolvia o UUID escolhido. No primeiro contato real (2026-09-16) ele leu
 * "Mathias Velho" corretamente — a pergunta de confirmação dizia Mathias
 * Velho — e devolveu o UUID de **Maximiliano**. UUID válido, fornecedor
 * errado, e a barreira que descartava ids inexistentes não pega isso.
 * Modelo de linguagem copia UUID mal; copia nome bem. Então o modelo devolve
 * o nome, e quem casa com o cadastro é esta função — determinística e
 * testável.
 *
 * Regras, da mais forte à mais fraca, parando na primeira que der um único
 * candidato:
 *   1. nome ou apelido iguais (sem acento, caixa, pontuação);
 *   2. os tokens de um contidos no outro ("Mathias Velho" ⊂ "Ferragem Mathias
 *      Velho"), ou o primeiro token de um é prefixo (3+) do do outro
 *      ("Max" → "Maximiliano");
 * Dois candidatos na mesma regra = ambíguo = não resolve. É melhor perguntar
 * do que lançar no fornecedor errado.
 */

export interface Nomeado {
  id: string;
  nome: string;
  apelidos?: string[] | null;
}

export function normalizarNome(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalizarNome(s).split(' ').filter(Boolean);
}

function parece(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const subconjunto = (x: string[], y: string[]) => x.every((t) => y.includes(t));
  if (subconjunto(ta, tb) || subconjunto(tb, ta)) return true;
  const pa = ta[0] as string;
  const pb = tb[0] as string;
  const menor = pa.length <= pb.length ? pa : pb;
  const maior = pa.length <= pb.length ? pb : pa;
  return menor.length >= 3 && maior.startsWith(menor);
}

/** Devolve o único registro que casa com o nome, ou `undefined`. */
export function resolverPorNome<T extends Nomeado>(
  nome: string | null | undefined,
  lista: readonly T[],
): T | undefined {
  const n = normalizarNome(nome);
  if (!n) return undefined;

  const exatos = lista.filter(
    (x) => normalizarNome(x.nome) === n || (x.apelidos ?? []).some((a) => normalizarNome(a) === n),
  );
  if (exatos.length === 1) return exatos[0];
  if (exatos.length > 1) return undefined;

  const parecidos = lista.filter(
    (x) => parece(x.nome, n) || (x.apelidos ?? []).some((a) => parece(a, n)),
  );
  return parecidos.length === 1 ? parecidos[0] : undefined;
}
