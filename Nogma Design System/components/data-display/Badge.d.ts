import * as React from "react";
export type BadgeVariant =
  | "neutral" | "petroleum" | "lime" | "solid-lime" | "solid"
  | "success" | "warning" | "danger" | "outline";
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Prepend a status dot. */
  dot?: boolean;
  children?: React.ReactNode;
}
export declare function Badge(props: BadgeProps): React.JSX.Element;
