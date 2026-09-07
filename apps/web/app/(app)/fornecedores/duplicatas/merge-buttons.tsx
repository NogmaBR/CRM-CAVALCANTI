'use client';

import { GitMerge } from 'lucide-react';
import { mergeFornecedoresAction } from './actions';

interface MergeButtonsProps {
  keepAId: string;
  dropAId: string; // dropId when keeping A
  keepBId: string;
  dropBId: string; // dropId when keeping B
  pagamentosA: number;
  documentosA: number;
}

function ConfirmMergeForm({
  keepId,
  dropId,
  label,
  pagamentos,
  documentos,
}: {
  keepId: string;
  dropId: string;
  label: string;
  pagamentos: number;
  documentos: number;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const msg = `Vai fundir. ${pagamentos} pagamento(s) e ${documentos} documento(s) serão movidos. Continuar?`;
    if (!window.confirm(msg)) {
      e.preventDefault();
    }
  }

  return (
    <form action={mergeFornecedoresAction} onSubmit={handleSubmit}>
      <input type="hidden" name="keepId" value={keepId} />
      <input type="hidden" name="dropId" value={dropId} />
      <button
        type="submit"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-2)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <GitMerge size={13} aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

export function MergeButtons({
  keepAId,
  dropAId,
  keepBId,
  dropBId,
  pagamentosA,
  documentosA,
}: MergeButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ConfirmMergeForm
        keepId={keepAId}
        dropId={dropAId}
        label="Manter A · arquivar B"
        pagamentos={pagamentosA}
        documentos={documentosA}
      />
      <ConfirmMergeForm
        keepId={keepBId}
        dropId={dropBId}
        label="Manter B · arquivar A"
        pagamentos={pagamentosA}
        documentos={documentosA}
      />
    </div>
  );
}
