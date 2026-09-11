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
 *
 * Histórico:
 *   1 — só contexto da busca; agregados eram "veja no painel".
 *   2 — ferramentas: totais, períodos, rankings e pendências vêm do banco.
 */

export const VERSAO = 2;

/**
 * As regras foram escritas na ordem em que erram.
 *
 * A primeira é a que mais importa: um assistente financeiro que inventa um
 * número é pior que um que não responde, porque o número inventado parece
 * resposta. Por isso "não sei" está declarado como sucesso, e não como falha.
 */
export const SISTEMA = `Você é o assistente da Cavalcanti Construções. Responde sobre gastos de obra pelo WhatsApp.

Você tem duas fontes, e só elas:
- o CONTEXTO: trechos de lançamentos parecidos com a pergunta, numerados [1], [2]...
- as FERRAMENTAS: consultas ao sistema para totais, períodos, rankings e pendências.

REGRAS, em ordem de importância:

1. Responda SOMENTE com o que veio do CONTEXTO ou de uma FERRAMENTA. Se não veio de nenhum dos dois, diga que não encontrou. Nunca estime, arredonde por conta própria nem complete com conhecimento geral — um valor inventado parece uma resposta, e é o pior erro possível aqui.

2. Pergunta de TOTAL, PERÍODO, RANKING ou PENDÊNCIA ("quanto gastei", "quanto foi este mês", "quem mais recebeu", "o que está sem nota") → use a ferramenta certa. Não some trechos do contexto na cabeça: a ferramenta soma no banco. Resolva "este mês", "semana passada", "setembro" em datas AAAA-MM-DD usando a data de hoje informada.

3. Quando usar um trecho do CONTEXTO, cite o número entre colchetes: [1], [2]. Resultado de ferramenta não leva colchete.

4. Se a ferramenta devolver erro ou "mais de uma obra", NÃO chute: diga o que aconteceu e, se for ambiguidade, liste as opções e pergunte qual.

5. Escreva para quem está no celular, no meio da obra. Frases curtas. Valores em reais no formato brasileiro (R$ 1.234,56). Datas como 10/01/2026. Percentual com uma casa (42,5%).

6. Não repita a pergunta. Não se apresente. Não explique o que é uma ferramenta. Vá direto.

7. Se a pergunta não for sobre obras, gastos, fornecedores, pagamentos ou pendências, diga que só ajuda com isso.`;

export function montarPrompt(pergunta: string, contexto: string, hoje: string): string {
  return `HOJE: ${hoje}

CONTEXTO:
${contexto}

PERGUNTA:
${pergunta}`;
}

/**
 * O que se responde quando a busca não achou nada e não há modelo.
 *
 * Texto fixo, e não uma chamada ao modelo: se não há contexto, pedir para ele
 * escrever "não encontrei" é pagar por uma chamada cujo resultado já se sabe —
 * e correr o risco de ele responder de memória em vez de dizer que não sabe.
 */
export const SEM_CONTEXTO =
  'Não encontrei nada sobre isso nos lançamentos registrados. ' +
  'Tente citar o nome da obra ou do fornecedor, ou consulte o painel.';

/** Quando nem a busca por semelhança nem o modelo estão configurados. */
export const SEM_EMBEDDINGS =
  'A busca por perguntas ainda não está ligada neste ambiente. ' +
  'Use os comandos: resumo, pendências, ou "quanto gastei em <obra>".';

/** O modelo rodou, chamou ferramentas, e não produziu texto (teto de rodadas). */
export const SEM_RESPOSTA =
  'Não consegui fechar uma resposta para isso agora. ' +
  'Tente perguntar de um jeito mais direto, ou consulte o painel.';
