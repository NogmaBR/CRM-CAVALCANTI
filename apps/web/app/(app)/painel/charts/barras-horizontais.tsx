'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EIXO, TooltipPainel, brlCurto } from './comum';

/**
 * Ranking (fornecedores): barras horizontais, uma cor só (`--chart-1`), o
 * maior em cima, valor no fim de cada barra. Uma série não leva legenda —
 * o título do cartão diz o que é.
 */
export function BarrasHorizontais({
  data,
  rodape,
}: {
  data: Array<{ nome: string; valor: number } & Record<string, unknown>>;
  rodape?: (dado: Record<string, unknown>) => string | null;
}) {
  const altura = Math.max(200, data.length * 40 + 24);
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 88, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis type="number" tickFormatter={brlCurto} {...EIXO} />
        <YAxis type="category" dataKey="nome" {...EIXO} width={150} interval={0} />
        <Tooltip
          content={<TooltipPainel rodape={rodape} />}
          cursor={{ fill: 'var(--chart-1-soft)' }}
        />
        <Bar
          dataKey="valor"
          name="Total pago"
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={26}
        >
          <LabelList
            dataKey="valor"
            position="right"
            formatter={(v: unknown) => brlCurto(Number(v))}
            className="painel-rotulo"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
