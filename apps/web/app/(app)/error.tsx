'use client';

/**
 * Fronteira de erro do app.
 *
 * Sem isto, qualquer `throw` em `lib/data/*` (uma consulta que falhou, um
 * `.single()` sem linha) renderizava a página de erro crua do Next para o
 * gestor. O `digest` é o que se procura no log da Vercel.
 */
export default function ErroDoApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" style={{ maxWidth: 560, margin: '10vh auto', padding: 24 }}>
      <h1 style={{ fontSize: '1.25rem' }}>Algo deu errado nesta tela</h1>
      <p>
        O erro foi registrado. Tente de novo; se continuar, avise quem administra o sistema
        {error.digest ? (
          <>
            {' '}
            e informe o código <code>{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <button type="button" className="nos-btn" onClick={() => reset()}>
        Tentar de novo
      </button>
    </main>
  );
}
