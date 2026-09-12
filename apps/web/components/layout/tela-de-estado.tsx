import type { ReactNode } from 'react';
// A tela pode ser a única coisa na página (404 global): garante o CSS do botão.
import '@/components/nogma/Button.css';

/**
 * Tela de estado: erro, página não encontrada, conta arquivada.
 * Centralizada, com ícone, título, texto e ações. Usada dentro e fora da
 * casca do app (o 404 global não tem sidebar).
 */
export function TelaDeEstado({
  icon,
  code,
  title,
  children,
  actions,
  tone = 'accent',
}: {
  icon: ReactNode;
  code?: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: 'accent' | 'danger';
}) {
  return (
    <main id="main-content" className="nos-estado">
      <div className="nos-estado__card">
        <div className={`nos-estado__icon${tone === 'danger' ? ' nos-estado__icon--danger' : ''}`}>
          {icon}
        </div>
        {code ? <div className="nos-estado__code">{code}</div> : null}
        <h1 className="nos-estado__title">{title}</h1>
        <p className="nos-estado__text">{children}</p>
        {actions ? <div className="nos-estado__actions">{actions}</div> : null}
      </div>
    </main>
  );
}
