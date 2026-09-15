import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlockParam,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages/messages';
import { paraAnthropic } from './ferramentas/registro';
import type {
  ModeloComFerramentas,
  OpcoesDoModelo,
  RespostaDoModelo,
  ResultadoDeFerramenta,
} from './modelo-ferramentas';

/**
 * Modelo com ferramentas via Claude — o adaptador do que o assistente fazia
 * inline até 2026-09-15. Mantido como provider alternativo.
 */

const MODELO_PADRAO = 'claude-opus-5';
const MAX_TOKENS = 1024;

export class ModeloAnthropic implements ModeloComFerramentas {
  private readonly client: Anthropic;
  private readonly mensagens: MessageParam[] = [];
  private readonly sistema: string;
  private readonly tools: ReturnType<typeof paraAnthropic>;

  constructor(opts: OpcoesDoModelo) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.sistema = opts.sistema;
    this.tools = paraAnthropic(opts.ferramentas);
  }

  async perguntar(prompt: string): Promise<RespostaDoModelo> {
    this.mensagens.push({ role: 'user', content: prompt });
    return this.chamar();
  }

  async continuar(resultados: ResultadoDeFerramenta[]): Promise<RespostaDoModelo> {
    const blocos: ContentBlockParam[] = resultados.map((r) => ({
      type: 'tool_result',
      tool_use_id: r.id,
      content: r.conteudo,
      is_error: r.erro,
    }));
    this.mensagens.push({ role: 'user', content: blocos });
    return this.chamar();
  }

  private async chamar(): Promise<RespostaDoModelo> {
    const resposta = await this.client.messages.create({
      model: process.env.IA_MODEL ?? MODELO_PADRAO,
      max_tokens: MAX_TOKENS,
      system: this.sistema,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      tools: this.tools,
      messages: this.mensagens,
    });

    // O conteúdo inteiro volta como mensagem do assistente — inclusive os
    // blocos de raciocínio, que a API exige de volta quando há tool_use.
    this.mensagens.push({ role: 'assistant', content: resposta.content as ContentBlockParam[] });

    const usos = resposta.content.filter((b) => b.type === 'tool_use');
    return {
      texto: resposta.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim(),
      usos: usos.map((u) => ({ id: u.id, nome: u.name, argumentos: u.input })),
      tokensEntrada: resposta.usage?.input_tokens ?? 0,
      tokensSaida: resposta.usage?.output_tokens ?? 0,
    };
  }
}
