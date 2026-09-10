/**
 * Comandos de texto do bot no WhatsApp.
 *
 * Vem do protótipo aprovado pelo Cavalcanti: `resumo`, `pendencias` e
 * "quanto gastei em {obra}". É a feature de maior percepção de valor por
 * menor custo — o gestor consulta o CRM sem abrir o CRM, do mesmo lugar onde
 * ele já manda os pagamentos.
 *
 * Este módulo é só o **reconhecimento** do comando, de propósito: função pura,
 * testável sem banco. Quem executa e formata a resposta é
 * `lib/services/comandos-whatsapp.ts`.
 *
 * ## Onde isto entra na ordem do fluxo
 *
 * Depois da checagem de "isto é resposta a uma pergunta aberta?" e antes da
 * classificação. A ordem importa: "pendencias" não é um lançamento e não pode
 * virar pagamento nem abrir confirmação — mas um "sim" pendente ainda tem
 * prioridade sobre tudo.
 */

export type Comando =
  | { tipo: 'resumo' }
  | { tipo: 'pendencias' }
  | { tipo: 'gasto_obra'; obra: string }
  | { tipo: 'ajuda' };

/** Limite de palavras — mensagem longa é lançamento, não comando. */
const MAX_PALAVRAS = 8;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[?!.,;:]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const RESUMO = new Set([
  'resumo',
  'resumo geral',
  'me da um resumo',
  'da um resumo',
  'como estamos',
  'status',
  'status geral',
]);

const PENDENCIAS = new Set([
  'pendencias',
  'pendencia',
  'pendentes',
  'o que esta pendente',
  'tem pendencia',
  'quais as pendencias',
]);

const AJUDA = new Set(['ajuda', 'help', 'comandos', 'o que voce faz', 'menu']);

/**
 * Padrões de "quanto gastei na obra X".
 *
 * Aceita as formas que aparecem de verdade no WhatsApp — "quanto gastei em",
 * "quanto foi gasto na", "total da obra" — porque quem digita no canteiro não
 * decora sintaxe. O nome da obra é o resto da frase.
 */
const PADROES_GASTO: RegExp[] = [
  /^quanto (?:eu )?(?:ja )?gastei (?:em|na|no|com|de) (?:obra )?(.+)$/u,
  /^quanto (?:ja )?foi gasto (?:em|na|no|com|de) (?:obra )?(.+)$/u,
  /^quanto (?:custou|saiu) (?:a |o )?(?:obra )?(.+)$/u,
  /^(?:total|gasto|gastos) (?:da |do |de |na |no )?obra (.+)$/u,
  /^(?:total|gasto|gastos) (?:da |do |de ) ?(.+)$/u,
];

export function interpretarComando(texto: string | null | undefined): Comando | null {
  if (!texto) return null;

  const t = normalizar(texto);
  if (t === '') return null;

  if (t.split(' ').length > MAX_PALAVRAS) return null;

  if (RESUMO.has(t)) return { tipo: 'resumo' };
  if (PENDENCIAS.has(t)) return { tipo: 'pendencias' };
  if (AJUDA.has(t)) return { tipo: 'ajuda' };

  for (const padrao of PADROES_GASTO) {
    const encontrado = t.match(padrao);
    const obra = encontrado?.[1]?.trim();
    // Nome de obra de 1 caractere é quase certo ruído de digitação; exigir 2
    // evita disparar uma busca inútil e responder "não achei" pra um typo.
    if (obra && obra.length >= 2) {
      return { tipo: 'gasto_obra', obra };
    }
  }

  return null;
}
