'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface BarSerieMensalProps {
  data: Array<{ label: string; total: number; count: number }>;
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { count: number } }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--text-primary)',
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div>{formatBRL(entry.value)}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        {entry.payload.count} pagamento{entry.payload.count === 1 ? '' : 's'}
      </div>
    </div>
  );
}

export function BarSerieMensal({ data }: BarSerieMensalProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatBRL}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(204,255,0,0.06)' }} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => (
            <Cell key={i} fill="#CCFF00" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
