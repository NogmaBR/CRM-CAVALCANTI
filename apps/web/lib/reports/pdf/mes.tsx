import 'server-only';
import type { ReactElement } from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { MesData } from '@/lib/data/reports';
import {
  NogmaDoc,
  ReportTitle,
  Section,
  KpiGrid,
  KpiCard,
  styles,
  formatBRL,
  formatDate,
} from './primitives';

// ---------------------------------------------------------------------------
// Format "setembro de 2026" style label
// ---------------------------------------------------------------------------
function mesLabel(ano: number, mes: number): string {
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Build origens KPI sub-string: "manual R$X · whatsapp R$Y · importado R$Z"
// (only non-zero values)
// ---------------------------------------------------------------------------
function origensSub(porOrigem: Record<'manual' | 'whatsapp' | 'importado', number>): string {
  const parts: string[] = [];
  for (const key of ['manual', 'whatsapp', 'importado'] as const) {
    if (porOrigem[key] > 0) {
      parts.push(`${key} ${formatBRL(porOrigem[key])}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------
export function renderMesPdf(data: MesData): ReactElement {
  const { ano, mes, pagamentos, totais } = data;
  const titulo = mesLabel(ano, mes);

  return (
    <NogmaDoc
      title={`Fechamento Mensal — ${titulo}`}
      headerSubtitle={titulo}
    >
      <ReportTitle
        title={`Fechamento Mensal — ${titulo}`}
        subtitle={`${totais.quantidade} pagamento${totais.quantidade !== 1 ? 's' : ''} registrado${totais.quantidade !== 1 ? 's' : ''}`}
      />

      {/* KPIs */}
      <KpiGrid>
        <KpiCard label="Total pago" value={formatBRL(totais.valorTotal)} />
        <KpiCard label="Pagamentos" value={String(totais.quantidade)} />
        <KpiCard
          label="Por origem"
          value={formatBRL(totais.valorTotal)}
          sub={origensSub(totais.porOrigem)}
        />
      </KpiGrid>

      {/* Pagamentos do mês */}
      <Section title="Pagamentos do mês">
        {pagamentos.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Obra</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Fornecedor</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Categoria</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Origem</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Valor</Text>
            </View>
            {pagamentos.map((p, i) => (
              <View
                key={p.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(p.data_pagamento)}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.obra_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.fornecedor_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{p.categoria_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>{p.origem}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{formatBRL(p.valor)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={[styles.totalCell, { flex: 12 }]}>Total</Text>
              <Text style={[styles.totalCell, { flex: 2 }, styles.cellRight]}>
                {formatBRL(totais.valorTotal)}
              </Text>
            </View>
          </View>
        )}
      </Section>

      {/* Por obra */}
      <Section title="Por obra">
        {totais.porObra.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 5 }]}>Obra</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Nº pagtos</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Total</Text>
            </View>
            {totais.porObra.map((row, i) => (
              <View
                key={row.obra_id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 5 }]}>{row.obra_nome}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{String(row.count)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{formatBRL(row.total)}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Por categoria */}
      <Section title="Por categoria">
        {totais.porCategoria.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 5 }]}>Categoria</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Nº pagtos</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Total</Text>
            </View>
            {totais.porCategoria.map((row, i) => (
              <View
                key={row.categoria_nome}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 5 }]}>{row.categoria_nome}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{String(row.count)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{formatBRL(row.total)}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </NogmaDoc>
  );
}
