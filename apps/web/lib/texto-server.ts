import { cookies } from 'next/headers';
import { TEXTO_COOKIE, type TamanhoDoTexto, ehTamanho } from './texto';

export async function getServerTexto(): Promise<TamanhoDoTexto> {
  const store = await cookies();
  const raw = store.get(TEXTO_COOKIE)?.value;
  return ehTamanho(raw) ? raw : 'normal';
}
