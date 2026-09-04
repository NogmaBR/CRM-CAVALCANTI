import * as React from "react";
export type AlertVariant = "info" | "success" | "warning" | "danger";
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: React.ReactNode;
  /** Override the default variant icon. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}
export declare function Alert(props: AlertProps): React.JSX.Element;
