/**
 * Link curto para o item no painel, no fim de toda resposta que criou algo.
 *
 * "Para ver no painel: menu Pagamentos" obrigava a pessoa a abrir o site e
 * procurar. Um link direto abre a tela certa no celular. A base é a mesma
 * do resumo diário (`NEXT_PUBLIC_APP_URL`, com a produção como padrão).
 * Puro: sem `server-only`, para os textos continuarem testáveis.
 */
export function linkDoPainel(caminho: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app').replace(
    /\/+$/u,
    '',
  );
  return `${base}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
}
