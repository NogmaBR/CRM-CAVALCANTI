import 'server-only';
import type { ReactElement } from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { AtividadeData, AtividadeItem } from '@/lib/data/reports';
import {
  NogmaDoc,
  ReportTitle,
  Section,
  KpiGrid,
  KpiCard,
  styles,
  formatBRL,
  formatDate,
  formatDateTime,
} from './primitives';

// ---------------------------------------------------------------------------
// Derive display columns from a unified AtividadeItem
// ---------------------------------------------------------------------------
function itemTipoLabel(item: AtividadeItem): string {
  if (item.tipo === 'pagamento') return `pagto (${item.origem})`;
  return `doc (${item.tipo_doc})`;
}

function itemDetalhe(item: AtividadeItem): string {
  if (item.tipo === 'pagamento') return item.descricao ?? '—';
  return item.nome_arquivo;
}

function itemValor(item: AtividadeItem): string {
  if (item.tipo === 'pagamento') return formatBRL(item.valor);
  return '—';
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------
export function renderAtividadePdf(data: AtividadeData): ReactElement {
  const { from, to, items, totais } = data;

  const subtitle = `Período: ${formatDate(from)} a ${formatDate(to)}`;

  return (
    <NogmaDoc
      title="Relatório de Atividade"
      headerSubtitle={subtitle}
    >
      <ReportTitle
        title="Relatório de Atividade"
        subtitle={subtitle}
      />

      {/* KPIs */}
      <KpiGrid>
        <KpiCard
          label="Pagamentos criados"
          value={String(totais.pagamentosCount)}
        />
        <KpiCard
          label="Valor total"
          value={formatBRL(totais.pagamentosValor)}
        />
        <KpiCard
          label="Documentos criados"
          value={String(totais.documentosCount)}
        />
      </KpiGrid>

      {/* Eventos unificados */}
      <Section title="Eventos">
        {items.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Data/hora</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Tipo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Obra</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Fornecedor</Text>
              <Text style={[styles.tableHeaderCell, { flex: 4 }]}>Detalhe</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Valor</Text>
            </View>
            {items.map((item, i) => (
              <View
                key={item.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 3 }]}>{formatDateTime(item.created_at)}</Text>
                <Text style={[styles.tableCell, { flex: 3 }, styles.cellMuted]}>{itemTipoLabel(item)}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{item.obra_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{item.fornecedor_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 4 }]}>{itemDetalhe(item)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>{itemValor(item)}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </NogmaDoc>
  );
}
