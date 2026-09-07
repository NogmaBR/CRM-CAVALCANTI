'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

interface LineAcumuladoProps {
  data: Array<{ label: string; total: number }>;
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
  payload?: Array<{ value: number }>;
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
      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>acumulado</div>
    </div>
  );
}

export function LineAcumulado({ data }: LineAcumuladoProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="petroleum-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0C4651" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#0C4651" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#0C4651"
          strokeWidth={2}
          fill="url(#petroleum-gradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#0C4651', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
