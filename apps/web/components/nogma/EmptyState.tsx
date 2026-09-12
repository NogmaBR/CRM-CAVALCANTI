import type { ReactNode } from 'react';

/**
 * Estado vazio de lista: ícone, título, uma frase e (opcionalmente) a ação
 * que tira a tela do vazio. Substitui o texto solto "Nenhum X encontrado".
 */
export function EmptyState({
  icon,
  title,
  children,
  actions,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="nos-empty" style={compact ? { padding: '28px 20px' } : undefined}>
      <div className="nos-empty__icon">{icon}</div>
      <p className="nos-empty__title">{title}</p>
      {children ? <p className="nos-empty__text">{children}</p> : null}
      {actions ? <div className="nos-empty__actions">{actions}</div> : null}
    </div>
  );
}
