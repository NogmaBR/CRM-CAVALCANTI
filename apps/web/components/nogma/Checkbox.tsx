'use client';
import * as React from 'react';
import './Checkbox.css';

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

function Tick() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Checkbox with lime fill when checked. Supports label + description. */
export function Checkbox({
  label,
  description,
  disabled,
  id,
  className = '',
  ...props
}: CheckboxProps) {
  const generatedId = React.useId();
  const fid = id || generatedId;

  return (
    <label
      htmlFor={fid}
      className={[
        'ng-check',
        disabled ? 'ng-check--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input id={fid} type="checkbox" disabled={disabled} {...props} />
      <span className="ng-check__box">
        <Tick />
      </span>
      {label || description ? (
        <span className="ng-check__body">
          {label ? <span className="ng-check__label">{label}</span> : null}
          {description ? (
            <span className="ng-check__desc">{description}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
