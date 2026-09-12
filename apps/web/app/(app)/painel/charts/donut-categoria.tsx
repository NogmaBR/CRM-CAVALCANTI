'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface DonutCategoriaProps {
  data: Array<{ nome: string; cor: string | null; total: number; count: number }>;
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
}: {
  active?: boolean;
  payload?: Array<{ payload: { nome: string; total: number; count: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
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
      <div style={{ fontWeight: 700 }}>{item.nome}</div>
      <div>{formatBRL(item.total)}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        {item.count} pagamento{item.count === 1 ? '' : 's'}
      </div>
    </div>
  );
}

export function DonutCategoria({ data }: DonutCategoriaProps) {
  if (data.length === 0) {
    return <div className="painel-chart-card__empty">Sem categorias com dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="nome"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          cx="50%"
          cy="50%"
        >
          {data.map((entry) => (
            <Cell key={entry.nome} fill={entry.cor ?? '#565B5B'} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
