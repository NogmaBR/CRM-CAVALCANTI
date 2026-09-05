'use client';

// Temporary error boundary to surface real error message during Fase 4 diagnosis.
// Delete this file once /obras is stable.
export default function ObrasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 32 }}>
      <h1>Erro em /obras</h1>
      <pre
        style={{
          background: '#111',
          color: '#f88',
          padding: 16,
          borderRadius: 8,
          fontSize: 12,
          overflow: 'auto',
          maxWidth: '100%',
        }}
      >
        {`digest: ${error.digest ?? '(none)'}\nname: ${error.name}\nmessage: ${error.message}\nstack:\n${error.stack ?? '(no stack)'}`}
      </pre>
      <button
        type="button"
        onClick={reset}
        style={{ marginTop: 12, padding: '8px 14px', border: '1px solid #555' }}
      >
        Retry
      </button>
    </div>
  );
}
