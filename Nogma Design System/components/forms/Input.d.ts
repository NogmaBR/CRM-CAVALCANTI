import * as React from "react";

/**
 * Single-line text field with label, hint, error state, and optional
 * leading/trailing adornments (icons, units, buttons).
 *
 * @startingPoint section="Forms" subtitle="Labelled text field with states" viewport="700x160"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Error message — shown in place of hint and flips border to danger. */
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}
export declare function Input(props: InputProps): React.JSX.Element;
