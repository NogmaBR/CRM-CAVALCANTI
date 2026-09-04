import * as React from "react";
/**
 * Surface container with optional standard header (title + subtitle).
 * @startingPoint section="Data display" subtitle="Card surface with header" viewport="700x220"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Hover lift + pointer cursor. */
  interactive?: boolean;
  /** Remove shadow. */
  flat?: boolean;
  /** Lime top border accent. */
  accent?: boolean;
  /** Internal padding. @default true */
  padded?: boolean;
  children?: React.ReactNode;
}
export declare function Card(props: CardProps): React.JSX.Element;
