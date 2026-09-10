'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Banner que exibe o secret do webhook exatamente uma vez.
 *
 * Dois problemas resolvidos aqui:
 *
 * 1. O secret chegava pela query string (finding A-3 da auditoria). Agora
 *    vem de um cookie httpOnly que o servidor leu e passou como prop; ao
 *    montar, este componente chama o endpoint de dismiss pra apagar o cookie.
 *    O valor já renderizado continua na tela — mas um refresh não o traz de
 *    volta, e ele nunca esteve na URL.
 *
 * 2. O botão "Copiar" era renderizado num Server Component com
 *    `onClick={undefined}` — ou seja, não copiava nada. Como o secret não é
 *    mais exibido numa segunda visita, um botão de copiar quebrado significa
 *    perder o secret e ter que regenerar.
 */
export function SecretBanner({ secret, titulo }: { secret: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const jaDispensou = useRef(false);

  useEffect(() => {
    if (jaDispensou.current) return;
    jaDispensou.current = true;
    void fetch('/api/config/webhook-secret', { method: 'DELETE' }).catch(() => {
      // Se o dismiss falhar, o cookie expira sozinho em 60s (maxAge).
    });
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard bloqueada (http sem TLS, permissão negada): o valor está
      // visível na tela pra seleção manual, então não há o que fazer aqui.
    }
  }

  return (
    <div className="wh-secret-banner" role="alert">
      <p className="wh-secret-banner__title">{titulo}</p>
      <p className="wh-secret-banner__body">
        Este secret não será exibido novamente. Use-o para validar a assinatura
        <code style={{ fontFamily: 'inherit' }}> X-Nogma-Signature</code> nas requisições recebidas.
      </p>
      <div className="wh-secret-banner__row">
        <span className="wh-secret-value">{secret}</span>
        <button
          type="button"
          className="wh-secret-copy-btn"
          onClick={copiar}
          aria-label={copiado ? 'Secret copiado' : 'Copiar secret'}
        >
          {copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
