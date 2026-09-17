'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EIXO, LegendaPainel, TooltipPainel, brlCurto } from './comum';

interface LinhaCaixa {
  label: string;
  entrou: number;
  saiu: number;
  saldo: number;
  acumulado: number;
}

/** Entrou × saiu, mês a mês: duas barras lado a lado, verde e laranja. */
export function CaixaMensal({ data }: { data: LinhaCaixa[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...EIXO} />
          <YAxis tickFormatter={brlCurto} {...EIXO} width={72} />
          <Tooltip
            content={
              <TooltipPainel rodape={(d) => `Saldo do mês: ${brlCurto(Number(d.saldo ?? 0))}`} />
            }
            cursor={{ fill: 'var(--chart-1-soft)' }}
          />
          <Bar
            dataKey="entrou"
            name="Entrou"
            fill="var(--serie-entra)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="saiu"
            name="Saiu"
            fill="var(--serie-sai)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
      <LegendaPainel
        itens={[
          { nome: 'Entrou (recebido dos clientes)', cor: 'var(--serie-entra)' },
          { nome: 'Saiu (pagamentos)', cor: 'var(--serie-sai)' },
        ]}
      />
    </div>
  );
}

/** Saldo acumulado: linha de 2 px, marcador só no hover, zero marcado. */
export function SaldoAcumulado({ data }: { data: LinhaCaixa[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" {...EIXO} />
        <YAxis tickFormatter={brlCurto} {...EIXO} width={72} />
        <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
        <Tooltip content={<TooltipPainel />} cursor={{ stroke: 'var(--text-muted)' }} />
        <Line
          type="monotone"
          dataKey="acumulado"
          name="Saldo acumulado"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, stroke: 'var(--surface-card)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
