import 'server-only';
import type { Ferramenta } from './ferramentas/registro';

/**
 * Modelo com ferramentas, independente de provider.
 *
 * O assistente (`assistente.ts`) só precisa de duas coisas: mandar a pergunta
 * e devolver resultados de ferramenta até o modelo redigir. O histórico da
 * conversa, no formato de cada API, fica dentro do adaptador — é assim que a
 * troca Anthropic → OpenAI (2026-09-15) não tocou no laço nem nos testes do
 * laço.
 */

export interface UsoDeFerramenta {
  id: string;
  nome: string;
  argumentos: unknown;
}

export interface RespostaDoModelo {
  /** Texto redigido (vazio quando o modelo só pediu ferramentas). */
  texto: string;
  usos: UsoDeFerramenta[];
  tokensEntrada: number;
  tokensSaida: number;
}

export interface ResultadoDeFerramenta {
  id: string;
  conteudo: string;
  erro: boolean;
}

export interface ModeloComFerramentas {
  /** Primeira chamada: a pergunta com o contexto já montado. */
  perguntar(prompt: string): Promise<RespostaDoModelo>;
  /** Chamadas seguintes: devolve os resultados das ferramentas pedidas. */
  continuar(resultados: ResultadoDeFerramenta[]): Promise<RespostaDoModelo>;
}

export interface OpcoesDoModelo {
  sistema: string;
  ferramentas: readonly Ferramenta[];
}

export type CriarModelo = (opts: OpcoesDoModelo) => ModeloComFerramentas;

/** Há um provider real configurado com chave? */
export function modeloDisponivel(): boolean {
  const provider = process.env.IA_PROVIDER ?? 'mock';
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY);
  return false;
}

/** Escolhe o adaptador pelo `IA_PROVIDER`. Import dinâmico: só o SDK usado entra no bundle. */
export async function criarModeloPadrao(opts: OpcoesDoModelo): Promise<ModeloComFerramentas> {
  const provider = process.env.IA_PROVIDER ?? 'mock';
  if (provider === 'openai') {
    const { ModeloOpenAI } = await import('./openai-modelo');
    return new ModeloOpenAI(opts);
  }
  if (provider === 'anthropic') {
    const { ModeloAnthropic } = await import('./anthropic-modelo');
    return new ModeloAnthropic(opts);
  }
  throw new Error(`IA_PROVIDER=${provider} não tem modelo com ferramentas.`);
}
