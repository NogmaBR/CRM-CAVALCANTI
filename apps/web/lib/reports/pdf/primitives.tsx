import 'server-only';
import type { ReactNode } from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { nogmaColors as c, spacing as s, fontSizes as f } from './theme';

/**
 * Primitivos compartilhados para PDFs Nogma. Todos usam Helvetica
 * (bundled com @react-pdf, evita fetching de fontes) — para maior
 * fidelidade da marca, registrar fonte customizada via Font.register
 * (deferido; requer hospedar TTF acessível).
 *
 * Convention: A4 portrait, margens 32pt, header + footer fixos.
 */

Font.registerHyphenationCallback((word) => [word]); // desabilita hifen automático

export const styles = StyleSheet.create({
  page: {
    paddingTop: 72,
    paddingBottom: 56,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    fontSize: f.body,
    color: c.petroleum950,
    backgroundColor: c.white,
  },
  headerBar: {
    position: 'absolute',
    top: 24,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: c.petroleum800,
    paddingBottom: s.md,
  },
  brand: {
    fontSize: f.h4,
    fontFamily: 'Helvetica-Bold',
    color: c.petroleum800,
    letterSpacing: 1,
  },
  brandAccent: {
    color: c.lime600,
  },
  headerMeta: {
    textAlign: 'right',
    fontSize: f.caption,
    color: c.neutral600,
  },
  footerBar: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: c.neutral200,
    paddingTop: s.sm,
    fontSize: f.micro,
    color: c.neutral600,
  },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: f.h1,
    color: c.petroleum800,
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: f.body,
    color: c.neutral600,
    marginBottom: s.xl,
  },
  section: {
    marginBottom: s.xl,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: f.h3,
    color: c.petroleum800,
    marginBottom: s.md,
    paddingBottom: s.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral200,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: s.md,
    marginBottom: s.xl,
  },
  kpiCard: {
    flex: 1,
    padding: s.md,
    borderWidth: 1,
    borderColor: c.neutral200,
    borderRadius: 4,
    backgroundColor: c.petroleum050,
  },
  kpiLabel: {
    fontSize: f.caption,
    color: c.neutral600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: s.xs,
  },
  kpiValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: f.h2,
    color: c.petroleum950,
  },
  kpiSub: {
    fontSize: f.caption,
    color: c.neutral600,
    marginTop: s.xs,
  },
  table: {
    borderWidth: 1,
    borderColor: c.neutral200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: c.petroleum800,
  },
  tableHeaderCell: {
    padding: s.md,
    fontSize: f.caption,
    fontFamily: 'Helvetica-Bold',
    color: c.white,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: c.neutral100,
  },
  tableRowAlt: {
    backgroundColor: c.neutral50,
  },
  tableCell: {
    padding: s.md,
    fontSize: f.body,
    color: c.petroleum950,
  },
  cellRight: {
    textAlign: 'right',
  },
  cellMuted: {
    color: c.neutral600,
  },
  cellStrong: {
    fontFamily: 'Helvetica-Bold',
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: c.petroleum100,
    borderTopWidth: 1,
    borderTopColor: c.petroleum800,
  },
  totalCell: {
    padding: s.md,
    fontSize: f.bodyLg,
    fontFamily: 'Helvetica-Bold',
    color: c.petroleum950,
  },
  emptyState: {
    padding: s.xxl,
    textAlign: 'center',
    color: c.neutral600,
    fontStyle: 'italic',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: s.sm,
    borderRadius: 3,
    fontSize: f.micro,
    fontFamily: 'Helvetica-Bold',
    color: c.white,
    backgroundColor: c.petroleum600,
    alignSelf: 'flex-start',
  },
});

function nowFormatted(): string {
  const d = new Date();
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NogmaHeader({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.headerBar} fixed>
      <Text style={styles.brand}>
        NOGMA<Text style={styles.brandAccent}> · </Text>Gestor de Obras
      </Text>
      <View style={styles.headerMeta}>
        <Text>Emitido {nowFormatted()}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function NogmaFooter() {
  return (
    <View style={styles.footerBar} fixed>
      <Text>Nogma · Cavalcanti Construções · Documento confidencial</Text>
      <Text
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}

export function NogmaDoc({
  children,
  title,
  headerSubtitle,
}: {
  children: ReactNode;
  title: string;
  headerSubtitle?: string;
}) {
  return (
    <Document title={title} author="Nogma Gestor de Obras" creator="Nogma Gestor de Obras">
      <Page size="A4" style={styles.page}>
        <NogmaHeader subtitle={headerSubtitle} />
        {children}
        <NogmaFooter />
      </Page>
    </Document>
  );
}

export function ReportTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section} wrap>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <View style={styles.kpiGrid}>{children}</View>;
}

/** Helpers de formatação para PDFs. Todos pt-BR. */
export function formatBRL(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
