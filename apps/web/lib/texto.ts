import { cookies } from 'next/headers';

/**
 * Tamanho do texto (A / A+ / A++), persistido em cookie como o tema. Vai
 * para `<html data-texto>` no servidor — sem flash — e o CSS escala a base
 * (`styles/tokens/typography.css`): tudo em `rem` acompanha.
 */
export type TamanhoDoTexto = 'normal' | 'grande' | 'maior';
export const TEXTO_COOKIE = 'nogma-texto';
export const TAMANHOS: readonly TamanhoDoTexto[] = ['normal', 'grande', 'maior'];

export function ehTamanho(v: unknown): v is TamanhoDoTexto {
  return v === 'normal' || v === 'grande' || v === 'maior';
}

export async function getServerTexto(): Promise<TamanhoDoTexto> {
  const store = await cookies();
  const raw = store.get(TEXTO_COOKIE)?.value;
  return ehTamanho(raw) ? raw : 'normal';
}
