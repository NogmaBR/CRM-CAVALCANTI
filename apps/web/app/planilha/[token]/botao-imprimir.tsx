'use client';

import { Printer } from 'lucide-react';

/**
 * Único pedaço interativo da planilha pública.
 *
 * "Manda o PDF" é o pedido real do cliente, e `window.print()` resolve isso
 * sem servidor de PDF, sem download e sem dependência nova — o navegador já
 * oferece "Salvar como PDF" no diálogo. O CSS de impressão em `planilha.css`
 * é que faz o resultado sair apresentável.
 */
export function BotaoImprimir() {
  return (
    <button type="button" className="pl-botao" onClick={() => window.print()}>
      <Printer size={15} aria-hidden="true" />
      Imprimir / Salvar PDF
    </button>
  );
}
