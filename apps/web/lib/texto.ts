/**
 * Tamanho do texto (A / A+ / A++), persistido em cookie como o tema. Vai
 * para `<html data-texto>` no servidor — sem flash — e o CSS escala a base
 * (`styles/tokens/typography.css`): tudo em `rem` acompanha.
 *
 * Só tipos e constantes aqui (o componente client importa daqui); a leitura
 * do cookie fica em `texto-server.ts`, que depende de `next/headers`.
 */
export type TamanhoDoTexto = 'normal' | 'grande' | 'maior';
export const TEXTO_COOKIE = 'nogma-texto';
export const TAMANHOS: readonly TamanhoDoTexto[] = ['normal', 'grande', 'maior'];

export function ehTamanho(v: unknown): v is TamanhoDoTexto {
  return v === 'normal' || v === 'grande' || v === 'maior';
}
