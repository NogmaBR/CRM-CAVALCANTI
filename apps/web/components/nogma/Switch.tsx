'use client';
import * as React from 'react';
import './Switch.css';

export interface SwitchProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  /** On-state color. @default "petroleum" */
  tone?: 'petroleum' | 'lime';
}

/** Toggle switch. `tone="lime"` for an accented on-state. */
export function Switch({
  label,
  disabled,
  tone = 'petroleum',
  id,
  className = '',
  ...props
}: SwitchProps) {
  const generatedId = React.useId();
  const fid = id || generatedId;

  return (
    <label
      htmlFor={fid}
      className={[
        'ng-switch',
        tone === 'lime' ? 'ng-switch--lime' : '',
        disabled ? 'ng-switch--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        id={fid}
        type="checkbox"
        role="switch"
        disabled={disabled}
        {...props}
      />
      <span className="ng-switch__track">
        <span className="ng-switch__thumb" />
      </span>
      {label ? <span className="ng-switch__label">{label}</span> : null}
    </label>
  );
}
