import * as React from "react";

export type ButtonVariant = "primary" | "solid" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Nogma action button. The lime `primary` variant is the brand's signature CTA;
 * use `solid` (petroleum) for strong secondary actions, `secondary`/`ghost` for
 * lower-emphasis actions, `danger` for destructive ones.
 *
 * @startingPoint section="Buttons" subtitle="Lime CTA + petroleum/ghost variants" viewport="700x180"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. @default "primary" */
  variant?: ButtonVariant;
  /** @default "md" */
  size?: ButtonSize;
  /** Stretch to full container width. */
  block?: boolean;
  /** Icon element rendered before the label. */
  leadingIcon?: React.ReactNode;
  /** Icon element rendered after the label. */
  trailingIcon?: React.ReactNode;
  /** Render as another element/component (e.g. "a"). @default "button" */
  as?: React.ElementType;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): React.JSX.Element;
