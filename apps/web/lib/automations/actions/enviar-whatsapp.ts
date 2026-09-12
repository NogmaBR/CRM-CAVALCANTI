import 'server-only';
import { normalizeTelefone } from '@/lib/schemas/uazapi';
import { enviarTexto, whatsappConfigurado } from '@/lib/services/uazapi';
import type { ContextoExecucao } from '../tipos';

/**
 * Ação: mandar uma mensagem de WhatsApp.
 *
 * Fica atrás do adaptador `lib/services/uazapi` de propósito — trocar de
 * provider não deve tocar em automação nenhuma.
 *
 * Em simulação não envia. Sem credencial configurada também não envia, mas
 * **lança**, para que a execução apareça como `falha` no log em vez de
 * `sucesso` — do contrário o gestor veria "cobrança enviada" quando nada saiu.
 */
export async function enviarWhatsapp(
  ctx: ContextoExecucao,
  telefone: string,
  texto: string,
): Promise<{ resumo: string }> {
  if (ctx.simular) {
    return { resumo: `[simulado] enviaria para ${mascarar(telefone)}: ${texto.slice(0, 60)}` };
  }

  if (!whatsappConfigurado()) {
    throw new Error(
      'WhatsApp não configurado (UAZAPI_BASE_URL/UAZAPI_TOKEN ausentes) — nada foi enviado.',
    );
  }

  // O provider espera só dígitos; o cadastro vem "(51) 99999-8888". E número
  // com menos de 10 dígitos não é telefone — é o cheiro dos placeholders do
  // protótipo. Recusar aqui vira linha de `falha` com motivo claro, em vez de
  // um HTTP 4xx opaco todo dia.
  const digitos = normalizeTelefone(telefone);
  if (digitos.length < 10) {
    throw new Error(`Telefone inválido para envio (${digitos.length} dígitos após normalizar).`);
  }

  const envio = await enviarTexto(digitos, texto);
  if (!envio.ok) {
    throw new Error(`Envio falhou: ${envio.motivo}${envio.detalhe ? ` — ${envio.detalhe}` : ''}`);
  }

  return { resumo: `Mensagem enviada para ${mascarar(telefone)}` };
}

/** Telefone em log fica mascarado (LGPD) — o log é lido por vários papéis. */
function mascarar(telefone: string): string {
  const d = telefone.replace(/\D+/gu, '');
  return d.length <= 4 ? '***' : `***${d.slice(-4)}`;
}
