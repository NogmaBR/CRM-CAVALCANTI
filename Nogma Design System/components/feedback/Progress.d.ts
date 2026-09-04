import * as React from "react";
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value?: number;
  label?: React.ReactNode;
  showValue?: boolean;
  /** @default "petroleum" */
  tone?: "petroleum" | "lime";
}
export declare function Progress(props: ProgressProps): React.JSX.Element;
