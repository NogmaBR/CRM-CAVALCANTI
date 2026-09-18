import type { FiltroDeSituacao } from '@/lib/completude/regras';
import Link from 'next/link';
import './completude.css';

/**
 * Os chips "Situação: Todos · Com pendência · Falta muito · Completos" das
 * listas. É link (`?situacao=`), como os outros filtros — a URL diz onde a
 * pessoa está e o botão Voltar funciona.
 */
const OPCOES: Array<{ value: FiltroDeSituacao; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Com pendência' },
  { value: 'critico', label: 'Falta muito' },
  { value: 'completo', label: 'Completos' },
];

export function FiltroDeSituacao({
  atual,
  buildHref,
  contagem,
}: {
  atual: FiltroDeSituacao;
  /** Recebe o valor do filtro e devolve a URL com os outros filtros mantidos. */
  buildHref: (situacao: FiltroDeSituacao) => string;
  /** Quantos itens caem em cada opção (opcional — aparece entre parênteses). */
  contagem?: Partial<Record<FiltroDeSituacao, number>>;
}) {
  return (
    <div className="filtro-situacao">
      <span className="filtro-situacao__rotulo">Situação:</span>
      <nav className="obras-filter-tabs obras-filter-tabs--compacto" aria-label="Filtrar por situação">
        {OPCOES.map((opt) => {
          const active = opt.value === atual;
          const n = contagem?.[opt.value];
          return (
            <Link
              key={opt.value || 'todos'}
              href={buildHref(opt.value)}
              className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
              aria-current={active ? 'page' : undefined}
            >
              {opt.label}
              {n != null ? <span className="filtro-situacao__n"> {n}</span> : null}
            </Link>
          );
        })}
      </nav>
      <ul className="semaforo-legenda" aria-label="Legenda das cores">
        <li>
          <span className="semaforo-legenda__cor" style={{ background: 'var(--success)' }} />
          completo
        </li>
        <li>
          <span className="semaforo-legenda__cor" style={{ background: 'var(--warning)' }} />
          falta pouco
        </li>
        <li>
          <span className="semaforo-legenda__cor" style={{ background: 'var(--danger)' }} />
          falta muito
        </li>
      </ul>
    </div>
  );
}
