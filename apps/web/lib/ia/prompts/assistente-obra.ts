/**
 * Prompt do assistente de obra — versionado em código.
 *
 * "Prompts em arquivo, versionados" é um entregável da Fase 4, e a razão é
 * prática: prompt é comportamento. Mudar uma frase aqui muda o que o cliente
 * recebe no WhatsApp tanto quanto mudar um `if`. Se ele vivesse numa variável
 * de ambiente ou numa linha do banco, a mudança não apareceria em diff, não
 * passaria por revisão e não daria para saber, olhando uma resposta estranha
 * de terça, qual texto estava no ar naquele dia.
 *
 * Ao alterar, suba `VERSAO`. Ela é gravada junto da resposta, e é o que
 * permite responder "com qual prompt isso foi gerado?".
 */

export const VERSAO = 1;

/**
 * As regras foram escritas na ordem em que erram.
 *
 * A primeira é a que mais importa: um assistente financeiro que inventa um
 * número é pior que um que não responde, porque o número inventado parece
 * resposta. Por isso "não sei" está declarado como sucesso, e não como falha.
 */
export const SISTEMA = `Você é o assistente da Cavalcanti Construções. Responde sobre gastos de obra pelo WhatsApp.

REGRAS, em ordem de importância:

1. Responda SOMENTE com o que está no CONTEXTO abaixo. Se a resposta não estiver lá, diga que não encontrou. Nunca estime, arredonde por conta própria nem complete com conhecimento geral — um valor inventado parece uma resposta, e é o pior erro possível aqui.

2. Cite a fonte com o número entre colchetes, assim: [1], [2]. Toda afirmação com número precisa de citação.

3. Escreva para quem está no celular, no meio da obra. Frases curtas. Valores em reais no formato brasileiro (R$ 1.234,56). Datas como 10/01/2026.

4. Não invente totais somando os trechos você mesmo se a pergunta pedir um agregado que não está pronto no contexto. Nesse caso diga o que encontrou e sugira ver no painel.

5. Não repita a pergunta. Não se apresente. Vá direto.

6. Se a pergunta não for sobre obras, gastos, fornecedores ou pagamentos, diga que só ajuda com isso.`;

export function montarPrompt(pergunta: string, contexto: string): string {
  return `CONTEXTO:
${contexto}

PERGUNTA:
${pergunta}`;
}

/**
 * O que se responde quando a busca não achou nada.
 *
 * Texto fixo, e não uma chamada ao modelo: se não há contexto, pedir para ele
 * escrever "não encontrei" é pagar por uma chamada cujo resultado já se sabe —
 * e correr o risco de ele responder de memória em vez de dizer que não sabe.
 */
export const SEM_CONTEXTO =
  'Não encontrei nada sobre isso nos lançamentos registrados. ' +
  'Tente citar o nome da obra ou do fornecedor, ou consulte o painel.';

/** Quando a busca por semelhança não está configurada. */
export const SEM_EMBEDDINGS =
  'A busca por perguntas ainda não está ligada neste ambiente. ' +
  'Use os comandos: resumo, pendências, ou "quanto gastei em <obra>".';
