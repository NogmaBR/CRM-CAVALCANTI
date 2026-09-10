import 'server-only';
import type { ReactElement } from 'react';
import { Text, View } from '@react-pdf/renderer';
import type { FornecedorData } from '@/lib/data/reports';
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
// Helpers
// ---------------------------------------------------------------------------
function periodoSubtitle(from: string | null, to: string | null): string {
  if (from && to) return `Período: ${formatDate(from)} a ${formatDate(to)}`;
  if (from) return `A partir de: ${formatDate(from)}`;
  if (to) return `Até: ${formatDate(to)}`;
  return 'Histórico completo';
}

// ---------------------------------------------------------------------------
// Info row for key-value pairs
// ---------------------------------------------------------------------------
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tableRow}>
      <View style={{ flex: 2, backgroundColor: '#F1F7F8' }}>
        <Text style={[styles.tableCell, styles.cellStrong]}>{label}</Text>
      </View>
      <View style={{ flex: 5 }}>
        <Text style={styles.tableCell}>{value}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------
export function renderFornecedorPdf(data: FornecedorData): ReactElement {
  const { fornecedor, pagamentos, documentos, totais, filtros } = data;

  const subtitle = periodoSubtitle(filtros.from, filtros.to);

  // Documento label: "CNPJ: 00.000.000/0001-00" or "CPF: ..."
  const docLabel =
    fornecedor.documento_tipo === 'cnpj'
      ? 'CNPJ'
      : fornecedor.documento_tipo === 'cpf'
        ? 'CPF'
        : 'Documento';

  // Build info pairs — skip null fields
  type Pair = [string, string];
  const infoPairs: Pair[] = [];
  if (fornecedor.documento) infoPairs.push([docLabel, fornecedor.documento]);
  if (fornecedor.email) infoPairs.push(['E-mail', fornecedor.email]);
  if (fornecedor.telefone) infoPairs.push(['Telefone', fornecedor.telefone]);
  infoPairs.push(['Situação', fornecedor.ativo === false ? 'Inativo' : 'Ativo']);

  return (
    <NogmaDoc
      title={`Relatório do Fornecedor: ${fornecedor.nome}`}
      headerSubtitle={subtitle}
    >
      <ReportTitle
        title={`Relatório do Fornecedor: ${fornecedor.nome}`}
        subtitle={subtitle}
      />

      {/* KPIs */}
      <KpiGrid>
        <KpiCard label="Total (R$)" value={formatBRL(totais.valorTotal)} />
        <KpiCard label="Ticket médio" value={formatBRL(totais.ticketMedio)} />
        <KpiCard label="Pagamentos" value={String(totais.quantidade)} />
        <KpiCard label="Obras atendidas" value={String(totais.porObra.length)} />
        <KpiCard label="Documentos" value={String(documentos.length)} />
      </KpiGrid>

      {/* Dados do fornecedor */}
      <Section title="Dados do fornecedor">
        {infoPairs.length === 0 ? (
          <Text style={styles.emptyState}>Sem registros neste período.</Text>
        ) : (
          <View style={styles.table}>
            {infoPairs.map(([label, value]) => (
              <InfoRow key={label} label={label} value={value} />
            ))}
          </View>
        )}
      </Section>

      {/* Primeira e última compra */}
      <Section title="Primeira e última compra">
        <View style={styles.table}>
          <InfoRow
            label="Primeira compra"
            value={formatDate(totais.primeiraCompra)}
          />
          <InfoRow
            label="Última compra"
            value={formatDate(totais.ultimaCompra)}
          />
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
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Obra</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Categoria</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Origem</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Valor</Text>
            </View>
            {pagamentos.map((p, i) => (
              <View
                key={p.id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(p.data_pagamento)}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.obra_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.categoria_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>{p.origem}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>{p.status_pagto ?? '—'}</Text>
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

      {/* Consolidado por obra */}
      <Section title="Consolidado por obra">
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
                key={row.obra_nome}
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

      {/* Documentos recebidos */}
      <Section title="Documentos recebidos">
        {documentos.length === 0 ? (
          <Text style={styles.emptyState}>Nenhum documento recebido deste fornecedor.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Tipo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 4 }]}>Nome arquivo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Obra</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Nº NF</Text>
            </View>
            {documentos.map((d, i) => (
              <View key={d.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(d.created_at)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>{d.tipo}</Text>
                <Text style={[styles.tableCell, { flex: 4 }]}>{d.nome_arquivo}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{d.obra_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{d.numero_nf ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </NogmaDoc>
  );
}
