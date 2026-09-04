import * as React from "react";
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  /** On-state color. @default "petroleum" */
  tone?: "petroleum" | "lime";
}
export declare function Switch(props: SwitchProps): React.JSX.Element;
