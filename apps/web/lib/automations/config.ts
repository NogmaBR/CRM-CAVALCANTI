import type { z } from 'zod';
import type { Automacao } from './tipos';

/**
 * Valida a configuração de uma automação antes de ela rodar ou ser salva.
 *
 * Até a revisão gstack de 2026-09-12 o `config` era JSON livre e cada
 * definition fazia `numero(v, padrao)`: um typo em `limite_por_rodada`
 * (`limte_por_rodada: 3`) era ignorado em silêncio e a regra seguia com o
 * padrão de 25 cobranças por rodada. O "freio de mão" do go-live não engatava
 * e ninguém ficava sabendo. Agora o schema é `.strict()`: chave desconhecida
 * ou tipo errado é erro visível — na tela ao salvar, no log ao rodar.
 */
export type ConfigValidada =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; erro: string };

export function validarConfig(automacao: Automacao, bruto: unknown): ConfigValidada {
  const mesclado = {
    ...(automacao.configPadrao ?? {}),
    ...(bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? (bruto as object) : {}),
  };
  const resultado = automacao.configSchema.strict().safeParse(mesclado);
  if (resultado.success) return { ok: true, config: resultado.data as Record<string, unknown> };
  return { ok: false, erro: descreverErro(resultado.error) };
}

/** "campo: mensagem; campo2: mensagem" — o campo vem primeiro para o usuário achar. */
function descreverErro(erro: z.ZodError): string {
  return erro.issues
    .map((i) => {
      const campo = i.path.join('.') || 'config';
      if (i.code === 'unrecognized_keys') {
        return `${i.keys.join(', ')}: parâmetro desconhecido (confira a grafia)`;
      }
      return `${campo}: ${i.message}`;
    })
    .join('; ');
}
