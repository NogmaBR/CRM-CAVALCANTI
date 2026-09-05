import * as React from 'react';
import './Avatar.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  /** Full name — used for initials fallback and title. */
  name?: string;
  size?: AvatarSize;
  /** Rounded-square instead of circle. */
  square?: boolean;
  status?: 'online' | 'away' | 'offline';
}

function initials(name = ''): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

/** User avatar — image with initials fallback. Optional presence `status`. */
export function Avatar({
  src,
  name = '',
  size = 'md',
  square = false,
  status,
  className = '',
  ...props
}: AvatarProps) {
  return (
    <span
      className={[
        'ng-avatar',
        `ng-avatar--${size}`,
        square ? 'ng-avatar--square' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={name}
      {...props}
    >
      {src ? <img src={src} alt={name} /> : <span>{initials(name)}</span>}
      {status ? (
        <span className={`ng-avatar__status ng-avatar__status--${status}`} />
      ) : null}
    </span>
  );
}
