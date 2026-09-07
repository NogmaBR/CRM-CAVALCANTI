import 'server-only';
import type { ReactElement } from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { ObraCompletaData } from '@/lib/data/reports';
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
// Address helper — endereco is JSONB: { logradouro?, cidade?, uf?, ... }
// Obra.endereco is typed as Json | null from @nogma/db; we narrow safely.
// ---------------------------------------------------------------------------
function formatEndereco(endereco: unknown): string | null {
  if (!endereco || typeof endereco !== 'object' || Array.isArray(endereco)) return null;
  const e = endereco as Record<string, unknown>;
  const logradouro = typeof e.logradouro === 'string' ? e.logradouro : null;
  const cidade = typeof e.cidade === 'string' ? e.cidade : null;
  const uf = typeof e.uf === 'string' ? e.uf : null;
  if (!logradouro && !cidade) return null;
  const cidadeUf = [cidade, uf].filter(Boolean).join('/');
  return [logradouro, cidadeUf].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------------------
// Info row: label + value pair used in the obra-info section
// ---------------------------------------------------------------------------
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, { flex: 1, backgroundColor: '#F1F7F8' }]}>
        <Text style={[styles.tableCell, styles.cellStrong]}>{label}</Text>
      </View>
      <View style={[styles.tableCell, { flex: 3 }]}>
        <Text style={styles.tableCell}>{value}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------
export function renderObraCompletaPdf(data: ObraCompletaData): ReactElement {
  const { obra, pagamentos, documentos, totais } = data;

  const kpiPct =
    totais.percentualOrcamento != null
      ? `${(totais.percentualOrcamento * 100).toFixed(1)}%`
      : null;

  // Build consolidado arrays from Record
  const porCategoria = Object.entries(totais.valorPorCategoria).sort((a, b) => b[1] - a[1]);
  const porFornecedor = Object.entries(totais.valorPorFornecedor).sort((a, b) => b[1] - a[1]);

  // Address
  const enderecoStr = formatEndereco(obra.endereco);

  // Info pairs to show (skip nulls)
  type Pair = [string, string];
  const infoPairs: Pair[] = [
    ['Status', obra.status ?? '—'],
    ['Cliente', obra.cliente ?? '—'],
    ['Data início', formatDate(obra.data_inicio)],
    ['Previsão de fim', formatDate(obra.data_prevista_fim)],
    ['Orçamento', formatBRL(obra.orcamento)],
  ];
  if (enderecoStr) infoPairs.push(['Endereço', enderecoStr]);

  return (
    <NogmaDoc
      title={`Relatório da Obra: ${obra.nome}`}
      headerSubtitle={`Emitido em ${formatDate(new Date().toISOString().slice(0, 10))}`}
    >
      <ReportTitle
        title={`Relatório da Obra: ${obra.nome}`}
        subtitle={obra.cliente ? `Cliente: ${obra.cliente}` : undefined}
      />

      {/* KPIs */}
      <KpiGrid>
        <KpiCard label="Total pago" value={formatBRL(totais.valorTotalPago)} />
        {kpiPct !== null && (
          <KpiCard
            label="% do orçamento"
            value={kpiPct}
            sub={`Orçamento: ${formatBRL(obra.orcamento)}`}
          />
        )}
        <KpiCard
          label="Pagamentos"
          value={String(totais.quantidadePagamentos)}
        />
        <KpiCard
          label="Documentos"
          value={String(documentos.length)}
        />
      </KpiGrid>

      {/* Informações da obra */}
      <Section title="Informações da obra">
        <View style={styles.table}>
          {infoPairs.map(([label, value]) => (
            <InfoRow key={label} label={label} value={value} />
          ))}
        </View>
      </Section>

      {/* Pagamentos */}
      <Section title="Pagamentos">
        {pagamentos.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Fornecedor</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Categoria</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Origem</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Valor</Text>
            </View>
            {pagamentos.map((p, i) => (
              <View
                key={p.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(p.data_pagamento)}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.fornecedor_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.categoria_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>{p.origem}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{formatBRL(p.valor)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={[styles.totalCell, { flex: 10 }]}>Total</Text>
              <Text style={[styles.totalCell, { flex: 2 }, styles.cellRight]}>
                {formatBRL(totais.valorTotalPago)}
              </Text>
            </View>
          </View>
        )}
      </Section>

      {/* Documentos */}
      <Section title="Documentos">
        {documentos.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Tipo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 4 }]}>Nome arquivo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Fornecedor</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Nº NF</Text>
            </View>
            {documentos.map((d, i) => (
              <View
                key={d.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(d.created_at)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>{d.tipo}</Text>
                <Text style={[styles.tableCell, { flex: 4 }]}>{d.nome_arquivo}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{d.fornecedor_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{d.numero_nf ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Consolidado por categoria */}
      <Section title="Consolidado por categoria">
        {porCategoria.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 5 }]}>Categoria</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Total (R$)</Text>
            </View>
            {porCategoria.map(([cat, val], i) => (
              <View
                key={cat}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 5 }]}>{cat}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{formatBRL(val)}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Consolidado por fornecedor */}
      <Section title="Consolidado por fornecedor">
        {porFornecedor.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 5 }]}>Fornecedor</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Total (R$)</Text>
            </View>
            {porFornecedor.map(([forn, val], i) => (
              <View
                key={forn}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 5 }]}>{forn}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{formatBRL(val)}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </NogmaDoc>
  );
}
