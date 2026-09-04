import * as React from "react";

export type IconButtonVariant = "ghost" | "outline" | "primary" | "solid";
export type IconButtonSize = "sm" | "md" | "lg";

/** Icon-only button. Requires an accessible `label` (used for aria-label + tooltip). */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The icon node (SVG / icon-font element). */
  icon: React.ReactNode;
  /** Accessible label — required. */
  label: string;
  /** @default "ghost" */
  variant?: IconButtonVariant;
  /** @default "md" */
  size?: IconButtonSize;
  /** Fully rounded (pill/circle). */
  round?: boolean;
}

export declare function IconButton(props: IconButtonProps): React.JSX.Element;
