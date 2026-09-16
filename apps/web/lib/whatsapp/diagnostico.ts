import 'server-only';
import { logger } from '@/lib/log';

/**
 * Diagnóstico da ligação com o WhatsApp (UAZAPI), para `/config/whatsapp`.
 *
 * Duas fontes: o que o provider diz de si (`GET /instance/status`,
 * `GET /webhook`) e o que está no ambiente. A avaliação do webhook é pura
 * (`avaliarWebhook`) e testada: é ela que diz, item a item, o que está
 * errado na configuração — a URL, os eventos, o filtro de laço, o filtro que
 * mataria os grupos.
 */

const log = logger('whatsapp_diagnostico');

export interface StatusInstancia {
  configurado: boolean;
  alcancavel: boolean;
  conectado: boolean;
  estado: string | null;
  numero: string | null;
  nomePerfil: string | null;
  nomeInstancia: string | null;
  ultimaDesconexao: string | null;
  erro?: string;
}

export interface WebhookProvider {
  id?: string;
  enabled?: boolean;
  url?: string;
  events?: string[];
  excludeMessages?: string[];
  addUrlEvents?: boolean;
  addUrlTypesMessages?: boolean;
}

export interface Checagem {
  ok: boolean;
  item: string;
  detalhe: string;
}

function config(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.UAZAPI_BASE_URL?.replace(/\/+$/u, '');
  const token = process.env.UAZAPI_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

async function get(caminho: string): Promise<unknown> {
  const cfg = config();
  if (!cfg) return null;
  const res = await fetch(`${cfg.baseUrl}${caminho}`, {
    headers: { token: cfg.token, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Só dígitos do JID (`5551…@s.whatsapp.net` → `5551…`). */
function numeroDoJid(jid: unknown): string | null {
  if (typeof jid !== 'string') return null;
  const so = jid.split('@')[0]?.split(':')[0]?.replace(/\D/gu, '');
  return so && so.length >= 8 ? so : null;
}

export async function statusDaInstancia(): Promise<StatusInstancia> {
  const base: StatusInstancia = {
    configurado: config() !== null,
    alcancavel: false,
    conectado: false,
    estado: null,
    numero: null,
    nomePerfil: null,
    nomeInstancia: null,
    ultimaDesconexao: null,
  };
  if (!base.configurado) return base;
  try {
    const j = (await get('/instance/status')) as {
      instance?: Record<string, unknown>;
      status?: Record<string, unknown>;
    } | null;
    const inst = j?.instance ?? {};
    const st = j?.status ?? {};
    return {
      ...base,
      alcancavel: true,
      conectado: st.connected === true || inst.status === 'connected',
      estado: typeof inst.status === 'string' ? inst.status : null,
      numero: numeroDoJid(st.jid) ?? numeroDoJid(inst.owner),
      nomePerfil: typeof inst.profileName === 'string' ? inst.profileName : null,
      nomeInstancia: typeof inst.name === 'string' ? inst.name : null,
      ultimaDesconexao: typeof inst.lastDisconnect === 'string' ? inst.lastDisconnect : null,
    };
  } catch (err) {
    log.aviso('status_instancia_falhou', { err });
    return { ...base, erro: err instanceof Error ? err.message : 'falha' };
  }
}

export async function webhooksDaInstancia(): Promise<WebhookProvider[] | null> {
  if (!config()) return null;
  try {
    const j = await get('/webhook');
    if (Array.isArray(j)) return j as WebhookProvider[];
    if (j && typeof j === 'object') return [j as WebhookProvider];
    return [];
  } catch (err) {
    log.aviso('webhook_instancia_falhou', { err });
    return null;
  }
}

/** URL que o provider precisa chamar. */
export function urlDoWebhook(baseUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  return `${(baseUrl ?? 'https://crm-cavalcanti.vercel.app').replace(/\/+$/u, '')}/api/webhooks/uazapi`;
}

/**
 * Puro. Confere a configuração do webhook no provider contra o que o CRM
 * precisa. Cada item vira uma linha na tela, verde ou vermelha, com o motivo.
 */
export function avaliarWebhook(
  webhooks: WebhookProvider[] | null,
  urlEsperada: string,
): Checagem[] {
  if (webhooks === null) {
    return [
      { ok: false, item: 'Webhook', detalhe: 'Não consegui ler a configuração no provider.' },
    ];
  }
  const normalizar = (u: string) => u.trim().replace(/\/+$/u, '').toLowerCase();
  const nosso = webhooks.find(
    (w) => typeof w.url === 'string' && normalizar(w.url) === normalizar(urlEsperada),
  );
  if (!nosso) {
    const outras = webhooks.map((w) => w.url).filter(Boolean);
    return [
      {
        ok: false,
        item: 'URL',
        detalhe:
          outras.length > 0
            ? `Nenhum webhook aponta para ${urlEsperada}. Configurado(s): ${outras.join(', ')}`
            : `Nenhum webhook configurado. A URL tem que ser ${urlEsperada}`,
      },
    ];
  }
  const eventos = nosso.events ?? [];
  const excluidos = nosso.excludeMessages ?? [];
  return [
    { ok: true, item: 'URL', detalhe: nosso.url ?? urlEsperada },
    {
      ok: nosso.enabled !== false,
      item: 'Habilitado',
      detalhe: nosso.enabled !== false ? 'Sim' : 'O webhook está desabilitado no provider.',
    },
    {
      ok: eventos.includes('messages'),
      item: 'Evento "messages"',
      detalhe: eventos.includes('messages')
        ? `Escutando: ${eventos.join(', ')}`
        : `Sem "messages" nada chega. Escutando: ${eventos.join(', ') || 'nada'}`,
    },
    {
      ok: excluidos.includes('wasSentByApi'),
      item: 'Filtro "wasSentByApi"',
      detalhe: excluidos.includes('wasSentByApi')
        ? 'Excluído — o CRM não recebe o eco das próprias respostas.'
        : 'Falta excluir "wasSentByApi": o CRM já descarta o eco, mas o provider mandaria em dobro.',
    },
    {
      ok: !excluidos.includes('isGroupYes'),
      item: 'Grupos',
      detalhe: excluidos.includes('isGroupYes')
        ? '"isGroupYes" está excluído: NENHUMA mensagem de grupo chega. Tire esse filtro.'
        : 'Mensagens de grupo chegam.',
    },
    {
      ok: !excluidos.includes('fromMeYes'),
      item: 'Mensagens do dono do número',
      detalhe: excluidos.includes('fromMeYes')
        ? '"fromMeYes" está excluído: o que o dono do número manda pelo celular não chega.'
        : 'O que o dono do número manda pelo celular chega.',
    },
    {
      ok: nosso.addUrlEvents !== true && nosso.addUrlTypesMessages !== true,
      item: 'URL sem sufixos',
      detalhe:
        nosso.addUrlEvents === true || nosso.addUrlTypesMessages === true
          ? 'addUrlEvents/addUrlTypesMessages acrescentam /messages/… à URL e a rota não existe. Desligue os dois.'
          : 'addUrlEvents e addUrlTypesMessages desligados.',
    },
  ];
}
