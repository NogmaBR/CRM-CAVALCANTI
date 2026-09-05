import * as React from 'react';
import './Badge.css';

export type BadgeVariant =
  | 'neutral'
  | 'petroleum'
  | 'lime'
  | 'solid-lime'
  | 'solid'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Prepend a status dot. */
  dot?: boolean;
  children?: React.ReactNode;
}

/** Compact status/label pill. `dot` prepends a status dot. */
export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={['ng-badge', `ng-badge--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {dot ? <span className="ng-badge__dot" /> : null}
      {children}
    </span>
  );
}
