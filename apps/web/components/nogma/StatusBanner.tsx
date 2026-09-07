/**
 * StatusBanner — componente reutilizável para feedback ?error= / ?success=
 * vindo de Server Actions com redirect. Usa role="alert" + aria-live="polite"
 * para leitores de tela anunciarem a mensagem automaticamente.
 *
 * Uso:
 *   const { error, success } = await resolveSearchParams(searchParams);
 *   <StatusBanner error={error} success={success} />
 */

export function StatusBanner({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (!error && !success) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={error ? 'nos-banner nos-banner--error' : 'nos-banner nos-banner--success'}
    >
      {error ?? success}
    </div>
  );
}
