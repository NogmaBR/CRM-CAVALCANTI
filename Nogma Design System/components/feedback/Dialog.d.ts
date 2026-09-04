import * as React from "react";
/**
 * Modal dialog, controlled via `open`. Closes on overlay click and Escape.
 * @startingPoint section="Feedback" subtitle="Modal dialog with actions" viewport="700x420"
 */
export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Footer action row (usually Buttons). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}
export declare function Dialog(props: DialogProps): React.JSX.Element;
