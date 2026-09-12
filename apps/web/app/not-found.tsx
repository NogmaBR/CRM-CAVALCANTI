import { TelaDeEstado } from '@/components/layout/tela-de-estado';
import { ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';

/**
 * 404 global.
 *
 * O `not-found.tsx` dentro de `(app)` só é usado quando uma página chama
 * `notFound()`. Uma URL que não casa com rota nenhuma cai aqui — e, sem este
 * arquivo, o Next mostrava o 404 padrão em inglês, sem a cara do app.
 */
export default function NaoEncontradoGlobal() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <TelaDeEstado
        icon={<SearchX size={28} aria-hidden="true" />}
        code="404"
        title="Página não encontrada"
        actions={
          <Link href="/painel" className="ng-btn ng-btn--primary ng-btn--md">
            <span className="ng-btn__icon" aria-hidden="true">
              <ArrowLeft size={16} />
            </span>
            Ir para o painel
          </Link>
        }
      >
        O endereço não existe ou mudou de lugar. Confira o link ou volte para o painel.
      </TelaDeEstado>
    </div>
  );
}
