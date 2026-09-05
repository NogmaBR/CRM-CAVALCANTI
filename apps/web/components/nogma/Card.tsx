import * as React from 'react';
import './Card.css';

/**
 * Surface container with optional standard header (title + subtitle).
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Hover lift + pointer cursor. */
  interactive?: boolean;
  /** Remove shadow. */
  flat?: boolean;
  /** Lime top border accent. */
  accent?: boolean;
  /** Internal padding. @default true */
  padded?: boolean;
  children?: React.ReactNode;
}

/** Surface container. Compose freely, or pass `title`/`subtitle` for a standard header. */
export function Card({
  title,
  subtitle,
  children,
  interactive = false,
  flat = false,
  accent = false,
  padded = true,
  className = '',
  ...props
}: CardProps) {
  const cls = [
    'ng-card',
    padded ? 'ng-card--pad' : '',
    interactive ? 'ng-card--interactive' : '',
    flat ? 'ng-card--flat' : '',
    accent ? 'ng-card--accent' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} {...props}>
      {title || subtitle ? (
        <div className="ng-card__header">
          {title ? <div className="ng-card__title">{title}</div> : null}
          {subtitle ? <div className="ng-card__subtitle">{subtitle}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
