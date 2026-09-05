import * as React from 'react';
import './Stat.css';

/**
 * Headline metric (KPI) with optional trend delta and caption.
 */
export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  value: React.ReactNode;
  /** Delta text, e.g. "+12%". */
  delta?: React.ReactNode;
  /** @default "up" */
  direction?: 'up' | 'down';
  caption?: React.ReactNode;
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {up ? (
        <path d="M7 17 17 7M9 7h8v8" />
      ) : (
        <path d="M7 7l10 10M17 9v8H9" />
      )}
    </svg>
  );
}

/** Headline metric with optional delta and caption. Value uses the Agency display face. */
export function Stat({
  label,
  value,
  delta,
  direction = 'up',
  caption,
  className = '',
  ...props
}: StatProps) {
  return (
    <div
      className={['ng-stat', className].filter(Boolean).join(' ')}
      {...props}
    >
      {label ? <span className="ng-stat__label">{label}</span> : null}
      <div className="ng-stat__row">
        <span className="ng-stat__value">{value}</span>
        {delta != null ? (
          <span className={`ng-stat__delta ng-stat__delta--${direction}`}>
            <Arrow up={direction === 'up'} />
            {delta}
          </span>
        ) : null}
      </div>
      {caption ? <span className="ng-stat__caption">{caption}</span> : null}
    </div>
  );
}
