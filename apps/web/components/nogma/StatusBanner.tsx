/**
 * StatusBanner — componente reutilizável para feedback ?error= / ?success=
 * vindo de Server Actions com redirect. Usa role="alert" + aria-live="polite"
 * para leitores de tela anunciarem a mensagem automaticamente.
 *
 * Uso:
 *   const { error, success } = await resolveSearchParams(searchParams);
 *   <StatusBanner error={error} success={success} />
 *
 * Segurança (audit MED fix): sanitiza a mensagem antes de renderizar.
 * React já escapa HTML (não há XSS possível), mas mensagens longas ou
 * com URLs podem ser usadas em phishing/social engineering — atacante
 * manda link `?error=Sua senha foi resetada — abra http://phish.com`
 * e user vê como se fosse o próprio sistema.
 *
 * Sanitização:
 *   - Truncate 240 chars (mensagens legítimas cabem)
 *   - Remove URLs completas (http://, https://, ftp://, javascript:, etc)
 *   - Remove tags HTML-ish (defesa em profundidade, React já escapa)
 *   - Colapsa whitespace (evita ASCII art / spoofing visual)
 */

const MAX_MESSAGE_CHARS = 240;

function sanitizeMessage(raw: string): string {
  return (
    raw
      // Remove protocolos/URLs comuns usados em phishing
      .replace(/(https?|ftp|javascript|data|vbscript|file):[^\s]*/giu, '[link removido]')
      // Remove tags HTML-ish (React já escapa, mas defesa em profundidade)
      .replace(/<[^>]*>/gu, '')
      // Colapsa whitespace / quebras de linha
      .replace(/\s+/gu, ' ')
      .trim()
      // Trunca com ellipsis
      .slice(0, MAX_MESSAGE_CHARS)
  );
}

export function StatusBanner({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (!error && !success) return null;

  const raw = error ?? success ?? '';
  const clean = sanitizeMessage(raw);
  if (!clean) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={error ? 'nos-banner nos-banner--error' : 'nos-banner nos-banner--success'}
    >
      {clean}
    </div>
  );
}
