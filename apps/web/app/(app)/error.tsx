'use client';

import { TelaDeEstado } from '@/components/layout/tela-de-estado';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * Fronteira de erro do app.
 *
 * Sem isto, qualquer `throw` em `lib/data/*` (uma consulta que falhou, um
 * `.single()` sem linha) renderizava a página de erro crua do Next para o
 * gestor. O `digest` é o que se procura no log da Vercel.
 */
export default function ErroDoApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <TelaDeEstado
      tone="danger"
      icon={<TriangleAlert size={28} aria-hidden="true" />}
      title="Algo deu errado nesta tela"
      actions={
        <>
          <button
            type="button"
            className="ng-btn ng-btn--primary ng-btn--md"
            onClick={() => reset()}
          >
            <span className="ng-btn__icon" aria-hidden="true">
              <RotateCcw size={16} />
            </span>
            Tentar de novo
          </button>
          <Link href="/painel" className="ng-btn ng-btn--secondary ng-btn--md">
            Ir para o painel
          </Link>
        </>
      }
    >
      O erro foi registrado. Tente de novo; se continuar, avise quem administra o sistema
      {error.digest ? (
        <>
          {' '}
          e informe o código <code>{error.digest}</code>
        </>
      ) : null}
      .
    </TelaDeEstado>
  );
}
