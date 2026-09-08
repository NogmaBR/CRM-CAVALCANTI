import type { CSSProperties } from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  /** Width — CSS length (px, %, ch). @default '100%' */
  width?: string | number;
  /** Height — CSS length. @default '1em' */
  height?: string | number;
  /** Rounded shape variant. @default 'rect' */
  variant?: 'rect' | 'text' | 'circle';
  className?: string;
  /** Extra inline styles (mesclados com width/height). Útil pra margin/layout. */
  style?: CSSProperties;
}

/**
 * Loading placeholder. Shimmer respects reduced-motion preferences.
 */
export function Skeleton({
  width = '100%',
  height = '1em',
  variant = 'rect',
  className = '',
  style,
}: SkeletonProps) {
  const w = typeof width === 'number' ? `${width}px` : width;
  const h = typeof height === 'number' ? `${height}px` : height;
  const cls = ['ng-skeleton', `ng-skeleton--${variant}`, className].filter(Boolean).join(' ');
  return <span className={cls} style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}
