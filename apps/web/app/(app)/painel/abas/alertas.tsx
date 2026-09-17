import { EmptyState } from '@/components/nogma/EmptyState';
import { alertasDoEmpresario } from '@/lib/data/painel-empresario';
import { ArrowRight, CircleCheck } from 'lucide-react';
import Link from 'next/link';

const GRAVIDADE_ROTULO = {
  alta: 'Precisa de ação',
  media: 'Vale olhar',
  baixa: 'Quando der',
} as const;

/**
 * O que exige ação, em frases: número grande, a explicação de uma linha e o
 * botão para resolver. Ordenado por gravidade. Vazio é boa notícia — e diz
 * isso com todas as letras.
 */
export async function AbaAlertas() {
  const alertas = await alertasDoEmpresario();
  if (alertas.length === 0) {
    return (
      <EmptyState icon={<CircleCheck size={24} aria-hidden="true" />} title="Tudo em dia">
        Nenhum pagamento sem nota, nenhuma confirmação esperando, contratos informados.
      </EmptyState>
    );
  }
  return (
    <ol className="lista-alertas">
      {alertas.map((a) => (
        <li key={a.chave} className={`alerta alerta--${a.gravidade}`}>
          <div className="alerta__numero" aria-hidden="true">
            {a.numero}
            {a.chave === 'mes_acima' ? '%' : ''}
          </div>
          <div className="alerta__corpo">
            <span className="alerta__gravidade">{GRAVIDADE_ROTULO[a.gravidade]}</span>
            <h3 className="alerta__titulo">{a.titulo}</h3>
            <p className="alerta__explicacao">{a.explicacao}</p>
          </div>
          <Link href={a.href} className="alerta__acao">
            {a.acao}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
