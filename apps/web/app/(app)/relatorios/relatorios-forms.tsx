'use client';

import { useState } from 'react';
import { Building2, Calendar, Truck, Activity, FileText, Table2 } from 'lucide-react';
import type { Obra } from '@/lib/data/obras';
import type { Fornecedor } from '@/lib/data/fornecedores';
import './relatorios.css';
import '../_shared/form-layout.css';

// ── Helpers ──────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" for a date `daysAgo` days before today. */
function daysAgoISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Returns the current month as "YYYY-MM". */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── Types ─────────────────────────────────────────────────────────

interface RelatoriosFormsProps {
  obras: Obra[];
  fornecedores: Fornecedor[];
}

// ── Shared sub-components ────────────────────────────────────────

function DownloadLink({
  href,
  disabled,
  variant,
  icon,
  label,
}: {
  href: string;
  disabled: boolean;
  variant: 'pdf' | 'csv';
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={disabled ? '#' : href}
      target={disabled ? undefined : '_blank'}
      rel="noopener noreferrer"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={`relatorios-btn relatorios-btn--${variant}`}
      aria-label={label}
      // Prevent navigation when disabled (belt-and-suspenders)
      onClick={disabled ? (e) => e.preventDefault() : undefined}
    >
      {icon}
      {variant === 'pdf' ? 'Baixar PDF' : 'Baixar CSV'}
    </a>
  );
}

// ── Card 1 — Relatório da Obra ───────────────────────────────────

function CardObra({ obras }: { obras: Obra[] }) {
  const [obraId, setObraId] = useState('');
  const disabled = obraId === '';

  const base = `/api/exports/obra-completa?obra_id=${encodeURIComponent(obraId)}`;

  return (
    <article className="relatorio-card">
      <Building2 size={32} aria-hidden="true" className="relatorio-card__icon" />
      <h2 className="relatorio-card__title">Relatório da Obra</h2>
      <p className="relatorio-card__desc">
        Todos os pagamentos, documentos e consolidados de uma obra específica.
      </p>

      <div className="relatorio-card__fields">
        <div className="form-layout__field" style={{ gridColumn: 'unset' }}>
          <label className="form-layout__label" htmlFor="card-obra-select">
            Obra <span aria-hidden="true" style={{ color: 'var(--danger, #ef4444)' }}>*</span>
          </label>
          <select
            id="card-obra-select"
            className="form-layout__select"
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            aria-required="true"
          >
            <option value="" disabled>— selecione uma obra —</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
                {o.deleted_at != null ? ' (arquivada)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relatorio-card__actions">
        <DownloadLink
          href={`${base}&format=pdf`}
          disabled={disabled}
          variant="pdf"
          icon={<FileText size={14} aria-hidden="true" />}
          label="Baixar relatório da obra em PDF"
        />
        <DownloadLink
          href={`${base}&format=csv`}
          disabled={disabled}
          variant="csv"
          icon={<Table2 size={14} aria-hidden="true" />}
          label="Baixar relatório da obra em CSV"
        />
      </div>
    </article>
  );
}

// ── Card 2 — Fechamento Mensal ───────────────────────────────────

function CardMes() {
  const [mes, setMes] = useState(currentMonth);

  // mes is "YYYY-MM"; split into ano and mes number
  const [ano, mesNum] = mes ? mes.split('-') : ['', ''];
  const disabled = mes === '' || !ano || !mesNum;

  const base = `/api/exports/mes?ano=${encodeURIComponent(ano ?? '')}&mes=${encodeURIComponent(String(Number(mesNum ?? 0)))}`;

  return (
    <article className="relatorio-card">
      <Calendar size={32} aria-hidden="true" className="relatorio-card__icon" />
      <h2 className="relatorio-card__title">Fechamento Mensal</h2>
      <p className="relatorio-card__desc">
        Todos os pagamentos do mês agrupados por obra, categoria e origem.
      </p>

      <div className="relatorio-card__fields">
        <div className="form-layout__field" style={{ gridColumn: 'unset' }}>
          <label className="form-layout__label" htmlFor="card-mes-input">
            Mês <span aria-hidden="true" style={{ color: 'var(--danger, #ef4444)' }}>*</span>
          </label>
          <input
            id="card-mes-input"
            type="month"
            className="relatorio-card__input"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            aria-required="true"
          />
        </div>
      </div>

      <div className="relatorio-card__actions">
        <DownloadLink
          href={`${base}&format=pdf`}
          disabled={disabled}
          variant="pdf"
          icon={<FileText size={14} aria-hidden="true" />}
          label="Baixar fechamento mensal em PDF"
        />
        <DownloadLink
          href={`${base}&format=csv`}
          disabled={disabled}
          variant="csv"
          icon={<Table2 size={14} aria-hidden="true" />}
          label="Baixar fechamento mensal em CSV"
        />
      </div>
    </article>
  );
}

// ── Card 3 — Histórico do Fornecedor ────────────────────────────

function CardFornecedor({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [fornecedorId, setFornecedorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const disabled = fornecedorId === '';

  function buildBase(format: 'pdf' | 'csv'): string {
    const params = new URLSearchParams({
      format,
      fornecedor_id: fornecedorId,
    });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return `/api/exports/fornecedor?${params.toString()}`;
  }

  return (
    <article className="relatorio-card">
      <Truck size={32} aria-hidden="true" className="relatorio-card__icon" />
      <h2 className="relatorio-card__title">Histórico do Fornecedor</h2>
      <p className="relatorio-card__desc">
        Todos os pagamentos feitos a um fornecedor + ticket médio + primeira/última compra.
      </p>

      <div className="relatorio-card__fields">
        <div className="form-layout__field" style={{ gridColumn: 'unset' }}>
          <label className="form-layout__label" htmlFor="card-forn-select">
            Fornecedor <span aria-hidden="true" style={{ color: 'var(--danger, #ef4444)' }}>*</span>
          </label>
          <select
            id="card-forn-select"
            className="form-layout__select"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            aria-required="true"
          >
            <option value="" disabled>— selecione um fornecedor —</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
                {f.deleted_at != null ? ' (arquivado)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="relatorio-card__field-row">
          <div className="form-layout__field" style={{ gridColumn: 'unset' }}>
            <label className="form-layout__label" htmlFor="card-forn-from">De</label>
            <input
              id="card-forn-from"
              type="date"
              className="relatorio-card__input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to || undefined}
            />
          </div>
          <div className="form-layout__field" style={{ gridColumn: 'unset' }}>
            <label className="form-layout__label" htmlFor="card-forn-to">Até</label>
            <input
              id="card-forn-to"
              type="date"
              className="relatorio-card__input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from || undefined}
            />
          </div>
        </div>
      </div>

      <div className="relatorio-card__actions">
        <DownloadLink
          href={buildBase('pdf')}
          disabled={disabled}
          variant="pdf"
          icon={<FileText size={14} aria-hidden="true" />}
          label="Baixar histórico do fornecedor em PDF"
        />
        <DownloadLink
          href={buildBase('csv')}
          disabled={disabled}
          variant="csv"
          icon={<Table2 size={14} aria-hidden="true" />}
          label="Baixar histórico do fornecedor em CSV"
        />
      </div>
    </article>
  );
}

// ── Card 4 — Atividade Recente ───────────────────────────────────

function CardAtividade() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => daysAgoISO(30));
  const [to, setTo] = useState(today);

  const disabled = from === '' || to === '' || from > to;

  function buildBase(format: 'pdf' | 'csv'): string {
    const params = new URLSearchParams({ format, from, to });
    return `/api/exports/atividade?${params.toString()}`;
  }

  return (
    <article className="relatorio-card">
      <Activity size={32} aria-hidden="true" className="relatorio-card__icon" />
      <h2 className="relatorio-card__title">Atividade Recente</h2>
      <p className="relatorio-card__desc">
        Timeline unificada de pagamentos e documentos criados no período.
      </p>

      <div className="relatorio-card__fields">
        <div className="relatorio-card__field-row">
          <div className="form-layout__field" style={{ gridColumn: 'unset' }}>
            <label className="form-layout__label" htmlFor="card-ativ-from">
              De <span aria-hidden="true" style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>
            <input
              id="card-ativ-from"
              type="date"
              className="relatorio-card__input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to || undefined}
              aria-required="true"
            />
          </div>
          <div className="form-layout__field" style={{ gridColumn: 'unset' }}>
            <label className="form-layout__label" htmlFor="card-ativ-to">
              Até <span aria-hidden="true" style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>
            <input
              id="card-ativ-to"
              type="date"
              className="relatorio-card__input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from || undefined}
              aria-required="true"
            />
          </div>
        </div>

        {from !== '' && to !== '' && from > to ? (
          <p
            role="alert"
            style={{ fontSize: 12, color: 'var(--danger, #ef4444)', margin: 0 }}
          >
            A data "De" não pode ser posterior à data "Até".
          </p>
        ) : null}
      </div>

      <div className="relatorio-card__actions">
        <DownloadLink
          href={buildBase('pdf')}
          disabled={disabled}
          variant="pdf"
          icon={<FileText size={14} aria-hidden="true" />}
          label="Baixar relatório de atividade em PDF"
        />
        <DownloadLink
          href={buildBase('csv')}
          disabled={disabled}
          variant="csv"
          icon={<Table2 size={14} aria-hidden="true" />}
          label="Baixar relatório de atividade em CSV"
        />
      </div>
    </article>
  );
}

// ── Root export ──────────────────────────────────────────────────

export function RelatoriosForms({ obras, fornecedores }: RelatoriosFormsProps) {
  return (
    <div className="relatorios-grid">
      <CardObra obras={obras} />
      <CardMes />
      <CardFornecedor fornecedores={fornecedores} />
      <CardAtividade />
    </div>
  );
}
