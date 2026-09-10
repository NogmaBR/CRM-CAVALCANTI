import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Log estruturado — uma linha JSON por evento.
 *
 * ## O problema que resolve
 *
 * Até a Fase 5.2, tudo era `console.error('[automacao:x] falhou:', msg)`:
 * texto livre, com o contexto dentro da string. Procurar "todas as falhas da
 * regra de cobrança na semana passada" era impossível, e seguir uma mensagem
 * do WhatsApp do webhook até a resposta exigia adivinhar qual linha era de
 * qual mensagem.
 *
 * Agora cada linha é um objeto com campos fixos:
 *
 *   { "t": "...", "nivel": "erro", "area": "fila", "evento": "arquivada",
 *     "fila": "whatsapp_outbound", "msgId": 42, "correlacao": "ABC123" }
 *
 * A Vercel indexa JSON que sai no stdout/stderr, então `nivel:erro area:fila`
 * vira uma busca no painel — sem servidor de log novo.
 *
 * ## Correlação
 *
 * `comContexto()` guarda campos numa `AsyncLocalStorage`, e todo log emitido
 * dentro daquela chamada (inclusive em funções profundas, em `await`s, em
 * `catch`) sai com esses campos. É assim que a mesma mensagem do WhatsApp
 * atravessa webhook → fila → classificador → resposta com **um** id
 * (`correlacao`), sem passar parâmetro por dez funções.
 *
 * Contextos aninham e o de dentro vence no conflito de chave.
 *
 * ## O que este módulo NUNCA faz
 *
 * - **Lançar.** Log que quebra o caminho que estava registrando é pior que
 *   log nenhum. Payload circular, BigInt, `toJSON` que explode — tudo cai no
 *   fallback.
 * - **Imprimir telefone inteiro.** Qualquer campo chamado `telefone` (ou
 *   terminado em `Telefone`) sai mascarado. LGPD, e o log da Vercel é lido
 *   por mais gente que o banco.
 * - **Imprimir credencial.** Não há mascaramento automático para isso, porque
 *   não há como adivinhar o nome do campo — a regra é não passar.
 */

export type Nivel = 'erro' | 'aviso' | 'info';

export type Campos = Record<string, unknown>;

const contexto = new AsyncLocalStorage<Campos>();

/** Strings maiores que isto são cortadas: a Vercel trunca a linha em ~4 KB. */
const MAX_TEXTO = 1500;

/**
 * Roda `fn` com `campos` anexados a todo log emitido lá dentro.
 *
 * Aninha: o contexto novo é a união com o de fora, e o de dentro vence.
 */
export function comContexto<T>(campos: Campos, fn: () => T): T {
  const atual = contexto.getStore() ?? {};
  return contexto.run({ ...atual, ...campos }, fn);
}

/** O contexto vigente, ou `{}` fora de qualquer `comContexto`. */
export function contextoAtual(): Campos {
  return { ...(contexto.getStore() ?? {}) };
}

/**
 * Mascara um telefone para log: mantém os 4 últimos dígitos.
 *
 * `5551999998888` → `*********8888`. Quatro dígitos bastam para o gestor
 * reconhecer de quem é, e não bastam para ninguém discar.
 */
export function mascararTelefone(valor: unknown): string {
  const digitos = String(valor ?? '').replace(/\D/gu, '');
  if (digitos.length <= 4) return '***';
  return `${'*'.repeat(digitos.length - 4)}${digitos.slice(-4)}`;
}

function ehCampoDeTelefone(chave: string): boolean {
  return chave === 'telefone' || /Telefone$/u.test(chave) || chave === 'from';
}

/**
 * Deixa um valor seguro para virar JSON: Error vira `{nome, mensagem}`,
 * strings longas são cortadas, telefone é mascarado, BigInt vira string.
 *
 * Profundidade limitada: log não é dump de estado.
 */
function sanear(valor: unknown, chave = '', profundidade = 0): unknown {
  if (valor === null || valor === undefined) return valor;

  if (ehCampoDeTelefone(chave)) return mascararTelefone(valor);

  if (valor instanceof Error) {
    return { nome: valor.name, mensagem: cortar(valor.message) };
  }

  switch (typeof valor) {
    case 'string':
      return cortar(valor);
    case 'number':
    case 'boolean':
      return valor;
    case 'bigint':
      return valor.toString();
    case 'function':
    case 'symbol':
      return undefined;
    default:
      break;
  }

  if (profundidade >= 3) return '[...]';

  if (Array.isArray(valor)) {
    return valor.slice(0, 20).map((v) => sanear(v, '', profundidade + 1));
  }

  const saida: Campos = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    const limpo = sanear(v, k, profundidade + 1);
    if (limpo !== undefined) saida[k] = limpo;
  }
  return saida;
}

function cortar(texto: string): string {
  return texto.length > MAX_TEXTO ? `${texto.slice(0, MAX_TEXTO)}…` : texto;
}

/**
 * Emite uma linha. Prefira `logger(area)`, que fixa a área.
 *
 * A ordem dos campos é deliberada: os fixos primeiro, o contexto depois, os
 * campos da chamada por último — assim uma chamada pode sobrescrever o que
 * veio do contexto, mas nunca `t`, `nivel`, `area`, `evento`.
 */
export function registrar(nivel: Nivel, area: string, evento: string, campos?: Campos): void {
  const linha: Campos = {
    ...(sanear(contextoAtual()) as Campos),
    ...(campos ? (sanear(campos) as Campos) : {}),
  };
  // Os quatro fixos não podem ser sobrescritos por contexto nem por campos.
  const ordenada: Campos = { t: new Date().toISOString(), nivel, area, evento };
  for (const [k, v] of Object.entries(linha)) {
    if (!(k in ordenada)) ordenada[k] = v;
  }

  let texto: string;
  try {
    texto = JSON.stringify(ordenada);
  } catch {
    // Alguma coisa escapou do `sanear` (um getter que lança, por exemplo).
    // A linha mínima ainda sai — perder o evento seria pior que perder o
    // detalhe.
    texto = JSON.stringify({ t: ordenada.t, nivel, area, evento, detalhe: '[não serializável]' });
  }

  // `error` para erro e `warn` para aviso: a Vercel usa o stream para colorir
  // e filtrar, e alertas externos costumam olhar só o stderr.
  if (nivel === 'erro') console.error(texto);
  else if (nivel === 'aviso') console.warn(texto);
  else console.log(texto);
}

export interface Logger {
  erro: (evento: string, campos?: Campos) => void;
  aviso: (evento: string, campos?: Campos) => void;
  info: (evento: string, campos?: Campos) => void;
}

/**
 * Um logger com a área fixa. Uma por módulo, no topo do arquivo:
 *
 *   const log = logger('fila');
 *   log.erro('arquivada', { fila, msgId, tentativas });
 */
export function logger(area: string): Logger {
  return {
    erro: (evento, campos) => registrar('erro', area, evento, campos),
    aviso: (evento, campos) => registrar('aviso', area, evento, campos),
    info: (evento, campos) => registrar('info', area, evento, campos),
  };
}
