import 'server-only';
import { UazapiInboundSchema } from '@/lib/schemas/uazapi';
import { processarInbound } from '@/lib/services/inbound-whatsapp';
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

/**
 * Processa uma mensagem recebida, ponta a ponta.
 *
 * ## É `processarInbound` inteiro, e isso é de propósito
 *
 * A tentação seria picar o fluxo em três jobs — baixar mídia, classificar,
 * responder. Não dá, e a razão está no próprio fluxo: a transcrição do áudio
 * precisa estar pronta **antes** de decidir se a mensagem é um "SIM" para uma
 * pendência aberta. Separar exigiria reordenar as etapas, e essa ordem está
 * comentada caso a caso em `inbound-whatsapp.ts` porque cada troca já custou
 * um bug.
 *
 * O ganho da fila não estava na granularidade: estava em tirar download,
 * transcrição e chamada de LLM de dentro do request do provider. Isso a fila
 * entrega com um job só.
 *
 * ## Idempotência
 *
 * `processarInbound` já é idempotente por construção — a segunda passagem
 * encontra a mensagem em `mensagens_whats` pelo `msg_id_uazapi` e devolve
 * `duplicada` sem reprocessar. É a mesma trava que protege do retry do
 * provider, e ela serve igual para o retry da fila.
 *
 * A exceção conhecida é o comando de consulta, que não é persistido e portanto
 * pode ser respondido duas vezes. O custo é o gestor receber duas vezes o
 * mesmo resumo — incômodo, não dano. Persistir consulta para evitar isso
 * encheria a fila de pendências com pergunta já respondida, que é pior.
 *
 * ## Por que revalidar o payload
 *
 * Ele volta de `jsonb`, não do request. Entre enfileirar e consumir pode ter
 * havido deploy com schema diferente, e o Postgres não guarda tipo nenhum.
 * Revalidar custa microssegundos e transforma "campo faltando" em erro claro
 * na hora certa.
 */
const processarMensagemRecebida: Handler<'whatsapp_inbound'> = async (supabase, job) => {
  const parsed = UazapiInboundSchema.safeParse(job.payload.payload);

  if (!parsed.success) {
    const primeiro = parsed.error.issues[0];
    // Lança, mas este é o caso em que a retentativa não vai ajudar: payload
    // torto continua torto. As três tentativas passam rápido e a mensagem vai
    // para o arquivo, que é onde alguém vai encontrá-la.
    throw new Error(
      `Payload inválido na fila: ${primeiro ? `${primeiro.path.join('.')}: ${primeiro.message}` : 'formato inesperado'}`,
    );
  }

  const resultado = await processarInbound(supabase, parsed.data);

  // `erro` é o único desfecho que merece retentativa: os outros — ignorada,
  // duplicada, comando, classificada — são conclusões legítimas do fluxo.
  if (resultado.acao === 'erro') {
    throw new Error(`processarInbound falhou: ${resultado.detalhe ?? 'sem detalhe'}`);
  }
};

export const HANDLERS: Registro = {
  whatsapp_inbound: processarMensagemRecebida,
  whatsapp_outbound: enviarWhatsapp,
};

/** As filas que de fato têm quem as processe. */
export function filasComHandler(): NomeFila[] {
  return Object.keys(HANDLERS) as NomeFila[];
}
