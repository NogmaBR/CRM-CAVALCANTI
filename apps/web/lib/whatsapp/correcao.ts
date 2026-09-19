import { type Nomeado, normalizarNome, resolverPorNome } from '@/lib/ia/resolver-nomes';

/**
 * Correção e desfazer, reconhecidos por código antes de qualquer modelo.
 *
 * Na rodada de 17/09, "nao, e outra obra?" foi para o assistente (que listou
 * as obras), "Não é na Garibaldi, é em outra obra" virou anotação no diário e
 * "Cancela isso" / "Desfaz, não guarda" viraram "não entendi". Nenhuma dessas
 * é lançamento, pergunta nem conversa: são a pessoa **corrigindo** o que o
 * agente acabou de fazer ou perguntar. Aqui ficam os padrões — puros, com
 * teste — que o roteador consulta quando há uma pendência ou uma ação
 * recente por perto.
 *
 * Mesma postura conservadora do resto: o que não bate num padrão claro segue
 * o fluxo de sempre. O custo de errar é assimétrico — corrigir o campo errado
 * grava dado errado; não reconhecer só deixa a pergunta aberta.
 */

/** Para casar padrões de palavras: sem acento, sem pontuação (igual ao dos nomes). */
function normalizar(texto: string): string {
  return normalizarNome(texto);
}

/** Para ler número e data: sem acento e minúsculo, mas com ".", ",", "/" e "$". */
function normalizarLeve(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

/** "não", "nao", "errado", "na verdade", "troca", "é na", "o valor é"… */
const INICIO_DE_CORRECAO =
  /^(?:nao|não|n|errado|ta errado|esta errado|na verdade|troca|troque|muda|mude|corrige|corrija|arruma|ajusta|e na|e da|e do|e no|e o|e a|foi na|foi da|foi no|o valor|valor|fornecedor|a obra|obra|a data|data|foi dia|foi em|nao e|nao foi|nao era)\b/u;

/** "…é outra obra", "…é a inox", "…valor certo é" no meio da frase. */
const MEIO_DE_CORRECAO =
  /\b(?:outra obra|obra errada|valor errado|fornecedor errado|data errada|e outra|e da outra|na outra)\b/u;

export function pareceCorrecao(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = normalizar(texto);
  if (!t) return false;
  return INICIO_DE_CORRECAO.test(t) || MEIO_DE_CORRECAO.test(t);
}

/** "desfaz", "cancela isso", "apaga esse", "não era pra guardar", "tira isso". */
const DESFAZER =
  /^(?:\w+[,!]?\s+){0,2}(?:desfaz|desfazer|desfaça|volta atras|volta isso|cancela (?:isso|esse|essa|isto|este|esta|o ultimo|a ultima|o lancamento|a foto|o arquivo|a anotacao)|apaga (?:isso|esse|essa|isto|este|esta|o ultimo|a ultima|a foto|o arquivo|a anotacao)|tira (?:isso|esse|essa|isto|este|esta|a foto|o arquivo)|remove (?:isso|esse|essa|isto)|nao era pra (?:guardar|lancar|anotar|salvar|gravar)|nao era para (?:guardar|lancar|anotar|salvar|gravar)|nao guarda|nao lanca|nao anota|nao salva|nao grava)\b/u;

export function pareceDesfazer(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = normalizar(texto);
  return DESFAZER.test(t);
}

/** "esquece", "deixa pra lá", "cancela" dentro de uma correção = não quer mais. */
const CANCELAR =
  /\b(?:esquece|esquecer|deixa pra la|deixa para la|cancela|cancelar|nao quero mais|nao precisa)\b/u;

export interface PatchDeCorrecao {
  obra?: { id: string; nome: string };
  fornecedor?: { id: string; nome: string };
  fornecedorNomeNovo?: string;
  valor?: number;
  data?: string;
  descricao?: string;
  cancelar?: boolean;
}

/** "1.200,50", "1200", "R$ 350", "350 reais", "350,00". */
const VALOR =
  /(?:r\$\s*|valor(?:\s+certo|\s+correto)?\s+(?:e|eh|foi|de)\s*|(?:foi|foram|sao|e|eh|custou|deu)\s+)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d/h:%])(?:\s*(?:reais|real|conto|pila))?\b/u;
const VALOR_SOLTO =
  /^(?:\D*)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto|pila)\b/u;

function lerValor(bruto: string): number | undefined {
  // Formato pt-BR: ponto de milhar, vírgula decimal. "1200.50" (ponto
  // decimal) também aceito quando só há um ponto e duas casas.
  let s = bruto;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/u.test(s)) s = s.replace(/\./gu, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/u.test(s)) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** "dia 15", "15/09", "ontem", "hoje", "anteontem" → YYYY-MM-DD. */
function lerData(t: string, hoje: string): string | undefined {
  const base = new Date(`${hoje}T12:00:00Z`);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (/\bhoje\b/u.test(t)) return hoje;
  if (/\banteontem\b/u.test(t)) return iso(new Date(base.getTime() - 2 * 86_400_000));
  if (/\bontem\b/u.test(t)) return iso(new Date(base.getTime() - 86_400_000));
  const m = t.match(/\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/u);
  if (m?.[1] && m[2]) {
    const ano = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : hoje.slice(0, 4);
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const d = t.match(/\b(?:foi\s+)?dia\s+(\d{1,2})\b/u);
  if (d?.[1]) return `${hoje.slice(0, 7)}-${d[1].padStart(2, '0')}`;
  return undefined;
}

/**
 * Extrai a correção pelos padrões, sem modelo: obra e fornecedor por nome ou
 * apelido (`resolverPorNome`, ambíguo = não resolve), valor, data, e a
 * vontade de cancelar. Devolve só o que encontrou; campo ausente = não mexe.
 *
 * É o caminho sem chave de modelo e o "chão" quando o modelo falha. Com
 * modelo, `lib/ia/correcao.ts` faz o mesmo entendendo frases mais soltas —
 * mas os nomes passam pelo mesmo `resolverPorNome`.
 */
export function extrairCorrecaoSimples(
  texto: string,
  ctx: { obras: readonly Nomeado[]; fornecedores: readonly Nomeado[]; hoje: string },
): PatchDeCorrecao {
  const t = normalizar(texto);
  const leve = normalizarLeve(texto);
  const patch: PatchDeCorrecao = {};
  if (!t) return patch;

  if (CANCELAR.test(t)) patch.cancelar = true;

  // Obra: algum nome/apelido da lista aparece no texto? Tenta cada candidato
  // como se fosse a resposta inteira (é assim que `resolverPorNome` casa).
  const obra = acharNomeado(t, ctx.obras);
  if (obra) patch.obra = { id: obra.id, nome: obra.nome };

  const fornecedor = acharNomeado(t, ctx.fornecedores);
  if (fornecedor) patch.fornecedor = { id: fornecedor.id, nome: fornecedor.nome };
  else {
    const novo = t.match(
      /\bfornecedor\s+(?:e|eh|foi|certo e|correto e)\s+([a-z0-9][a-z0-9 ]{1,60})$/u,
    );
    if (novo?.[1]) patch.fornecedorNomeNovo = novo[1].trim();
  }

  const v = leve.match(VALOR) ?? leve.match(VALOR_SOLTO);
  if (v?.[1]) {
    const valor = lerValor(v[1]);
    if (valor != null) patch.valor = valor;
  }

  const data = lerData(leve, ctx.hoje);
  if (data) patch.data = data;

  return patch;
}

/** Palavras que nunca são nome de obra/fornecedor sozinhas. */
const RUIDO = new Set([
  'nao',
  'sim',
  'obra',
  'obras',
  'outra',
  'outro',
  'valor',
  'fornecedor',
  'data',
  'dia',
  'foi',
  'era',
  'esse',
  'essa',
  'isso',
  'esta',
  'este',
  'mesmo',
  'mesma',
  'certo',
  'certa',
  'errado',
  'errada',
  'verdade',
  'reais',
  'real',
  'hoje',
  'ontem',
  'para',
  'pra',
  'com',
  'sem',
  'que',
  'muda',
  'troca',
  'coloca',
  'bota',
  'lanca',
  'guarda',
]);

/**
 * Procura, no texto normalizado, UM item da lista citado por nome ou apelido.
 *
 * Cada palavra (e cada par de palavras) do texto é testada como se fosse a
 * resposta inteira, pelo mesmo `resolverPorNome` do classificador — assim
 * "inox" casa com "INOX Piratini" pela mesma regra de prefixo de sempre, e
 * dois nomes parecidos continuam ambíguos. Um nome **negado** ("não é na
 * Garibaldi") é descartado: sobra o que a pessoa quis dizer, ou nada.
 */
export function acharNomeado<T extends Nomeado>(t: string, lista: readonly T[]): T | undefined {
  const palavras = t.split(' ').filter(Boolean);
  const candidatos: string[] = [];
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i] as string;
    if (p.length >= 3 && !RUIDO.has(p)) candidatos.push(p);
    const q = palavras[i + 1];
    if (q && !RUIDO.has(p) && !RUIDO.has(q)) candidatos.push(`${p} ${q}`);
  }

  const achados = new Map<string, { item: T; termo: string }>();
  for (const c of candidatos) {
    const item = resolverPorNome(c, lista);
    if (item && !achados.has(item.id)) achados.set(item.id, { item, termo: c });
  }
  if (achados.size === 0) return undefined;

  const negados = new Set<string>();
  for (const { item, termo } of achados.values()) {
    if (
      new RegExp(
        `\\bnao (?:e|eh|foi|era)(?: n[ao]| d[ao]| em| pr[ao]| o| a)? ${escapar(termo)}\\b`,
        'u',
      ).test(t)
    ) {
      negados.add(item.id);
    }
  }
  const restantes = [...achados.values()].filter(({ item }) => !negados.has(item.id));
  return restantes.length === 1 ? restantes[0]?.item : undefined;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** "sim todos", "todos", "nao todas", "confirma tudo" → o alcance da resposta. */
export function alcanceDaResposta(texto: string | null | undefined): 'todos' | 'um' {
  if (!texto) return 'um';
  const t = normalizar(texto);
  return /^(?:sim|nao|não|ok|confirma|confirmo|cancela)?\s*(?:todos|todas|tudo)(?:\s+(?:sim|nao|não))?$/u.test(
    t,
  )
    ? 'todos'
    : 'um';
}

/** Tira o "todos" para o que sobrar passar por `interpretarResposta`. */
export function semAlcance(texto: string): string {
  return texto.replace(/\b(?:todos|todas|tudo)\b/giu, ' ').trim() || 'sim';
}
