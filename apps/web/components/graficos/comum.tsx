'use client';

/**
 * O que todo gráfico do painel compartilha: formatação de moeda para eixo e
 * tooltip, o tooltip (texto em token de texto, nunca na cor da série), a
 * cor de cada obra (ordem fixa: `--serie-1..4`) e o estilo dos eixos.
 *
 * Regras do dataviz que valem aqui: um eixo só, marcas finas com ponta
 * arredondada de 4 px, grid recessivo, legenda quando há 2+ séries, rótulo
 * direto quando há até 4.
 */

/**
 * "R$ 264 mil" com espaços que não quebram: o <text> do Recharts faz
 * word-wrap pela largura da barra, e "R$ / 264 / mil" em três linhas era o
 * que saía na primeira captura.
 */
export function brlCurto(v: number): string {
  const abs = Math.abs(v);
  const sinal = v < 0 ? '−' : '';
  const nbsp = String.fromCharCode(0xa0);
  if (abs >= 1_000_000)
    return `${sinal}R$${nbsp}${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${nbsp}mi`;
  if (abs >= 1_000)
    return `${sinal}R$${nbsp}${Math.round(abs / 1_000).toLocaleString('pt-BR')}${nbsp}mil`;
  return `${sinal}R$${nbsp}${Math.round(abs).toLocaleString('pt-BR')}`;
}

export function brl(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/** A cor da série `i` (0-based). Depois da 4ª, repete — mas o painel nunca passa de 4. */
export function corDaSerie(i: number): string {
  return `var(--serie-${(i % 4) + 1})`;
}

export const EIXO = {
  tick: { fill: 'var(--text-secondary)', fontSize: 12 },
  axisLine: false as const,
  tickLine: false as const,
};

export interface ItemTooltip {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export function TooltipPainel({
  active,
  payload,
  label,
  rodape,
}: {
  active?: boolean;
  payload?: ItemTooltip[];
  label?: string | number;
  /** Linha extra a partir do dado da barra (ex.: quantidade de pagamentos). */
  rodape?: (dado: Record<string, unknown>) => string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const dado = payload[0]?.payload ?? {};
  const extra = rodape ? rodape(dado) : null;
  return (
    <div className="painel-tooltip">
      {label != null ? <div className="painel-tooltip__titulo">{String(label)}</div> : null}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="painel-tooltip__linha">
          <span
            className="painel-tooltip__cor"
            style={{ background: p.color }}
            aria-hidden="true"
          />
          <span className="painel-tooltip__nome">{p.name}</span>
          <span className="painel-tooltip__valor">{brl(Number(p.value ?? 0))}</span>
        </div>
      ))}
      {extra ? <div className="painel-tooltip__rodape">{extra}</div> : null}
    </div>
  );
}

/** Legenda em texto, com a amostra de cor ao lado do nome (nunca só a cor). */
export function LegendaPainel({ itens }: { itens: Array<{ nome: string; cor: string }> }) {
  return (
    <ul className="painel-legenda" aria-label="Legenda">
      {itens.map((it) => (
        <li key={it.nome} className="painel-legenda__item">
          <span className="painel-legenda__cor" style={{ background: it.cor }} aria-hidden="true" />
          {it.nome}
        </li>
      ))}
    </ul>
  );
}
