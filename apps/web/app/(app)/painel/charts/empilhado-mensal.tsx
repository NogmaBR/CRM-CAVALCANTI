'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EIXO, LegendaPainel, TooltipPainel, brlCurto, corDaSerie } from './comum';

/**
 * Gasto mês a mês, empilhado por obra. A cor segue a obra (ordem alfabética,
 * `--serie-n`), com um gap de 2 px entre segmentos (stroke na cor da
 * superfície) — a "separação" que o dataviz exige quando duas cores ficam
 * perto no daltonismo.
 */
export function EmpilhadoMensal({
  data,
  series,
}: {
  data: Array<Record<string, number | string>>;
  series: string[];
}) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...EIXO} />
          <YAxis tickFormatter={brlCurto} {...EIXO} width={72} />
          <Tooltip
            content={
              <TooltipPainel rodape={(d) => `Total do mês: ${brlCurto(Number(d.total ?? 0))}`} />
            }
            cursor={{ fill: 'var(--chart-1-soft)' }}
          />
          {series.map((nome, i) => (
            <Bar
              key={nome}
              dataKey={nome}
              name={nome}
              stackId="obras"
              fill={corDaSerie(i)}
              stroke="var(--surface-card)"
              strokeWidth={2}
              maxBarSize={48}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <LegendaPainel itens={series.map((nome, i) => ({ nome, cor: corDaSerie(i) }))} />
    </div>
  );
}
