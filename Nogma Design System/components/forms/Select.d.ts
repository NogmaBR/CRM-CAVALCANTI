import * as React from "react";
export type SelectOption = string | { value: string; label: string };
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Provide options as an array, or pass <option> children instead. */
  options?: SelectOption[];
  children?: React.ReactNode;
}
export declare function Select(props: SelectProps): React.JSX.Element;
