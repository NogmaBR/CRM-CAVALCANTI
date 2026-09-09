import 'server-only';
import type {
  ObraCompletaData,
  MesData,
  FornecedorData,
  AtividadeData,
} from '@/lib/data/reports';

/**
 * CSV generator. Retorna string com BOM UTF-8 (Excel pt-BR reconhece)
 * + CRLF line endings + escape RFC 4180 (double-quote wrap + escape
 * de aspas internas).
 */

const BOM = '﻿';
const CRLF = '\r\n';

function csvCell(v: unknown): string {
  if (v == null) return '';
  let s = String(v);
  // Formula injection guard (security audit 2026-09-09, finding D): Excel/Sheets
  // interpret a cell starting with =, +, -, @, tab or CR as a formula. Fields
  // like descricao/observacoes can come from free-text WhatsApp messages or
  // imported CSVs — neutralize by prefixing with an apostrophe, same fix as
  // OWASP recommends for CSV injection.
  if (/^[=+\-@\t\r]/u.test(s)) s = `'${s}`;
  const needsWrap = /[",\r\n]/u.test(s);
  const escaped = s.replace(/"/gu, '""');
  return needsWrap ? `"${escaped}"` : escaped;
}

export function toCsv(rows: Array<Array<unknown>>): string {
  const body = rows.map((r) => r.map(csvCell).join(',')).join(CRLF);
  return BOM + body + CRLF;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
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

function fmtNumberBR(n: number): string {
  // Excel pt-BR aceita vírgula decimal; usamos formato 1234.56 → 1234,56
  return n.toFixed(2).replace('.', ',');
}

// ============================================================================
// CSV: Obra Completa
// ============================================================================

export function obraCompletaToCsv(data: ObraCompletaData): string {
  const rows: Array<Array<unknown>> = [];
  rows.push(['# Relatório Obra Completa']);
  rows.push(['Obra', data.obra.nome]);
  if (data.obra.cliente) rows.push(['Cliente', data.obra.cliente]);
  rows.push(['Status', data.obra.status ?? '—']);
  if (data.obra.orcamento != null) rows.push(['Orçamento (R$)', fmtNumberBR(Number(data.obra.orcamento))]);
  rows.push(['Total pago (R$)', fmtNumberBR(data.totais.valorTotalPago)]);
  if (data.totais.percentualOrcamento != null) {
    rows.push(['% do orçamento', `${(data.totais.percentualOrcamento * 100).toFixed(1).replace('.', ',')}%`]);
  }
  rows.push(['Quantidade de pagamentos', String(data.totais.quantidadePagamentos)]);
  rows.push([]);

  rows.push(['## Pagamentos']);
  rows.push(['Data', 'Fornecedor', 'Categoria', 'Origem', 'Status', 'Valor (R$)', 'Descrição']);
  for (const p of data.pagamentos) {
    rows.push([
      fmtDate(p.data_pagamento),
      p.fornecedor_nome ?? '',
      p.categoria_nome ?? '',
      p.origem,
      p.status_pagto ?? '',
      fmtNumberBR(Number(p.valor)),
      p.descricao ?? '',
    ]);
  }
  rows.push([]);

  rows.push(['## Documentos']);
  rows.push(['Data upload', 'Tipo', 'Nome arquivo', 'Fornecedor', 'Nº NF']);
  for (const d of data.documentos) {
    rows.push([fmtDateTime(d.created_at), d.tipo, d.nome_arquivo, d.fornecedor_nome ?? '', d.numero_nf ?? '']);
  }
  rows.push([]);

  rows.push(['## Consolidado por Categoria']);
  rows.push(['Categoria', 'Total (R$)']);
  for (const [cat, total] of Object.entries(data.totais.valorPorCategoria).sort((a, b) => b[1] - a[1])) {
    rows.push([cat, fmtNumberBR(total)]);
  }
  rows.push([]);

  rows.push(['## Consolidado por Fornecedor']);
  rows.push(['Fornecedor', 'Total (R$)']);
  for (const [f, total] of Object.entries(data.totais.valorPorFornecedor).sort((a, b) => b[1] - a[1])) {
    rows.push([f, fmtNumberBR(total)]);
  }

  return toCsv(rows);
}

// ============================================================================
// CSV: Mês
// ============================================================================

export function mesToCsv(data: MesData): string {
  const rows: Array<Array<unknown>> = [];
  const mesNome = new Date(data.ano, data.mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  rows.push([`# Fechamento Mensal — ${mesNome}`]);
  rows.push(['Total pago (R$)', fmtNumberBR(data.totais.valorTotal)]);
  rows.push(['Quantidade de pagamentos', String(data.totais.quantidade)]);
  rows.push([]);

  rows.push(['## Pagamentos do mês']);
  rows.push(['Data', 'Obra', 'Fornecedor', 'Categoria', 'Origem', 'Status', 'Valor (R$)']);
  for (const p of data.pagamentos) {
    rows.push([
      fmtDate(p.data_pagamento),
      p.obra_nome ?? '',
      p.fornecedor_nome ?? '',
      p.categoria_nome ?? '',
      p.origem,
      p.status_pagto ?? '',
      fmtNumberBR(Number(p.valor)),
    ]);
  }
  rows.push([]);

  rows.push(['## Por obra']);
  rows.push(['Obra', 'Nº pagamentos', 'Total (R$)']);
  for (const o of data.totais.porObra) rows.push([o.obra_nome, String(o.count), fmtNumberBR(o.total)]);
  rows.push([]);

  rows.push(['## Por categoria']);
  rows.push(['Categoria', 'Nº pagamentos', 'Total (R$)']);
  for (const c of data.totais.porCategoria) rows.push([c.categoria_nome, String(c.count), fmtNumberBR(c.total)]);
  rows.push([]);

  rows.push(['## Por origem']);
  rows.push(['Origem', 'Total (R$)']);
  for (const [o, v] of Object.entries(data.totais.porOrigem)) rows.push([o, fmtNumberBR(v)]);

  return toCsv(rows);
}

// ============================================================================
// CSV: Fornecedor
// ============================================================================

export function fornecedorToCsv(data: FornecedorData): string {
  const rows: Array<Array<unknown>> = [];
  rows.push(['# Relatório do Fornecedor']);
  rows.push(['Fornecedor', data.fornecedor.nome]);
  if (data.fornecedor.documento) {
    const label = data.fornecedor.documento_tipo === 'cpf' ? 'CPF' : 'CNPJ';
    rows.push([label, data.fornecedor.documento]);
  }
  if (data.filtros.from || data.filtros.to) {
    rows.push(['Período', `${fmtDate(data.filtros.from) || '—'} a ${fmtDate(data.filtros.to) || '—'}`]);
  }
  rows.push(['Total (R$)', fmtNumberBR(data.totais.valorTotal)]);
  rows.push(['Ticket médio (R$)', fmtNumberBR(data.totais.ticketMedio)]);
  rows.push(['Nº pagamentos', String(data.totais.quantidade)]);
  if (data.totais.primeiraCompra) rows.push(['Primeira compra', fmtDate(data.totais.primeiraCompra)]);
  if (data.totais.ultimaCompra) rows.push(['Última compra', fmtDate(data.totais.ultimaCompra)]);
  rows.push([]);

  rows.push(['## Pagamentos']);
  rows.push(['Data', 'Obra', 'Categoria', 'Origem', 'Status', 'Valor (R$)', 'Descrição']);
  for (const p of data.pagamentos) {
    rows.push([
      fmtDate(p.data_pagamento),
      p.obra_nome ?? '',
      p.categoria_nome ?? '',
      p.origem,
      p.status_pagto ?? '',
      fmtNumberBR(Number(p.valor)),
      p.descricao ?? '',
    ]);
  }
  rows.push([]);

  rows.push(['## Por obra']);
  rows.push(['Obra', 'Nº pagamentos', 'Total (R$)']);
  for (const o of data.totais.porObra) rows.push([o.obra_nome, String(o.count), fmtNumberBR(o.total)]);

  return toCsv(rows);
}

// ============================================================================
// CSV: Atividade
// ============================================================================

export function atividadeToCsv(data: AtividadeData): string {
  const rows: Array<Array<unknown>> = [];
  rows.push(['# Relatório de Atividade']);
  rows.push(['Período', `${fmtDate(data.from)} a ${fmtDate(data.to)}`]);
  rows.push(['Pagamentos criados', String(data.totais.pagamentosCount)]);
  rows.push(['Valor total (R$)', fmtNumberBR(data.totais.pagamentosValor)]);
  rows.push(['Documentos criados', String(data.totais.documentosCount)]);
  rows.push([]);

  rows.push(['## Eventos']);
  rows.push(['Data', 'Tipo', 'Obra', 'Fornecedor', 'Detalhe', 'Valor (R$)']);
  for (const it of data.items) {
    if (it.tipo === 'pagamento') {
      rows.push([
        fmtDateTime(it.created_at),
        `pagamento (${it.origem})`,
        it.obra_nome ?? '',
        it.fornecedor_nome ?? '',
        it.descricao ?? '',
        fmtNumberBR(it.valor),
      ]);
    } else {
      rows.push([
        fmtDateTime(it.created_at),
        `documento (${it.tipo_doc})`,
        it.obra_nome ?? '',
        it.fornecedor_nome ?? '',
        it.nome_arquivo,
        '',
      ]);
    }
  }

  return toCsv(rows);
}
