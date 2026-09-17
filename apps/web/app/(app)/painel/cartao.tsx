import type { ReactNode } from 'react';

/**
 * Cartão do painel do empresário: título em frase, o gráfico, **uma frase de
 * leitura** (o número que importa, com palavras) e a tabela dos mesmos dados
 * dobrada em "Ver os números".
 *
 * A tabela não é enfeite: é o reforço de acessibilidade que o dataviz exige
 * quando a paleta escura tem contraste baixo, e é o que muita gente prefere
 * ler. Por isso todo cartão com gráfico tem uma.
 */
export function Cartao({
  titulo,
  leitura,
  children,
  tabela,
  largo = false,
  acao,
}: {
  titulo: string;
  leitura?: ReactNode;
  children: ReactNode;
  tabela?: ReactNode;
  largo?: boolean;
  acao?: ReactNode;
}) {
  return (
    <section className={`cartao${largo ? ' cartao--largo' : ''}`}>
      <div className="cartao__cabeca">
        <h3 className="cartao__titulo">{titulo}</h3>
        {acao ? <div className="cartao__acao">{acao}</div> : null}
      </div>
      <div className="cartao__corpo">{children}</div>
      {leitura ? <p className="cartao__leitura">{leitura}</p> : null}
      {tabela ? (
        <details className="cartao__tabela">
          <summary>Ver os números</summary>
          <div className="cartao__tabela-rolagem">{tabela}</div>
        </details>
      ) : null}
    </section>
  );
}

/** Tabela simples e legível (linhas altas, números alinhados à direita). */
export function Tabela({
  cabecalho,
  linhas,
  rodape,
}: {
  cabecalho: string[];
  linhas: Array<Array<ReactNode>>;
  rodape?: Array<ReactNode>;
}) {
  return (
    <table className="tabela-legivel">
      <thead>
        <tr>
          {cabecalho.map((c, i) => (
            <th key={c} scope="col" className={i > 0 ? 'tabela-legivel__num' : undefined}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas estáticas, sem reordenação
          <tr key={i}>
            {l.map((c, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: idem
              <td key={j} className={j > 0 ? 'tabela-legivel__num' : undefined}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {rodape ? (
        <tfoot>
          <tr>
            {rodape.map((c, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: idem
              <td key={j} className={j > 0 ? 'tabela-legivel__num' : undefined}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

export function brl(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
