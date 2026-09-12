'use client';

import { Badge } from '@/components/nogma/Badge';
import { Button } from '@/components/nogma/Button';
import type { PreviewResult, PreviewRow } from '@/lib/services/import-pagamentos';
import { AlertTriangle, CheckCircle, FileText, RefreshCw, Upload, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { commitImportCsv, previewImportCsv } from './actions';
import './importar.css';

type Phase = 'upload' | 'preview' | 'done';

function formatBRL(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDataBR(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

// ── Upload phase ─────────────────────────────────────────────────────────────

function UploadPhase({
  onAnalyze,
  loading,
}: {
  onAnalyze: (file: File) => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedFile) onAnalyze(selectedFile);
  }

  return (
    <form className="importar-upload-form" onSubmit={handleSubmit}>
      <div className="importar-dropzone">
        <Upload size={28} color="var(--text-muted)" aria-hidden="true" />
        <p className="importar-dropzone__label">Selecione o arquivo CSV</p>
        <p className="importar-dropzone__hint">Arquivos até 2 MB · até 500 linhas por vez</p>
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="importar-file-input"
          onChange={handleFileChange}
          aria-label="Arquivo CSV de pagamentos"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<FileText size={14} />}
          onClick={() => inputRef.current?.click()}
        >
          {selectedFile ? selectedFile.name : 'Escolher arquivo'}
        </Button>
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={!selectedFile || loading}
        leadingIcon={loading ? <RefreshCw size={14} className="importar-spin" /> : undefined}
      >
        {loading ? 'Analisando...' : 'Analisar arquivo'}
      </Button>
    </form>
  );
}

// ── Preview phase ─────────────────────────────────────────────────────────────

function SummaryBadges({ summary }: { summary: PreviewResult['summary'] }) {
  return (
    <div className="importar-summary-badges">
      <Badge variant="neutral">Total: {summary.total}</Badge>
      <Badge variant="success">OK: {summary.ok}</Badge>
      <Badge variant="danger">Erro: {summary.erro}</Badge>
    </div>
  );
}

function PreviewRowCells({ row }: { row: PreviewRow }) {
  const temErro = row.errors.length > 0;
  const obraOk = row.matched.obra_id != null;
  const fornNome = row.matched.fornecedor_nome ?? row.raw.fornecedor ?? '—';
  const catNome = row.matched.categoria_nome ?? row.raw.categoria ?? '—';
  const valorNum = row.data?.valor;
  const dataPagamento = row.data?.data_pagamento;

  return (
    <tr className={temErro ? 'importar-row--erro' : undefined}>
      <td className="importar-cell--num">{row.linha}</td>
      <td>
        {obraOk ? (
          <span className="importar-match importar-match--ok">
            <CheckCircle size={12} aria-hidden="true" />
            {row.matched.obra_nome}
          </span>
        ) : (
          <span className="importar-match importar-match--fail">
            <XCircle size={12} aria-hidden="true" />
            {row.data?.obra ?? row.raw.obra ?? '—'}
          </span>
        )}
      </td>
      <td>
        {row.matched.fornecedor_id ? (
          <span className="importar-match importar-match--ok">
            <CheckCircle size={12} aria-hidden="true" />
            {fornNome}
          </span>
        ) : (
          <span className="importar-text--muted">{row.raw.fornecedor ? fornNome : '—'}</span>
        )}
      </td>
      <td>
        {row.matched.categoria_id ? (
          <span className="importar-match importar-match--ok">
            <CheckCircle size={12} aria-hidden="true" />
            {catNome}
          </span>
        ) : (
          <span className="importar-text--muted">{row.raw.categoria ? catNome : '—'}</span>
        )}
      </td>
      <td className="importar-cell--valor">
        {valorNum != null ? formatBRL(valorNum) : <span className="importar-text--muted">—</span>}
      </td>
      <td>
        {dataPagamento ? (
          formatDataBR(dataPagamento)
        ) : (
          <span className="importar-text--muted">—</span>
        )}
      </td>
      <td>
        {row.errors.length > 0 ? (
          <div className="importar-erros-cell">
            {row.errors.map((err) => (
              <Badge key={err} variant="danger" className="importar-erro-badge">
                {err}
              </Badge>
            ))}
          </div>
        ) : (
          <Badge variant="success">OK</Badge>
        )}
      </td>
    </tr>
  );
}

function PreviewPhase({
  preview,
  onConfirm,
  onCancel,
  loading,
}: {
  preview: PreviewResult;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="importar-preview">
      <div className="importar-preview__header">
        <SummaryBadges summary={preview.summary} />
        <div className="importar-preview__actions">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            Cancelar / novo upload
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={preview.summary.ok === 0 || loading}
            leadingIcon={loading ? <RefreshCw size={14} className="importar-spin" /> : undefined}
            onClick={onConfirm}
          >
            {loading ? 'Importando...' : `Confirmar import (${preview.summary.ok} linhas)`}
          </Button>
        </div>
      </div>

      {preview.summary.erro > 0 && (
        <div className="importar-aviso">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            {preview.summary.erro === preview.summary.total
              ? 'Nenhuma linha valida. Corrija os erros e reenvie o arquivo.'
              : `${preview.summary.erro} linha(s) com erro serão ignoradas. Apenas as ${preview.summary.ok} válidas serão inseridas.`}
          </span>
        </div>
      )}

      <div className="importar-preview-table-wrap">
        <table className="importar-preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Obra</th>
              <th>Fornecedor</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Erros</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <PreviewRowCells key={row.linha} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Done phase ────────────────────────────────────────────────────────────────

function DonePhase({
  result,
  onReset,
}: {
  result: { inserted: number; failed: number; errors: string[] };
  onReset: () => void;
}) {
  const success = result.inserted > 0;
  return (
    <div className="importar-done">
      <div
        className={`importar-done__banner importar-done__banner--${success ? 'success' : 'error'}`}
      >
        {success ? (
          <CheckCircle size={18} aria-hidden="true" />
        ) : (
          <XCircle size={18} aria-hidden="true" />
        )}
        <span>
          {result.inserted} inserido(s) · {result.failed} falhou/falharam
        </span>
      </div>
      {result.errors.length > 0 && (
        <div className="importar-done__erros">
          {result.errors.map((err) => (
            <p key={err} className="importar-done__erro-item">
              {err}
            </p>
          ))}
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={onReset}>
        Novo import
      </Button>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function ImportarClient() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<{
    inserted: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(file: File) {
    setLoading(true);
    setError(null);
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
        reader.readAsText(file, 'UTF-8');
      });
      const result = await previewImportCsv(text);
      setPreview(result);
      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao analisar arquivo');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const result = await commitImportCsv(preview.rows);
      setCommitResult(result);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao importar pagamentos');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPhase('upload');
    setPreview(null);
    setCommitResult(null);
    setError(null);
    setLoading(false);
  }

  return (
    <div className="importar-client">
      {error && (
        <div className="importar-banner importar-banner--error" role="alert">
          <XCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      {phase === 'upload' && <UploadPhase onAnalyze={handleAnalyze} loading={loading} />}

      {phase === 'preview' && preview && (
        <PreviewPhase
          preview={preview}
          onConfirm={handleConfirm}
          onCancel={handleReset}
          loading={loading}
        />
      )}

      {phase === 'done' && commitResult && (
        <DonePhase result={commitResult} onReset={handleReset} />
      )}
    </div>
  );
}
