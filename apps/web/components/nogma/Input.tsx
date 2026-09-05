'use client';
import * as React from 'react';
import './Input.css';

/**
 * Single-line text field with label, hint, error state, and optional
 * leading/trailing adornments (icons, units, buttons).
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Error message — shown in place of hint and flips border to danger. */
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

/** Text field with optional label, hint, error, and leading/trailing adornments. */
export function Input({
  label,
  hint,
  error,
  leading,
  trailing,
  id,
  disabled,
  className = '',
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const fid = id || generatedId;

  return (
    <div className="ng-field">
      {label ? (
        <label className="ng-field__label" htmlFor={fid}>
          {label}
        </label>
      ) : null}
      <div
        className={[
          'ng-input',
          error ? 'ng-input--error' : '',
          disabled ? 'ng-input--disabled' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {leading ? <span className="ng-input__aff">{leading}</span> : null}
        <input
          id={fid}
          className="ng-input__el"
          disabled={disabled}
          aria-invalid={!!error}
          {...props}
        />
        {trailing ? <span className="ng-input__aff">{trailing}</span> : null}
      </div>
      {error ? (
        <span className="ng-field__error">{error}</span>
      ) : hint ? (
        <span className="ng-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
