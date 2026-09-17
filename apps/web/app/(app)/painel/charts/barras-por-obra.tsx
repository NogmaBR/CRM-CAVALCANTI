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
import { EIXO, LegendaPainel, TooltipPainel, brlCurto } from './comum';

/**
 * Gasto × recebido por obra — barras lado a lado, uma cor por medida
 * (saiu = laranja, entrou = verde), rótulo direto no topo. O contrato não
 * vira terceira barra: aparece na frase de leitura e na tabela.
 */
export function BarrasPorObra({
  data,
}: {
  data: Array<{ obra: string; gasto: number; recebido: number }>;
}) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 8 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="obra" {...EIXO} interval={0} />
          <YAxis tickFormatter={brlCurto} {...EIXO} width={72} />
          <Tooltip content={<TooltipPainel />} cursor={{ fill: 'var(--chart-1-soft)' }} />
          <Bar
            dataKey="gasto"
            name="Gasto"
            fill="var(--serie-sai)"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          >
            <LabelList
              dataKey="gasto"
              position="top"
              formatter={(v: unknown) => brlCurto(Number(v))}
              className="painel-rotulo"
            />
          </Bar>
          <Bar
            dataKey="recebido"
            name="Recebido"
            fill="var(--serie-entra)"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          >
            <LabelList
              dataKey="recebido"
              position="top"
              formatter={(v: unknown) => brlCurto(Number(v))}
              className="painel-rotulo"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <LegendaPainel
        itens={[
          { nome: 'Gasto (saiu)', cor: 'var(--serie-sai)' },
          { nome: 'Recebido do cliente (entrou)', cor: 'var(--serie-entra)' },
        ]}
      />
    </div>
  );
}
