import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import '@/components/completude/completude.css';

/**
 * Um campo que está faltando: o valor sai em vermelho (crítico) ou âmbar
 * (importante/leve) com o link para preencher, no lugar do "—" cinza que
 * ninguém via. É o semáforo aplicado campo a campo.
 */
export interface FaltaDaRow {
  texto: string;
  href?: string;
  rotulo?: string;
  gravidade?: 'critica' | 'importante' | 'leve';
}

export function Section({
  title,
  span = 1,
  children,
}: {
  title: string;
  span?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <section
      className={`detail-layout__section ${span === 2 ? 'detail-layout__section--wide' : ''}`}
    >
      <h3 className="detail-layout__legend">{title}</h3>
      <dl className="detail-layout__rows">{children}</dl>
    </section>
  );
}

export function Row({
  label,
  value,
  href,
  swatch,
  strong,
  multiline,
  falta,
}: {
  label: string;
  value: ReactNode;
  href?: string | undefined;
  swatch?: string | null;
  strong?: boolean;
  multiline?: boolean;
  /** Quando presente, substitui o valor pelo aviso de campo faltante. */
  falta?: FaltaDaRow | null;
}) {
  const style: CSSProperties = {};
  if (strong) style.fontWeight = 600;

  const inner = falta ? (
    <span className={`row-falta row-falta--${falta.gravidade ?? 'critica'}`}>
      <span className="row-falta__texto">{falta.texto}</span>
      {falta.href ? (
        <Link href={falta.href} className="row-falta__acao">
          {falta.rotulo ?? 'Preencher'}
        </Link>
      ) : null}
    </span>
  ) : (
    <>
      {swatch ? (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: 3,
            background: swatch,
            marginRight: 8,
            verticalAlign: 'middle',
          }}
        />
      ) : null}
      {href ? (
        <Link href={href} className="obras-row-link">
          {value}
        </Link>
      ) : (
        value
      )}
    </>
  );

  return (
    <div className="detail-layout__row">
      <dt className="detail-layout__label">{label}</dt>
      <dd
        className={
          multiline
            ? 'detail-layout__value detail-layout__value--multiline'
            : 'detail-layout__value'
        }
        style={style}
      >
        {inner}
      </dd>
    </div>
  );
}
