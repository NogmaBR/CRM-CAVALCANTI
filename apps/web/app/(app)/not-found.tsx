import { TelaDeEstado } from '@/components/layout/tela-de-estado';
import { ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <TelaDeEstado
      icon={<SearchX size={28} aria-hidden="true" />}
      code="404"
      title="Página não encontrada"
      actions={
        <Link href="/painel" className="ng-btn ng-btn--primary ng-btn--md">
          <span className="ng-btn__icon" aria-hidden="true">
            <ArrowLeft size={16} />
          </span>
          Voltar ao painel
        </Link>
      }
    >
      O que você procurava não existe, foi arquivado ou o endereço está errado.
    </TelaDeEstado>
  );
}
