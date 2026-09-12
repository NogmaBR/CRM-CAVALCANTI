/**
 * Checagem barata de UUID para rotas `[id]`.
 *
 * Sem ela, `/obras/qualquer-coisa` chegava ao Postgres, que recusava o cast
 * para uuid e a página caía na fronteira de erro ("Algo deu errado") em vez
 * de responder 404. Não valida versão nem variante de propósito: o objetivo
 * é só separar "não é um id" de "é um id que talvez não exista".
 */
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function pareceUuid(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && RE_UUID.test(valor);
}
