import 'server-only';
import { lookup } from 'node:dns/promises';

/**
 * Guard de SSRF para URLs de webhook outbound (auditoria 2026-09-09, finding A-4).
 *
 * O admin cadastra a URL de destino em /config/webhooks e o CRM faz `fetch`
 * a partir da function serverless do Vercel. Sem esta checagem, uma URL como
 * `http://169.254.169.254/latest/meta-data/` transforma o botão "Testar" num
 * oráculo contra a rede interna do host — o status/latência voltam refletidos
 * na UI.
 *
 * A checagem roda em DOIS momentos, de propósito:
 *   1. Na criação/edição do webhook (feedback imediato pro admin).
 *   2. A cada dispatch (`assertUrlSegura` em dispatch-webhook), porque um
 *      domínio público pode ser reapontado para 10.0.0.x depois do cadastro
 *      — o clássico DNS rebinding.
 *
 * Também resolvemos o hostname em vez de olhar só o texto da URL: `http://
 * meudominio.com` que resolve para 127.0.0.1 é exatamente o bypass que uma
 * validação puramente textual deixa passar.
 */

export type ResultadoSsrf =
  | { ok: true; enderecos: string[] }
  | { ok: false; motivo: string };

const PROTOCOLOS_PERMITIDOS = new Set(['http:', 'https:']);

/** Converte "10.0.0.5" em 167772165 pra comparação por faixa. */
function ipv4ParaInteiro(ip: string): number | null {
  const partes = ip.split('.');
  if (partes.length !== 4) return null;
  let total = 0;
  for (const parte of partes) {
    if (!/^\d{1,3}$/u.test(parte)) return null;
    const n = Number(parte);
    if (n > 255) return null;
    total = total * 256 + n;
  }
  return total;
}

/** Faixas IPv4 que nunca devem ser alvo de um webhook (RFC 1918, loopback, etc). */
const FAIXAS_IPV4_BLOQUEADAS: Array<{ cidr: string; base: number; bits: number; rotulo: string }> = [
  { cidr: '0.0.0.0/8', rotulo: 'endereço "this network"' },
  { cidr: '10.0.0.0/8', rotulo: 'rede privada (RFC 1918)' },
  { cidr: '100.64.0.0/10', rotulo: 'CGNAT (RFC 6598)' },
  { cidr: '127.0.0.0/8', rotulo: 'loopback' },
  { cidr: '169.254.0.0/16', rotulo: 'link-local / metadata da cloud' },
  { cidr: '172.16.0.0/12', rotulo: 'rede privada (RFC 1918)' },
  { cidr: '192.0.0.0/24', rotulo: 'IETF protocol assignments' },
  { cidr: '192.0.2.0/24', rotulo: 'documentação (TEST-NET-1)' },
  { cidr: '192.168.0.0/16', rotulo: 'rede privada (RFC 1918)' },
  { cidr: '198.18.0.0/15', rotulo: 'benchmark de rede' },
  { cidr: '198.51.100.0/24', rotulo: 'documentação (TEST-NET-2)' },
  { cidr: '203.0.113.0/24', rotulo: 'documentação (TEST-NET-3)' },
  { cidr: '224.0.0.0/4', rotulo: 'multicast' },
  { cidr: '240.0.0.0/4', rotulo: 'reservado' },
].map((f) => {
  const [rede, prefixo] = f.cidr.split('/');
  return { ...f, base: ipv4ParaInteiro(rede ?? '') ?? 0, bits: Number(prefixo) };
});

/**
 * Classifica um IP (v4 ou v6) como público ou bloqueado.
 * Exportada porque os testes cobrem cada faixa individualmente.
 */
export function motivoBloqueioIp(ip: string): string | null {
  const normalizado = ip.trim().toLowerCase();

  // IPv4 mapeado em IPv6 (::ffff:127.0.0.1) — desembrulha e reavalia como v4.
  const mapeado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(normalizado);
  if (mapeado?.[1]) return motivoBloqueioIp(mapeado[1]);

  const comoV4 = ipv4ParaInteiro(normalizado);
  if (comoV4 !== null) {
    if (comoV4 === 0xffffffff) return 'broadcast';
    for (const faixa of FAIXAS_IPV4_BLOQUEADAS) {
      const mascara = faixa.bits === 0 ? 0 : (0xffffffff << (32 - faixa.bits)) >>> 0;
      if ((comoV4 & mascara) >>> 0 === faixa.base) return faixa.rotulo;
    }
    return null;
  }

  // IPv6
  if (normalizado === '::1') return 'loopback';
  if (normalizado === '::') return 'endereço não especificado';
  // fc00::/7 — unique local; fe80::/10 — link-local
  if (/^f[cd][0-9a-f]{2}:/u.test(normalizado)) return 'rede privada IPv6 (ULA)';
  if (/^fe[89ab][0-9a-f]:/u.test(normalizado)) return 'link-local IPv6';
  if (/^ff[0-9a-f]{2}:/u.test(normalizado)) return 'multicast IPv6';

  return null;
}

/**
 * Valida uma URL de webhook: protocolo, formato e — resolvendo o DNS — se
 * algum dos IPs de destino cai em faixa interna.
 *
 * Falha de DNS é tratada como bloqueio: se não conseguimos provar que o
 * destino é público, não disparamos. É mais seguro recusar um host que não
 * resolve do que deixar passar um que resolve para a rede interna.
 */
export async function validarUrlWebhook(urlBruta: string): Promise<ResultadoSsrf> {
  let url: URL;
  try {
    url = new URL(urlBruta);
  } catch {
    return { ok: false, motivo: 'URL inválida.' };
  }

  if (!PROTOCOLOS_PERMITIDOS.has(url.protocol)) {
    return { ok: false, motivo: 'Só são aceitas URLs http:// ou https://.' };
  }

  if (url.username || url.password) {
    return { ok: false, motivo: 'URL não pode conter usuário/senha embutidos.' };
  }

  const host = url.hostname.replace(/^\[|\]$/gu, '');

  // Se o host já é um IP literal, nem precisa de DNS.
  const motivoDireto = motivoBloqueioIp(host);
  if (motivoDireto) {
    return { ok: false, motivo: `Destino aponta para ${motivoDireto} — não permitido.` };
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { ok: false, motivo: 'Destino aponta para host interno — não permitido.' };
  }

  // Host textual: resolve e valida TODOS os endereços retornados.
  let enderecos: Array<{ address: string }>;
  try {
    enderecos = await lookup(host, { all: true });
  } catch {
    return { ok: false, motivo: `Não foi possível resolver o domínio "${host}".` };
  }

  if (enderecos.length === 0) {
    return { ok: false, motivo: `O domínio "${host}" não resolveu para nenhum endereço.` };
  }

  for (const { address } of enderecos) {
    const motivo = motivoBloqueioIp(address);
    if (motivo) {
      return { ok: false, motivo: `O domínio "${host}" resolve para ${motivo} — não permitido.` };
    }
  }

  return { ok: true, enderecos: enderecos.map((e) => e.address) };
}
