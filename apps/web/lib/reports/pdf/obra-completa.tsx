import 'server-only';
import { fraseDoNivel } from '@/lib/completude/regras';
import type { ObraCompletaData } from '@/lib/data/reports';
import { fraseDoTripe } from '@/lib/financeiro/cronograma';
import { Text, View } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import {
  KpiCard,
  KpiGrid,
  NogmaDoc,
  ReportTitle,
  Section,
  formatBRL,
  formatDate,
  styles,
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
const COR_NIVEL = { completo: '#1F7A4D', parcial: '#B8790A', critico: '#C73F33' } as const;
const ROTULO_NIVEL = {
  completo: 'COMPLETO',
  parcial: 'FALTA POUCO',
  critico: 'FALTA MUITO',
} as const;
const ROTULO_GRAVIDADE = { critica: 'Grave', importante: 'Importante', leve: 'Leve' } as const;
const ROTULO_SITUACAO = {
  ok: 'dentro do orçado',
  atencao: 'perto do limite',
  estourado: 'ACIMA DO ORÇADO',
  sem_orcado: 'sem orçado',
} as const;

function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${Math.round(n)}%`;
}

export function renderObraCompletaPdf(data: ObraCompletaData): ReactElement {
  const { obra, pagamentos, documentos, totais, completude, cronograma, ritmo } = data;

  const kpiPct =
    totais.percentualOrcamento != null ? `${(totais.percentualOrcamento * 100).toFixed(1)}%` : null;

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
        <KpiCard label="Pagamentos" value={String(totais.quantidadePagamentos)} />
        <KpiCard label="Documentos" value={String(documentos.length)} />
      </KpiGrid>

      {/* PM6: situação da obra (semáforo) — o que falta, com gravidade */}
      <Section title="Situação da obra — o que está faltando">
        <View style={[styles.tableRow, { alignItems: 'center', marginBottom: 6 }]}>
          <Text
            style={[
              styles.badge,
              { backgroundColor: COR_NIVEL[completude.nivel], color: '#FFFFFF', marginRight: 8 },
            ]}
          >
            {ROTULO_NIVEL[completude.nivel]}
          </Text>
          <Text style={[styles.tableCell, styles.cellStrong]}>
            {fraseDoNivel(completude)} · {completude.itensOk} de {completude.itensTotal} itens
            preenchidos
          </Text>
        </View>
        {completude.faltas.length === 0 ? (
          <Text style={styles.emptyState}>Nenhuma pendência de cadastro nesta obra.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Gravidade</Text>
              <Text style={[styles.tableHeaderCell, { flex: 8 }]}>O que falta</Text>
            </View>
            {completude.faltas.map((f, i) => (
              <View key={f.chave} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 2 },
                    f.gravidade === 'critica' ? { color: COR_NIVEL.critico } : styles.cellMuted,
                  ]}
                >
                  {ROTULO_GRAVIDADE[f.gravidade]}
                </Text>
                <Text style={[styles.tableCell, { flex: 8 }]}>{f.texto}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* PM6: cronograma físico */}
      <Section title="Cronograma físico — em que pé está a obra">
        <KpiGrid>
          <KpiCard label="Obra executada" value={pct(cronograma.avancoFisico)} sub="medição" />
          <KpiCard
            label="Contrato gasto"
            value={pct(ritmo.gastoPct)}
            sub={
              obra.valor_contrato != null
                ? `Contrato: ${formatBRL(obra.valor_contrato)}`
                : 'sem contrato'
            }
          />
          <KpiCard
            label="Prazo usado"
            value={ritmo.prazoPct == null ? '—' : `${Math.min(100, Math.round(ritmo.prazoPct))}%`}
            sub={
              ritmo.diasRestantes == null
                ? 'sem datas'
                : ritmo.diasRestantes < 0
                  ? `venceu há ${Math.abs(ritmo.diasRestantes)} dias`
                  : `restam ${ritmo.diasRestantes} dias`
            }
          />
        </KpiGrid>
        <Text style={[styles.tableCell, { marginBottom: 6 }]}>
          {fraseDoTripe({
            fisicoPct: cronograma.avancoFisico,
            financeiroPct: ritmo.gastoPct,
            prazoPct: ritmo.prazoPct,
          })}
        </Text>
        {cronograma.etapas.length === 0 ? (
          <Text style={styles.emptyState}>Nenhuma etapa cadastrada no cronograma.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 5 }]}>Etapa</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Peso</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>
                Concluído
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Medido em</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Previsto</Text>
            </View>
            {cronograma.etapas.map((e, i) => (
              <View key={e.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 5 }]}>{e.nome}</Text>
                <Text style={[styles.tableCell, { flex: 1 }, styles.cellRight]}>{e.peso}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight, styles.cellStrong]}>
                  {e.percentual_concluido}%
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>
                  {formatDate(e.medido_em)}
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>
                  {formatDate(e.data_prevista)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* PM6: orçado × realizado por etapa */}
      <Section title="Orçado × realizado por etapa">
        {cronograma.orcado.linhas.length === 0 ? (
          <Text style={styles.emptyState}>Nenhum orçado por etapa informado.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 4 }]}>Etapa</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Orçado</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>
                Realizado
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Saldo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Situação</Text>
            </View>
            {cronograma.orcado.linhas.map((l, i) => (
              <View
                key={l.categoria_id}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 4 }]}>{l.categoria}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>
                  {formatBRL(l.orcado)}
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>
                  {formatBRL(l.realizado)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 2 },
                    styles.cellRight,
                    l.saldo != null && l.saldo < 0 ? { color: COR_NIVEL.critico } : {},
                  ]}
                >
                  {formatBRL(l.saldo)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 3 },
                    l.situacao === 'estourado' ? { color: COR_NIVEL.critico } : styles.cellMuted,
                  ]}
                >
                  {ROTULO_SITUACAO[l.situacao]}
                  {l.pct != null ? ` (${Math.round(l.pct)}%)` : ''}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={[styles.totalCell, { flex: 4 }]}>Total</Text>
              <Text style={[styles.totalCell, { flex: 2 }, styles.cellRight]}>
                {formatBRL(cronograma.orcado.totais.orcado)}
              </Text>
              <Text style={[styles.totalCell, { flex: 2 }, styles.cellRight]}>
                {formatBRL(cronograma.orcado.totais.realizado)}
              </Text>
              <Text style={[styles.totalCell, { flex: 5 }]}>
                {cronograma.orcado.totais.estouradas > 0
                  ? `${cronograma.orcado.totais.estouradas} etapa(s) acima do orçado`
                  : ''}
              </Text>
            </View>
          </View>
        )}
      </Section>

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
              <View key={p.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(p.data_pagamento)}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.fornecedor_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{p.categoria_nome ?? '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellMuted]}>{p.origem}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>
                  {formatBRL(p.valor)}
                </Text>
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
              <View key={d.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
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
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>
                Total (R$)
              </Text>
            </View>
            {porCategoria.map(([cat, val], i) => (
              <View key={cat} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 5 }]}>{cat}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>
                  {formatBRL(val)}
                </Text>
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
              <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>
                Total (R$)
              </Text>
            </View>
            {porFornecedor.map(([forn, val], i) => (
              <View key={forn} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 5 }]}>{forn}</Text>
                <Text style={[styles.tableCell, { flex: 2 }, styles.cellRight]}>
                  {formatBRL(val)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </NogmaDoc>
  );
}
