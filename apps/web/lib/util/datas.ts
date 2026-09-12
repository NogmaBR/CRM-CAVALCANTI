/**
 * Datas civis no fuso do cliente.
 *
 * A função roda em UTC na Vercel; a Cavalcanti vive em Brasília (UTC-3). Um
 * "paguei 500 hoje" mandado às 22h de terça virava `data_pagamento` de
 * quarta, e o "resumo do mês" virava o mês seguinte às 21h do último dia.
 * Achado da revisão de 2026-09-11, em sete lugares diferentes.
 *
 * Tudo que deriva uma DATA (não um instante) do "agora" passa por aqui.
 *
 * O que NÃO usa isto, de propósito: a janela de idempotência das automações,
 * que é UTC nos dois lados (índice do banco e JS) e precisa continuar assim.
 */

export const FUSO_CLIENTE = 'America/Sao_Paulo';

// `en-CA` formata como AAAA-MM-DD, que é o formato ISO de data civil.
const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_CLIENTE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** AAAA-MM-DD de hoje em Brasília. */
export function hojeBR(agora: Date = new Date()): string {
  return formatador.format(agora);
}

/** AAAA-MM-DD do primeiro dia do mês corrente em Brasília. */
export function inicioDoMesBR(agora: Date = new Date()): string {
  return `${hojeBR(agora).slice(0, 7)}-01`;
}

/** AAAA-MM-DD do primeiro dia do mês anterior em Brasília. */
export function inicioDoMesPassadoBR(agora: Date = new Date()): string {
  const [ano, mes] = hojeBR(agora).split('-').map(Number) as [number, number, number];
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  return `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
}

/** Nome do mês corrente em Brasília, em português ("setembro"). */
export function nomeDoMesBR(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_CLIENTE, month: 'long' }).format(agora);
}
