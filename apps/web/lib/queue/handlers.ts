import 'server-only';
import { enviarTexto, whatsappConfigurado } from '@/lib/services/uazapi';
import type { Handler } from './consumidor';
import type { NomeFila } from './tipos';

/**
 * Quem processa cada fila.
 *
 * Registro parcial de propósito: **fila sem handler não é consumida**. É o
 * mesmo desenho das automações, que nascem desligadas — as filas existem no
 * banco desde a migration, mas só passam a ser drenadas quando alguém escreve
 * o handler e o registra aqui.
 *
 * A ordem em que os handlers chegam é a ordem inversa do fluxo, e isso é
 * deliberado: `whatsapp_outbound` primeiro porque é o único cuja falha é
 * inteiramente do provider, sem estado nosso no meio. Os que dependem de
 * baixar mídia e classificar vêm quando o webhook for religado para
 * enfileirar, e isso é depois da entrega de 16/09.
 */

type Registro = { [F in NomeFila]?: Handler<F> };

/**
 * Envia uma mensagem de WhatsApp.
 *
 * ## Por que lançar em vez de engolir
 *
 * Um erro aqui devolve a mensagem à fila e ela é tentada de novo. Engolir
 * faria o consumidor concluir o job e apagar a mensagem — o fornecedor nunca
 * receberia nada, e o sistema registraria sucesso.
 *
 * ## Idempotência
 *
 * A entrega da fila é "pelo menos uma vez", então este handler pode rodar duas
 * vezes para a mesma mensagem — o caso real é o consumidor morrer entre enviar
 * e concluir. O resultado seria o fornecedor receber a mensagem duas vezes.
 *
 * Isso é aceitável **aqui, e só aqui**, porque quem enfileira é a automação de
 * cobrança, que já tem a própria trava: o índice único de
 * `automation_executions` impede a regra de agir duas vezes sobre o mesmo
 * pagamento no mesmo dia. A proteção existe uma camada acima, não nesta.
 *
 * Handler novo que não tenha essa garantia precisa da sua própria.
 */
const enviarWhatsapp: Handler<'whatsapp_outbound'> = async (_supabase, job) => {
  const { telefone, texto, origem } = job.payload;

  if (!whatsappConfigurado()) {
    throw new Error(
      'WhatsApp não configurado (UAZAPI_BASE_URL/UAZAPI_TOKEN ausentes) — nada foi enviado.',
    );
  }

  const envio = await enviarTexto(telefone, texto);
  if (!envio.ok) {
    throw new Error(
      `Envio (${origem}) falhou: ${envio.motivo}${envio.detalhe ? ` — ${envio.detalhe}` : ''}`,
    );
  }
};

export const HANDLERS: Registro = {
  whatsapp_outbound: enviarWhatsapp,
};

/** As filas que de fato têm quem as processe. */
export function filasComHandler(): NomeFila[] {
  return Object.keys(HANDLERS) as NomeFila[];
}
