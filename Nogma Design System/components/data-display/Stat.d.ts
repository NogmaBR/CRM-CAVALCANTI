import * as React from "react";
/**
 * Headline metric (KPI) with optional trend delta and caption.
 * @startingPoint section="Data display" subtitle="KPI metric with trend" viewport="700x160"
 */
export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  value: React.ReactNode;
  /** Delta text, e.g. "+12%". */
  delta?: React.ReactNode;
  /** @default "up" */
  direction?: "up" | "down";
  caption?: React.ReactNode;
}
export declare function Stat(props: StatProps): React.JSX.Element;
